# Chương trình đào tạo: NestJS và Next.js

Module programs triển khai giao diện chuong-trinh-dao-tao:
danh sách, tạo/sửa thông tin, xây dựng cấu trúc, gửi duyệt, xét duyệt và tài liệu.
Tách domain, application, infrastructure, presentation như cấu trúc Identity.
Repository dùng TypeORM DataSource và các bảng nghiệp vụ có sẵn trong CSDL.sql;
không dùng synchronize và không tạo lại bảng chương trình/học phần.

## Chạy local trong WSL/bash

Backend:

```bash
cd 03_SourceCode/backend
npm install
npm run migration:run
PORT=3002 npm run start:dev
```

Điền DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, JWT_SECRET trong .env.
Database cần nhập CSDL.sql trước. Migration ProgramUi đã chạy trên database local
trong phiên làm việc này: program_ui_details, program_review_minutes và program_review_documents.

Frontend:

```dotenv
# frontend/.env.local
BACKEND_API_URL=http://127.0.0.1:3002
```

```bash
cd 03_SourceCode/frontend
npm install
npm run dev -- --port 3000
```

Mở http://localhost:3000/dang-nhap?next=/dashboard/chuong-trinh-dao-tao.
Next.js giữ JWT trong cookie HttpOnly và chuyển tiếp các request đến NestJS.
Không cần bật CORS cho luồng này. BACKEND_API_URL là địa chỉ nhìn từ server Next.js.

Nếu dùng đúng dữ liệu mẫu trong CSDL.sql, có officer.fit (soạn/gửi), approver.fit
(thẩm định), officer.fbe và các tài khoản khác; mật khẩu demo được ghi trong phần
S002 của CSDL.sql. Không có thao tác reset mật khẩu tài khoản hiện hữu trong thay đổi này.

## Quyền và phạm vi

Mỗi request đọc lại users, user_roles, roles, role_permissions, permissions từ database.
Không tin claim vai trò trong JWT. Tài khoản phải ACTIVE và chưa xóa mềm.

- PROGRAM_READ: danh sách, chi tiết, kiểm tra và tải tài liệu.
- PROGRAM_EDIT: tạo bản nháp, sửa thông tin, lưu cấu trúc.
- PROGRAM_SUBMIT: gửi duyệt.
- PROGRAM_APPROVE: ghi kết luận và tải biên bản lên.

Theo seed RBAC của dự án, ADMIN không mặc định có quyền soạn/phê duyệt CTĐT.
Dùng tài khoản cán bộ đào tạo để tạo/gửi, tài khoản người duyệt riêng để thẩm định.
Người gửi không được tự duyệt hoặc tự đính kèm tài liệu thẩm định, kể cả khi được
gán thêm vai trò có PROGRAM_APPROVE.

Dữ liệu giới hạn bởi user_scopes GLOBAL, ORG_UNIT (gồm đơn vị con qua closure),
MAJOR và PROGRAM. Tạo mới cần GLOBAL hoặc phạm vi đơn vị/ngành phù hợp;
PROGRAM scope chỉ đọc/sửa chương trình đã được cấp, không tự cấp quyền cho mã mới.
Ngoài phạm vi trả 404 với bản ghi đã có, hoặc 403 khi tạo mới.

## Test qua giao diện

1. Đăng nhập cán bộ, vào danh sách CTĐT, chọn Khởi tạo CTĐT Mới.
2. Chọn bậc/đơn vị/ngành từ database, điền mã duy nhất, tên, niên khóa
   dạng 2026 - 2028 và định mức. Lưu để chuyển đến /:id/build.
3. Mỗi hướng bắt buộc của bậc đào tạo được tạo tự động, kèm 4 nhóm A–D.
4. Chọn học phần ACTIVE từ ngân hàng, đặt nhóm, tính chất và học kỳ cho từng hướng.
   Đặt tín chỉ tối thiểu các nhóm; có nút điền theo các học phần đã chọn.
