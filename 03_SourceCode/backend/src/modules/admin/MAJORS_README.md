# Quản lý ngành đào tạo

Frontend: http://localhost:3000/dashboard/admin/nganh-dao-tao . Menu Admin → Ngành đào tạo.
Backend thuộc module Admin hiện có, phân lớp controller → service/DTO → repository.
Không có migration mới, dependency mới hoặc dữ liệu ngành giả được seed vào database đang dùng.

## Dữ liệu SQL

| Giao diện | Bảng/cột |
|---|---|
| Mã ngành | majors.major_code (unique, tối đa 50) |
| Tên ngành | majors.major_name (tối đa 255) |
| Đơn vị quản lý | majors.organizational_unit_id → organizational_units.id |
| Trạng thái | majors.status: ACTIVE / INACTIVE |
| Đơn vị/mã đơn vị | organizational_units.unit_name / unit_code |
| Số CTĐT | COUNT(training_programs.major_id) |
| Phạm vi đang dùng | user_scopes.major_id, registration_period_scopes.major_id |
| Chống ghi đè | majors.updated_at, giữ chuỗi UTC có 6 chữ số microsecond |
| Lịch sử thay đổi | audit_logs: entity_type=majors, old_value/new_value, actor, IP, reason |

SQL gốc đã có bảng majors, không thêm cột mô tả hoặc suy ra mã ngành từ tên.
Người dùng nhập mã ngành theo danh mục của đơn vị; ví dụ dữ liệu thử phải được đánh dấu TEST.
Tên/mã được trim; mã chỉ chứa chữ Latin, số, gạch dưới/gạch nối. Tên giữ nguyên Unicode.

## Quyền và ràng buộc

- Cả đọc và ghi trang quản lý ngành yêu cầu role ADMIN đang hoạt động + MASTERDATA_MANAGE từ SQL.
- Cán bộ/người duyệt không tự có quyền sửa danh mục ngành. Họ dùng ngành trong form CTĐT theo phạm vi SQL hiện tại.
- Khi ghi, kiểm tra lại quyền trong transaction; dữ liệu + audit commit cùng nhau. Audit lỗi thì rollback.
- Tạo/chuyển/reactivate ngành chỉ chọn đơn vị đang hoạt động. Ngành ở đơn vị đã ngừng có thể được ngừng sử dụng tại chỗ.
- Chưa có tham chiếu: có thể sửa mã/đơn vị hoặc xóa.
- Đã được CTĐT, user_scopes hoặc registration_period_scopes tham chiếu: giữ mã và đơn vị; cho sửa tên/trạng thái, chặn xóa ở cả UI/API. FK cũng bảo vệ các liên kết.
- Không tự chuyển CTĐT/học viên/scope sang khoa khác khi sửa ngành.
- INACTIVE không xóa lịch sử CTĐT; không được chọn cho CTĐT mới.
- Form CTĐT đọc lại ngành từ SQL/options; chỉ ngành ACTIVE trong phạm vi, chủ quản ACTIVE. Chủ quản con ngừng hoạt động không lọt qua khoa cha còn ACTIVE.
- PUT/DELETE cần expectedUpdatedAt lấy từ bản đã đọc. Dữ liệu đã thay đổi trả 409; đóng form và tải lại trước khi ghi.

## API

Các route dưới /admin, JWT Bearer; Next proxy qua /api/admin, cookie HttpOnly, kiểm tra Origin khi ghi.

| Method | URL | Nội dung |
|---|---|---|
| GET | /nganh-dao-tao | searchTerm, status ALL/ACTIVE/INACTIVE, unitId, page, limit |
| GET | /nganh-dao-tao/options | Đơn vị ACTIVE từ SQL |
| GET | /nganh-dao-tao/:id | Ngành, số tham chiếu, identityLocked, updatedAt |
| POST | /nganh-dao-tao | majorCode, majorName, unitId, status |
| PUT | /nganh-dao-tao/:id | Các trường POST + expectedUpdatedAt |
| DELETE | /nganh-dao-tao/:id?expectedUpdatedAt=... | Chỉ ngành chưa dùng |

Các ID trả dưới dạng string. Status dùng mã SQL; frontend dịch Hoạt động/Ngừng sử dụng.
Mã lỗi: 400 dữ liệu/đơn vị sai; 401 chưa đăng nhập; 403 thiếu quyền; 404 không có; 409 trùng mã/đã dùng/dữ liệu cũ.
Không trả lỗi SQL nội bộ về trình duyệt. Global whitelist hiện loại bỏ trường ngoài DTO, chỉ cột được định nghĩa mới được ghi.

## Test nhanh bằng giao diện và DBeaver

