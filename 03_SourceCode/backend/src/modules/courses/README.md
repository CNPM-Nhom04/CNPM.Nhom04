# Danh mục học phần — NestJS và frontend

- Trang: http://localhost:3000/dashboard/danh-muc-hoc-phan
- Đăng nhập: http://localhost:3000/dang-nhap
- Swagger: http://localhost:3002/api → Courses - Danh mục học phần

## Đối chiếu CSDL

Module dùng các bảng và quyền có sẵn trong src/core/database/CSDL.sql.
Không thêm học phần mẫu, không sửa SQL gốc, không cần migration mới riêng cho module này.
Máy mới vẫn phải import CSDL gốc và chạy các migration của dự án.

| Dữ liệu giao diện       | Bảng/cột SQL                                                    |
| ----------------------- | --------------------------------------------------------------- |
| Mã, trạng thái học phần | courses.course_code, courses.status                             |
| Đơn vị quản lý          | courses.owning_unit_id → organizational_units.id, unit_name     |
| Tên, tên tiếng Anh      | course_versions.course_name, english_name                       |
| Tín chỉ, giờ            | course_versions.credits, theory_hours, practice_hours           |
| Mô tả, hiệu lực         | course_versions.description, effective_from, effective_to       |
| Số/trạng thái phiên bản | course_versions.version_no, status                              |
| Loại bắt buộc/tự chọn   | curriculum_courses.requirement_type, thuộc vị trí trong CTĐT    |
| Khối kiến thức          | curriculum_groups, thuộc từng CTĐT                              |
| Quyền                   | user_roles → roles → role_permissions → permissions             |
| Phạm vi                 | user_scopes, organizational_unit_closure, vw_user_course_access |
| Lịch sử                 | audit_logs, entity_type='course'                                |

Không gán cứng “Bắt buộc”, không dùng tên khoa thay khối kiến thức,
không mặc định 3 tín chỉ hay chọn đơn vị đầu tiên.
Ngân hàng không có cột bậc đào tạo: một học phần có thể dùng trong nhiều CTĐT.
Vì vậy tiêu đề không khẳng định tất cả học phần là SĐH.

Bảng danh sách hiển thị bản mới nhất và bản ACTIVE riêng biệt;
bản nháp mới không thay bản ACTIVE.
Chi tiết hiển thị tất cả phiên bản, kể cả RETIRED/bản nháp cũ.
Học phần chưa có phiên bản hiển thị trống và có thể tạo bản đầu tiên.

Dữ liệu local lúc triển khai: 21 học phần / 22 phiên bản thuộc FIT.
INF502 có v1 = 3 TC (RETIRED), v2 = 4 TC (ACTIVE).
FBE chưa có học phần. Đây là kết quả SQL, không phải số gán trong code.

## Quyền và phạm vi

- Mọi API cần phiên JWT còn hiệu lực và CATALOG_READ từ SQL.
- Thêm, tạo bản sửa đổi, kích hoạt, khóa/mở cần thêm CATALOG_MANAGE.
- SQL gốc: ADMIN/APPROVER chỉ xem; TRAINING_OFFICER được quản lý.
  STUDENT không có quyền danh mục nghiệp vụ này.
- Không bypass theo tên tài khoản hoặc vai trò ADMIN.
- GLOBAL hoặc ORG_UNIT/đơn vị con xác định phạm vi học phần.
  MAJOR/PROGRAM đơn thuần không cấp quyền ngân hàng học phần theo view SQL hiện có.
- Đơn vị tạo mới phải ACTIVE và trong phạm vi.
- ID ngoài phạm vi trả 404; thiếu quyền chức năng trả 403.
- Kiểm tra lại quyền và phạm vi trong transaction khi ghi.
- Giao diện dùng proxy cùng origin + cookie HttpOnly; lỗi API hiển thị rõ,
  không âm thầm thay lỗi truy vấn bằng danh sách rỗng.

## Luồng nghiệp vụ

1. Thêm: nhập mã, chọn đơn vị thật, nhập tên/tín chỉ/giờ/ngày hiệu lực.
   Tạo courses + course_versions v1 DRAFT + audit cùng transaction.
   Mã duy nhất theo collation SQL, kể cả khác hoa/thường.
2. Tạo bản sửa đổi: giữ mã/đơn vị; tạo DRAFT kế tiếp, giữ nguyên nội dung cũ (BR-12).
   Nếu nháp nhập sai, tạo bản sửa đổi mới hơn; chỉ nháp mới nhất được kích hoạt.
   expectedLatestVersionId ngăn lưu từ dữ liệu cũ/hai người lưu đồng thời.
   Học phần chưa có phiên bản dùng giá trị "0".