5. Lưu cấu trúc rồi Kiểm tra CTĐT. Sửa các lỗi tín chỉ/hướng/tỷ lệ tự chọn.
6. Sửa thông tin chung để bổ sung số/ngày quyết định trước khi gửi duyệt.
7. Gửi xét duyệt. Bản nháp chuyển SUBMITTED và khóa chỉnh sửa.
8. Đăng nhập tài khoản người duyệt riêng; mở Thẩm định trên danh sách.
9. Nhập hội đồng, ngày họp, kết luận. Có thể kéo thả/chọn PDF hoặc DOCX <=25MB,
   bấm Tải lên hồ sơ trước khi lưu kết luận.
10. Đạt điều kiện chuyển PUBLISHED và khóa phiên bản; Yêu cầu sửa hoặc Không đạt
    chuyển RETURNED kèm lý do. Người soạn có thể sửa và gửi lại.

Mỗi dòng danh sách là một program_versions. Tạo mới tạo training_programs + v1;
có thêm khởi tạo phiên bản trên CTĐT đã tồn tại, chưa có chức năng sao chép cấu trúc.
Các chương trình hiện có vẫn được đọc từ schema cũ dù chưa có thông tin mở rộng.
Niên khóa cũ chỉ có năm bắt đầu; khi sửa cần điền thêm năm kết thúc trên form.

## API NestJS

Swagger: http://localhost:3002/api. Dùng Authorization: Bearer <JWT>.

| Method | URL dưới /chuong-trinh-dao-tao | Chức năng                                    |
| ------ | ------------------------------ | -------------------------------------------- |
| GET    | /                              | Danh sách phiên bản                          |
| GET    | /options                       | Danh mục bậc, đơn vị, ngành                  |
| GET    | /hoc-phan                      | Ngân hàng phiên bản học phần ACTIVE          |
| GET    | /:id                           | Chi tiết, cấu trúc, biên bản, tài liệu       |
| POST   | /                              | Tạo chương trình v1 DRAFT                    |
| PUT    | /:id                           | Sửa thông tin chung DRAFT/RETURNED           |
| PUT    | /:id/cau-truc                  | Lưu cấu trúc DRAFT/RETURNED                  |
| GET    | /:id/kiem-tra                  | Kiểm tra các quy tắc tín chỉ                 |
| POST   | /:id/gui-duyet                 | Gửi SUBMITTED, tạo approval_requests/actions |
| POST   | /:id/xet-duyet                 | Thẩm định, cập nhật workflow và biên bản     |
| POST   | /:id/tai-lieu                  | multipart/form-data, trường file             |
| GET    | /:id/tai-lieu/:documentId      | Tải tài liệu có kiểm tra scope               |

Danh sách: searchTerm (mã/tên), selectedStatus (ALL hoặc DRAFT/SUBMITTED/REVIEWING/
RETURNED/PUBLISHED/ARCHIVED/RETIRED), page (1), limit (20, tối đa 100).
Response: { data, meta: { page, limit, total, totalPages }, permissions }.
ID BIGINT luôn là string; DECIMAL tín chỉ trả number.

### Payload tạo/sửa thông tin

```json
{
  "maCTDT": "MS-TEST-2026",
  "tenCTDT": "Chương trình thử nghiệm",
  "tenTiengAnh": "Example Program",
  "educationLevelId": "2",
  "managingUnitId": "1",
  "majorId": "1",
  "hinhThucDaoTao": "CHINH_QUY",
  "thoiGianDaoTao": "2 năm (4 học kỳ)",
  "khoaTuyenSinh": "2026 - 2028",
  "tongTinChiYeuCau": 60,
  "chuanDauRaTiengAnh": "VSTEP B2",
  "chuanDauRaTinHoc": "Chuẩn kỹ năng CNTT",
  "soQuyetDinhBanHanh": "QD-TEST-2026",
  "ngayBanHanh": "2026-10-28",
  "moTa": "Mô tả chương trình"
}
```