1. Bật backend/frontend như hiện tại. Admin → Ngành đào tạo. F5: mã IT/BA và đơn vị phải khớp bảng majors, không phải mock.
2. Muốn tạo ngành Sư phạm: Admin → Danh mục dùng chung → thêm Khoa/Đơn vị theo thông tin thật trước. Sau đó vào Ngành đào tạo → thêm ngành, chọn đơn vị vừa tạo.
3. Với dữ liệu thử: mã TEST_SP_TOAN, tên Sư phạm Toán kiểm thử, khoa đã chọn, ACTIVE → lưu → F5. Trong DBeaver: majors → Data → Refresh, kiểm tra major_code/name/organizational_unit_id/status.
4. Thử thêm trùng mã: bị chặn. Sửa tên ngành thử: F5 và SQL giữ id, tên đổi đúng.
5. Chuyển INACTIVE: lọc trạng thái thấy đúng; form tạo CTĐT của cán bộ có scope khoa tương ứng không còn chọn được ngành. Mở ACTIVE lại thì có.
6. Tài khoản khoa khác không thấy ngành này trong form CTĐT. Chưa cấp scope cho khoa mới thì có thể không thấy ngành mới là đúng; thay đơn vị công tác không tự cấp scope.
7. Chưa có CTĐT/scope tham chiếu: xóa ngành thử → website/SQL mất dòng, audit vẫn giữ.
8. Với ngành có CTĐT (IT/BA nếu đang được dùng): Xóa bị khóa; form giữ mã/khoa, tên/trạng thái có thể sửa theo quyền. Không sửa ngành thật chỉ để kiểm thử.
9. Tạo CTĐT mới bằng ngành thử trong môi trường test → số CTĐT liên kết tăng; chặn xóa/chuyển khoa, ngừng sử dụng vẫn đọc được CTĐT cũ.
10. Mở cùng ngành ở hai tab, lưu tab thứ nhất, lưu tab thứ hai: 409 chống ghi đè. Kiểm tra audit trước/sau.
11. Officer/STUDENT truy cập URL quản lý hoặc API trực tiếp: bị chặn.

Thêm khoa/ngành không tự tạo CTĐT hoặc tài khoản; các bước tạo chương trình/phân quyền vẫn làm riêng trên giao diện có sẵn.

## Kiểm thử tự động

Tại backend:

```bash
npm test -- --runInBand
npm run lint
npm run test:major-parity
```

major-parity chỉ đọc database cấu hình trong backend/.env, không tạo session/dữ liệu test.
Frontend: npm run lint và npm run build (dừng dev trước nếu cùng .next).

Hai script ghi dữ liệu chỉ nhận clone ctdt_major_review_<timestamp> và MAJOR_TEST_ALLOW_WRITES=1:

- Chép đủ SQL/view/trigger/migrations sang clone; cấp kết nối clone cho app user; backend test 3102 và Next test 3101 cùng clone, JWT_SECRET riêng, FRONTEND_URL=http://localhost:3101.
- MAJOR_TEST_URL=http://localhost:3101, DB_DATABASE đúng clone → npm run test:major-integration.
- Script dùng clone-only session để kiểm tra đúng server trước khi gửi HTTP ghi; tạo tài khoản/đơn vị/ngành test chỉ trong clone.
- Fixture credential: mặc định /tmp/ctdt-major-browser.json; đổi bằng MAJOR_BROWSER_FIXTURE. Giữ riêng, không push.
- Sau integration, chạy npm run test:major-browser với Playwright + Chromium đã cài trong môi trường test; nếu nằm ngoài repo, đặt PLAYWRIGHT_MODULE_PATH. Không cần Playwright để test tay.
- Dừng server test, xóa clone/quyền clone và fixture sau khi hoàn tất. Không chạy script ghi trên database đang dùng.

Các bài kiểm tra gồm CRUD thật, phân quyền, SQL parity, trùng mã, revision cũ, liên kết 3 bảng, rollback khi audit lỗi và CTĐT đọc ngành theo khoa.

## Kết quả kiểm tra triển khai

- Backend biên dịch TypeScript thành công; frontend production build thành công trên bản chạy cách ly.
- Lint backend/frontend qua; 244 unit test / 29 suite qua.
- 93 kiểm tra API/proxy/JWT/SQL và 15 kiểm tra browser qua trên clone.
- 34 đối chiếu dữ liệu nguồn chỉ đọc qua; 14 bảng nghiệp vụ nguồn giữ nguyên hash trước/sau test.
- Clone, quyền kết nối clone và fixture credential đã xóa; không seed ngành mẫu vào database đang dùng.
- Không có migration mới; chưa commit/push.


## Nhập ngành đào tạo bằng Excel

Đăng nhập **Admin** có quyền SQL `MASTERDATA_MANAGE`, mở **Ngành đào tạo → Nhập Excel**.