3. Kích hoạt: chỉ DRAFT mới nhất, học phần đang mở, đơn vị ACTIVE.
   Ngày bắt đầu phải đã đến, chưa quá ngày kết thúc,
   và sau ngày bắt đầu bản ACTIVE cũ.
   Bản ACTIVE cũ chuyển RETIRED; ngày kết thúc rút về trước ngày hiệu lực mới
   nếu ngày kết thúc cũ chưa sớm hơn. Hai bản thay trạng thái cùng transaction.
   Không tự kích hoạt nháp tương lai; đến ngày cán bộ kích hoạt.
4. Khóa/mở: courses.status đổi ACTIVE ↔ INACTIVE.
   Không xóa học phần, phiên bản, đề cương, điểm hoặc tham chiếu CTĐT.
   Học phần RETIRED có sẵn chỉ xem, không mở lại qua API này.
5. Liên kết CTĐT: bộ chọn chỉ nhận phiên bản ACTIVE trong thời gian hiệu lực,
   học phần ACTIVE và trong phạm vi. Bản đã xếp vào CTĐT giữ ID cũ khi khóa
   hoặc có bản mới; lưu cấu trúc không tự nâng phiên bản hoặc xóa lịch sử.
6. Tín chỉ dương DECIMAL(5,2), giờ nguyên 0..65535 theo SQL.
   Không tự quy đổi tín chỉ thành giờ khi CSDL chưa quy định công thức.
   Ngày kết thúc không trước ngày bắt đầu.

Không xóa cứng từ giao diện này. Đề cương/đính kèm thuộc module đề cương,
không được tự tạo hay sửa khi cập nhật danh mục.

## API

| Method | Đường dẫn backend                                     | Chức năng                     |
| ------ | ----------------------------------------------------- | ----------------------------- |
| GET    | /danh-muc-hoc-phan                                    | Tìm kiếm, lọc, phân trang SQL |
| GET    | /danh-muc-hoc-phan/don-vi                             | Đơn vị trong phạm vi          |
| GET    | /danh-muc-hoc-phan/:id                                | Chi tiết và tất cả phiên bản  |
| POST   | /danh-muc-hoc-phan                                    | Tạo học phần + DRAFT          |
| POST   | /danh-muc-hoc-phan/:id/phien-ban                      | Tạo bản sửa đổi DRAFT         |
| POST   | /danh-muc-hoc-phan/:id/phien-ban/:versionId/kich-hoat | Kích hoạt                     |
| POST   | /danh-muc-hoc-phan/:id/trang-thai                     | Khóa/mở                       |

Frontend gọi /api/danh-muc-hoc-phan/...; proxy chuyển sang NestJS.
List: search, status=ALL|ACTIVE|INACTIVE|RETIRED, unitId, page, limit (tối đa 100).
Tìm mã hoặc tên Việt/Anh của các phiên bản; một dòng cho mỗi học phần.

Ví dụ body tạo — thay bằng thông tin thật; chỉ test ghi trên DB test:

```json
{
  "courseCode": "MA_THUC_TE",
  "unitId": "1",
  "courseName": "Tên học phần thực tế",
  "englishName": "",
  "credits": 3,
  "theoryHours": 30,
  "practiceHours": 15,
  "description": "Nội dung thực tế",
  "effectiveFrom": "2026-10-30"
}
```

Tạo bản sửa đổi: bỏ unitId/courseCode, thêm expectedLatestVersionId.
Kích hoạt body {}. Khóa body {"status":"INACTIVE","expectedStatus":"ACTIVE"}.

## Chạy và test giao diện bằng tay

Terminal 1:

```bash
sudo systemctl start ctdt-mariadb-dev
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/backend
npm ci
npm run migration:run
npm run start:dev
```

Terminal 2:

```bash
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/frontend
npm ci
npm run dev
```

Backend .env: cấu hình DB thật của máy mình, PORT=3002.
Frontend .env.local: BACKEND_API_URL=http://127.0.0.1:3002.
Không commit .env/SMTP/password. Dùng .env.example làm mẫu trên máy mới.
Nếu server frontend đang chạy, dùng server đó hoặc Ctrl+C rồi chạy lại.

1. ADMIN: xem INF502 có 2 phiên bản, v2 4 tín chỉ; không có nút thêm/sửa/khóa.
2. Cán bộ FIT: thấy học phần FIT và đơn vị con.
   FBE hoặc thuan có scope FBE: không thấy học phần FIT.
   Đối chiếu scope SQL, không suy quyền chỉ từ tên tài khoản.