Các ID lấy từ options, không giả định giá trị ví dụ có trên mọi database.
PUT nhận thêm revision hiện tại, không cho đổi mã/ngành/bậc/đơn vị của chương trình.
Ngành phải thuộc đơn vị quản lý hoặc đơn vị con. Mã CTĐT duy nhất trong database.
Không hardcode tên bậc hoặc hai hướng nghiên cứu/ứng dụng; dùng education_level_tracks.

### Payload cấu trúc

```json
{
  "revision": 1,
  "tracks": [
    {
      "id": "1",
      "groups": [{ "id": "1", "minimumCredits": 60 }],
      "courses": [
        {
          "courseVersionId": "1",
          "groupId": "1",
          "requirementType": "REQUIRED",
          "semester": 1
        }
      ]
    }
  ]
}
```

Gửi đủ các hướng và nhóm đã có. Không được tham chiếu nhóm/học phần sai,
không lặp course_id trong cùng hướng. Tín chỉ/tên lấy từ course_versions,
không nhận tín chỉ tự khai trong payload.
Các course entry giữ ID khi sửa, giữ các liên kết tiên quyết/PLO hiện có;
xóa entry bị tham chiếu sẽ trả 409, không âm thầm xóa liên kết.
Cấu trúc không bị thay thế bằng cách xóa toàn bộ nhóm/hướng rồi tạo lại.

Revision chống ghi đè bản cũ. Sai revision trả 409 và yêu cầu tải lại.
API ghi khóa phiên bản trong transaction và đọc lại quyền trước khi thay đổi.

### Kiểm tra tín chỉ

Mỗi hướng được kiểm tra riêng:

- Đủ các hướng bắt buộc trong education_level_tracks.
- Định mức trong min_total_credits/max_total_credits của bậc.
- Tối thiểu nhóm không vượt số tín chỉ học phần có thể chọn.
- Mỗi nhóm tính MAX(tối thiểu khai báo, tín chỉ bắt buộc + tối thiểu các nhóm con).
  Cộng các nhóm gốc đúng bằng định mức hướng; không cộng trùng nhóm cha/con.
- Phần định mức vượt tổng bắt buộc là tín chỉ tự chọn cần đạt.
  Tỷ lệ phần này tuân min_elective_ratio/max_elective_ratio.
- Học kỳ 1–12, tín chỉ không âm, ngày/niên khóa hợp lệ.
- Đã điền số và ngày quyết định để hồ sơ có thể ban hành.

Ví dụ: định mức 60, bắt buộc 54, tự chọn cần đạt 6, nhóm tối thiểu 60 => 10% tự chọn.
Ngân hàng tự chọn có thể cung cấp hơn 6 TC; không cộng tất cả môn tự chọn thành
tín chỉ bắt buộc phải học. Đây là kiểm tra tổng/định mức, chưa giải bài toán tổ hợp
xem mọi lựa chọn học phần có thể ghép chính xác đến từng mức tín chỉ.

### Gửi và xét duyệt

POST gui-duyet: { "revision": 3 }.
Kiểm tra hợp lệ trước khi đổi trạng thái, tạo request + action SUBMIT và audit.

POST xet-duyet:

```json
{
  "revision": 4,
  "hoiDongThamDinh": "Hội đồng khoa học",
  "chuTichHoidong": "Chủ tịch",
  "thuKhao": "Thư ký",
  "ngayHop": "2026-10-28",
  "ketLuan": "DAT_DIEU_KIEN",
  "yKienDongGop": "Đủ điều kiện",
  "soBienBan": "BB-2026-01"
}
```

Ngày họp không ở tương lai (UTC+7). Kết luận gồm DAT_DIEU_KIEN,
YEU_CAU_SUA_DOI, KHONG_DAT. Hai kết luận sau bắt buộc có ý kiến/lý do và trả hồ sơ.
Ghi biên bản, approval_action, trạng thái request, trạng thái phiên bản và audit
cùng transaction. Quy tắc cấm tự duyệt được kiểm tra tại API và trigger có sẵn.
Đạt điều kiện kiểm tra lại cấu trúc rồi set PUBLISHED, locked_at, published_at.
Hai request gửi/duyệt đồng thời chỉ một request thành công; request cũ trả 409.