1. Bấm **Tải file mẫu Excel**.
2. Mở file, nhập vào sheet **Nganh dao tao**. Giữ nguyên tên sheet và 4 tiêu đề:

   | Mã ngành | Tên ngành | Mã đơn vị quản lý | Trạng thái |
   |---|---|---|---|
   | TEST_EXCEL_01 | Ngành kiểm thử Excel | FIT | ACTIVE |

   Dòng trên chỉ là ví dụ để tự nhập thử; hệ thống không tự tạo dữ liệu mẫu.
   Chỉ dùng `FIT` nếu sheet **Don vi tu CSDL** có mã này. Sheet đó được lấy từ `organizational_units` đang hoạt động khi tải mẫu. `INACTIVE` là ngừng sử dụng; `ACTIVE` là hoạt động. Cột mã nên giữ định dạng **Text** để không mất số 0 đầu.
3. Lưu file `.xlsx`, chọn file trên giao diện, bấm **Kiểm tra file**.
4. Xem kết quả từng dòng: mã trùng trong file/CSDL, đơn vị không có/đã ngừng hoạt động, thiếu trường, sai trạng thái hoặc công thức đều báo lỗi. Bước này **chưa ghi dữ liệu**.
5. Chỉ khi toàn bộ dòng hợp lệ, bấm **Xác nhận nhập N ngành**. Backend đọc lại file và kiểm tra lại SQL trong giao dịch. File chỉ thêm ngành mới; không cập nhật đè ngành hiện có.
6. Trong DBeaver, mở đúng database của backend → **Tables → majors → View Data → All Rows**, bấm **Refresh**. Kiểm tra `major_code`, `major_name`, `organizational_unit_id`, `status`. Đối chiếu `organizational_unit_id` với `organizational_units.id`; nhật ký được ghi trong `audit_logs` với `entity_type=majors`.
7. Thử chọn lại file đã nhập: phải báo mã đã tồn tại và chặn nhập. Thử một dòng đúng kèm một dòng sai đơn vị: cả file chưa được lưu. Có thể xóa ngành thử chưa được sử dụng bằng nút thùng rác.

Giới hạn nghiệp vụ lấy từ `system_settings`: `import.max_file_mb` và `import.max_rows`; thiếu/sai cấu hình sẽ báo lỗi thay vì tự điền. Trần kỹ thuật: **5 MB, 5.000 dòng**, ZIP giải nén tối đa **40 MB/256 thành phần**. File `.xls`, CSV, file hỏng/macro không được hỗ trợ. Dòng rỗng được bỏ qua; không chấp nhận công thức hoặc liên kết Excel trong ô dữ liệu. Khi sửa file cần chọn lại file và kiểm tra lại.

API (đều yêu cầu JWT + quyền Admin như quản lý ngành):

- `GET /admin/nganh-dao-tao/import/options`: giới hạn nhập từ SQL.
- `GET /admin/nganh-dao-tao/import/mau-excel`: tải `.xlsx` có sheet đơn vị thật.
- `POST /admin/nganh-dao-tao/import/kiem-tra`: multipart field `file`; trả tổng dòng, dòng lỗi, chi tiết và `fileHash`.
- `POST /admin/nganh-dao-tao/import/luu`: multipart `file` + `previewHash` nhận từ bước kiểm tra; lưu toàn bộ và audit trong cùng giao dịch. SQL thay đổi sau xem trước có thể khiến bước lưu trả `409`; kiểm tra lại file. HTTP `400`: sai mẫu/dữ liệu; `413`: quá dung lượng.

Frontend gọi qua `/api/admin/...` bằng cookie phiên; không đưa JWT ra mã phía trình duyệt. Proxy giữ boundary multipart, giới hạn dung lượng và kiểm tra Origin cho thao tác ghi.

Kiểm thử tự động:

```bash
cd 03_SourceCode/backend
npm test -- --runInBand
npm run test:major-excel-integration
npm run test:major-excel-browser
```

Hai lệnh cuối **chỉ chạy trên database bản sao dùng một lần** `ctdt_major_review_<timestamp>` cùng backend/frontend trỏ vào bản sao, `MAJOR_TEST_ALLOW_WRITES=1`, `JWT_SECRET` riêng và fixture do `test:major-integration` tạo (`MAJOR_BROWSER_FIXTURE`). Không chạy bằng database đang dùng. Browser cần Playwright/Chromium ngoài dependency ứng dụng (hoặc `PLAYWRIGHT_MODULE_PATH` trỏ module có sẵn). Các script tự từ chối tên database thật.

Đã kiểm tra tự động các trường hợp hợp lệ, sai file, trùng mã, phân quyền, Origin, đổi SQL sau xem trước và rollback cả ngành/nhật ký khi một dòng thất bại. Không cần migration hay cài thêm dependency để sử dụng chức năng Excel.