3. Cán bộ được phép: thêm trên DB test, nhập thông tin thật, lưu DRAFT.
   Tải lại trang, tìm mã và mở chi tiết để kiểm tra đã lưu SQL.
4. Kích hoạt với ngày hợp lệ. Tạo bản sửa đổi với tín chỉ khác:
   chưa kích hoạt thì cột ACTIVE vẫn giữ bản cũ.
   Kích hoạt bản mới rồi kiểm tra lịch sử; CTĐT cũ vẫn giữ ID cũ.
5. Mã trùng, tín chỉ 0, ngày sai, kích hoạt ngày tương lai:
   phải báo lỗi và không ghi dữ liệu dở dang.
6. Khóa: vẫn thấy lịch sử nhưng không chọn mới trong ngân hàng CTĐT.
   Mở lại và kiểm tra.
7. Tài khoản chỉ xem gọi POST Swagger phải 403;
   tài khoản khác khoa gọi ID học phần FIT phải 404.
8. Học viên không có CATALOG_READ bị chặn trang/API.
   Đăng xuất trước khi đổi tài khoản.

SQL đối chiếu trong DBeaver:

```sql
SELECT c.id, c.course_code, c.status, u.unit_name,
       v.id AS version_id, v.version_no, v.course_name, v.credits,
       v.theory_hours, v.practice_hours, v.status AS version_status,
       v.effective_from, v.effective_to
FROM courses c
JOIN organizational_units u ON u.id = c.owning_unit_id
LEFT JOIN course_versions v ON v.course_id = c.id
ORDER BY c.course_code, v.version_no DESC;

SELECT * FROM vw_user_course_access WHERE user_id = 2 ORDER BY course_id;
SELECT * FROM audit_logs WHERE entity_type = 'course' ORDER BY id DESC;
```

## Kiểm thử tự động

Backend:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm run test:course-parity
```

Parity chỉ đọc DB được cấu hình: đối chiếu danh sách/phạm vi/quyền và mọi
phiên bản cho các tài khoản CATALOG_READ đang hoạt động.

Frontend:

```bash
npm run build
npx eslint app/dashboard/danh-muc-hoc-phan lib/services/courseService.ts \
  'app/api/danh-muc-hoc-phan/[[...path]]/route.ts' --max-warnings=0
```

Integration có ghi chỉ được chạy trên bản sao riêng đã có schema/migrations,
trigger, view và user DB có quyền. Tên phải là ctdt_course_review_<timestamp>.
Không dùng ctdt_management hay DB dùng chung.

Backend test riêng, trỏ bản sao:

```bash
DB_DATABASE=ctdt_course_review_<timestamp> PORT=3102 npm run start:prod
```

Terminal khác ở backend:

```bash
COURSE_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_course_review_<timestamp> \
  COURSE_TEST_URL=http://127.0.0.1:3102 npm run test:course-integration
```

Thay <timestamp> bằng số thực. Hai tiến trình phải cùng DB.
Script kiểm tra canary SQL và session chỉ có trên bản sao trước khi ghi HTTP.
Script giữ dữ liệu test trên bản sao; sau test dừng server và xóa cả bản sao.

Có thể kiểm tra proxy bằng frontend test riêng:

```bash
# Terminal frontend
BACKEND_API_URL=http://127.0.0.1:3102 npm run dev -- --port 3101

# Terminal backend
COURSE_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_course_review_<timestamp> \
  COURSE_TEST_PROXY=1 COURSE_TEST_URL=http://localhost:3101 \
  npm run test:course-integration
```

Không dùng frontend trỏ DB bản sao này làm giao diện thật hằng ngày.

### Kết quả kiểm tra khi triển khai

- Backend/frontend production build đạt.
- 138 unit tests / 18 suites đạt.
- 172 kiểm tra HTTP/SQL/proxy trên bản sao đạt, gồm liên kết bộ chọn CTĐT.
- 270 kiểm tra parity chỉ đọc trên database thật đạt.
- Lint backend và các file frontend thay đổi đạt.
- Proxy Next được kiểm tra bằng cách gọi trực tiếp Route Handler với NextRequest và backend test thật.
- Chưa kiểm thử thao tác trình duyệt tự động:
  kiểm tra phê duyệt tự động của phiên làm việc chặn khởi động frontend test cổng 3101.
  Các bước test giao diện bằng tay ở trên vẫn cần thực hiện.