### Tài liệu

PDF/DOCX tối đa 25MB; kiểm tra đuôi và chữ ký cơ bản của file.
Lưu tên, MIME, kích thước, người tải lên trong database; nội dung lưu tại
backend/storage/program-reviews với tên UUID. Đường dẫn này được gitignore.
Có thể đổi PROGRAM_UPLOAD_DIR và cần volume lưu bền khi triển khai Docker.
Không đưa thư mục tài liệu thành static public: tải qua endpoint có xác thực/scope.
Kiểm tra định dạng này không phải dịch vụ quét virus hoặc kiểm định đầy đủ nội dung tài liệu.

## Kiểm tra tự động

```bash
cd 03_SourceCode/backend
npm test -- --runInBand
npm run build
npm run lint
# Cần backend :3002, frontend :3000 và dữ liệu master có sẵn
npm run test:program-integration
```

Bài tích hợp tạo 2 tài khoản cán bộ/người duyệt riêng, chương trình và học phần
có prefix program_smoke_. Thử đăng nhập, scope, validation, concurrency,
file upload/download, trả sửa, gửi lại, phê duyệt và bất biến sau ban hành.
Kết thúc: CTĐT/học phần thử chuyển RETIRED, tài khoản thử xóa mềm và bỏ scope.
Không xóa vật lý các phiên bản, approval actions hay audit do trigger bất biến.
Các biên bản và tệp thử được giữ cùng hồ sơ để truy vết.
Chỉ chạy trên database phát triển; không đổi mật khẩu hoặc nội dung chương trình thật.
Có thể đổi FRONTEND_URL khi frontend chạy cổng khác.
Build frontend cần DATABASE_URL cho Prisma của các trang khác, xem frontend/.env.example.

## Đối chiếu dữ liệu SQL và bổ sung giao diện

Đã bổ sung các trường chưa được lấy/hiển thị ở lần triển khai đầu:

- Mã phiên bản, năm tuyển sinh, phiên bản nguồn, người tạo, lý do trạng thái,
  thời điểm gửi/công bố/khóa/lưu trữ/ngừng sử dụng và khoảng hiệu lực.
- PLO theo phiên bản, môn tiên quyết (gồm điểm tối thiểu) và liên kết học phần–PLO.
- Phiên bản học phần, tên tiếng Anh, LT/TH, mô tả, ghi chú và học kỳ nullable.
- Giới hạn tối đa của nhóm kiến thức; hướng INACTIVE vẫn được đọc nhưng không sửa
  hoặc tính như hướng đang hoạt động.
- Toàn bộ yêu cầu xét duyệt và approval_actions, kể cả các hồ sơ SQL cũ chưa có
  biên bản hội đồng theo mẫu giao diện.
- Tab CTĐT chưa có phiên bản, tránh bỏ sót training_programs chưa có program_versions.

Các endpoint bổ sung:

- GET /chuong-trinh-dao-tao/chua-co-phien-ban (searchTerm/page/limit).
- GET /chuong-trinh-dao-tao/danh-muc/:programId.
- POST /chuong-trinh-dao-tao/danh-muc/:programId/phien-ban.
  Nhận payload tạo chương trình và maPhienBan; giữ nguyên mã/ngành/bậc/đơn vị
  của CTĐT gốc, cần PROGRAM_EDIT và scope của chương trình đó.

Mã phiên bản mặc định v1 khi tạo mới; có thể nhập mã riêng khi tạo thêm phiên bản.
Phiên bản mới có cấu trúc trống theo hướng bắt buộc, không tự sao chép môn/PLO.
Chương trình INACTIVE/RETIRED không được tạo thêm phiên bản.
Mã phiên bản hiện được hiển thị riêng với mã chương trình và được tìm kiếm bằng API.

Dữ liệu gốc kiểm tra từ CSDL.sql/database (không tính bản ghi test):

| Phiên bản   | Hướng | Nhóm | Học phần trong cấu trúc | PLO |
| ----------- | ----: | ---: | ----------------------: | --: |
| MIT-2024-v1 |     2 |    8 |                      33 |   4 |
| MIT-2025-v1 |     2 |    8 |                      33 |   4 |
| MIT-2026-v1 |     2 |    8 |                      33 |   4 |
| BIT-2026-v1 |     1 |    2 |                       7 |   0 |

Có thêm BBA trong training_programs nhưng chưa có phiên bản; chỉ tài khoản được
cấp scope Khoa Kinh tế hoặc GLOBAL mới thấy. officer.fit chỉ thấy Khoa CNTT,
đó là giới hạn quyền, không phải bỏ sót truy vấn.

SQL gốc không chứa thông tin mở rộng tiếng Anh/hình thức/thời gian/ngoại ngữ/CNTT/
số và ngày quyết định của 4 phiên bản trên. Các trường này được ghi rõ chưa có
dữ liệu; không suy ra CHINH_QUY, niên khóa kết thúc hoặc ngày quyết định từ dữ liệu khác.
Học kỳ NULL giữ nguyên NULL, không thay thành học kỳ 1.

BIT-2026-v1 có định mức 120 TC nhưng SQL chỉ khai báo 7 học phần, tổng 22 TC
(19 bắt buộc, 3 tự chọn), nên chính bộ dữ liệu mẫu này chưa đủ cấu trúc.
Các hướng MIT có thể có ngân hàng học phần tổng 63/64 TC cho định mức 60 vì có
môn tự chọn; đây không phải dữ liệu thừa cần cắt bỏ.

Chạy kiểm tra chỉ đọc giữa API và database:

```bash
npm run test:program-data
```

Bài kiểm tra đối chiếu từng ID phiên bản/hướng/nhóm/học phần/PLO/tiên quyết/
liên kết PLO/lịch sử duyệt và LT/TH/học kỳ với SQL, cùng danh mục chưa có phiên bản.
Không thêm/xóa/sửa dữ liệu gốc. Test tích hợp ghi dùng lệnh riêng và tạo dữ liệu có marker.

## Tách dữ liệu kiểm thử khỏi dữ liệu thật

Migration ProgramTestFixtures tạo bảng program_test_fixtures, là danh mục đánh dấu
rõ mã CTĐT do bài tích hợp tạo. Các fixture cũ chỉ được nhận diện khi đồng thời
khớp mã, tên chương trình, tài khoản tạo và email example.invalid của bài test.
Không xóa phiên bản, approval history, audit hay biên bản; không ẩn chung mọi
CTĐT RETIRED vì các bản thật ngừng sử dụng vẫn cần được xem.

API danh sách, tổng số kết quả và CTĐT chưa có phiên bản đều loại các mã đã được
đăng ký trong bảng này. Không dựa vào việc lọc chuỗi trên frontend.
Chi tiết theo ID vẫn được kiểm tra scope và giữ lại để truy vết hồ sơ kiểm thử.

program.integration.cjs đăng ký mã thử trước khi tạo CTĐT qua API, nên chương
trình thử không xuất hiện trong danh sách thật kể cả khi bài test đang chạy.
Bài test kiểm tra trực tiếp rằng tìm mã fixture ở danh sách thường/PUBLISHED
đều có total=0, đồng thời vẫn thử đầy đủ workflow qua ID.
program-data-parity.cjs đối chiếu các phiên bản thật (không thuộc registry) với
SQL và xác nhận nguồn MIT/BIT cùng danh mục BBA không bị mất.

Khi bổ sung báo cáo/thống kê CTĐT khác, áp dụng cùng điều kiện NOT EXISTS đối
với program_test_fixtures để không cộng fixture vào số liệu nghiệp vụ.
