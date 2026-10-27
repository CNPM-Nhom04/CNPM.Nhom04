# Admin API và tích hợp frontend

Bốn trang `frontend/app/dashboard/admin/*` gọi NestJS qua
`frontend/app/api/admin/[...path]/route.ts`. Next.js lấy JWT từ cookie HttpOnly,
chuyển tiếp đến NestJS, và kiểm tra Origin với các thao tác thay đổi dữ liệu.
NestJS kiểm tra tài khoản ACTIVE và vai trò ADMIN từ database ở mỗi request.
Không dựa vào claim role trong JWT hoặc tên tài khoản.

## Cấu trúc

- domain: các kiểu dữ liệu, giá trị mặc định và AdminRepository.
- application: DTO validation, AdminService, hash mật khẩu, xuất XLSX.
- infrastructure: MySQL repository, truy vấn tham số hóa, transaction.
- presentation: controller REST, JWT/Admin guard.
- core/database/migrations: bổ sung các trường còn thiếu cho giao diện.

## Cài đặt và chạy (WSL/bash)

Từ thư mục backend:

```bash
npm install
npm run migration:run
PORT=3002 npm run start:dev
```

Migration AdminSupport thêm description cho organizational_units và education_levels,
actor_role cho audit_logs, bảng knowledge_blocks và vai trò LECTURER.
Không dùng synchronize để thay đổi database. Chỉ chạy sau khi đã nhập schema CSDL.sql.
Migration đã được chạy trên database local của phiên làm việc này.

Trong frontend/.env.local:

```dotenv
BACKEND_API_URL=http://127.0.0.1:3002
```

Chạy frontend bằng `npm run dev`, mặc định cổng 3000.
Nếu đổi cổng, cập nhật BACKEND_API_URL cho đúng địa chỉ NestJS.
Đăng nhập bằng tài khoản đã được gán roles.role_code = ADMIN trong user_roles.
Không có bước reset mật khẩu hoặc tự nâng quyền tài khoản hiện có.

Mở:

- http://localhost:3000/dashboard/admin/nguoi-dung
- http://localhost:3000/dashboard/admin/master-data
- http://localhost:3000/dashboard/admin/cau-hinh
- http://localhost:3000/dashboard/admin/audit-log

Nếu chưa đăng nhập, bấm liên kết đăng nhập trên trang; sau đăng nhập sẽ quay lại trang đó.
Các trang admin hiển thị 20 bản ghi/trang, có thông báo tải/lỗi/thành công và nút thử lại.

## Endpoint NestJS

Mọi endpoint cần `Authorization: Bearer <JWT>` và vai trò ADMIN.
Swagger: http://localhost:3002/api

| Method | URL                         | Chức năng                        |
| ------ | --------------------------- | -------------------------------- |
| GET    | /admin/nguoi-dung           | Danh sách người dùng             |
| GET    | /admin/nguoi-dung/options   | Đơn vị công tác ACTIVE để chọn   |
| POST   | /admin/nguoi-dung           | Tạo người dùng, gán 1 vai trò    |
| PUT    | /admin/nguoi-dung/:id       | Sửa hồ sơ, trạng thái, vai trò   |
| DELETE | /admin/nguoi-dung/:id       | Xóa mềm                          |
| GET    | /admin/master-data          | Danh sách 3 loại danh mục        |
| POST   | /admin/master-data          | Thêm danh mục                    |
| PUT    | /admin/master-data/:id      | Sửa danh mục                     |
| DELETE | /admin/master-data/:id      | Xóa danh mục chưa dùng           |
| GET    | /admin/cau-hinh             | Đọc 7 tham số                    |
| PUT    | /admin/cau-hinh             | Lưu 7 tham số                    |
| POST   | /admin/cau-hinh/mac-dinh    | Lưu lại tham số mặc định         |
| GET    | /admin/audit-log            | Nhật ký                          |
| GET    | /admin/audit-log/xuat-excel | XLSX toàn bộ nhật ký khớp bộ lọc |

Danh sách nhận searchTerm (tối đa 255 ký tự), page (mặc định 1), limit (mặc định 20, tối đa 100).
Bộ lọc: selectedRole cho người dùng, selectedType cho danh mục, selectedAction cho nhật ký;
ALL bỏ qua bộ lọc. Response dạng `{ data, meta: { page, limit, total, totalPages } }`.
ID BIGINT luôn trả string. Không trả password_hash hoặc token reset mật khẩu.

### Người dùng

```json
{
  "username": "giangvien.demo",
  "password": "ExamplePassword123!",
  "hoTen": "Giảng viên thử nghiệm",
  "email": "giangvien.demo@example.com",
  "donViId": "1",
  "vaiTro": "GIANG_VIEN",
  "trangThai": true
}
```

PUT dùng cùng hồ sơ, bỏ username và password. Username không đổi sau khi tạo.
Mật khẩu tối thiểu 10 ký tự và tối đa 72 byte UTF-8, băm bcrypt với cost 12.
Email, username phải duy nhất, kể cả tài khoản đã xóa mềm.
Vai trò giao diện ánh xạ: QUAN_TRI=ADMIN, CAN_BO_DAO_TAO=TRAINING_OFFICER,
HOI_DONG=APPROVER, GIANG_VIEN=LECTURER, HOC_VIEN=STUDENT.
Giao diện hiện quản lý một vai trò/tài khoản; khi lưu sẽ thay các gán vai trò cũ
bằng vai trò được chọn. API admin không chỉnh user_scopes.

Không cho tự xóa, tự khóa hoặc tự hạ quyền. Quyền actor được kiểm tra lại trong
transaction, các thao tác admin được tuần tự hóa bằng khóa trên vai trò ADMIN.
Tài khoản bị khóa/xóa không dùng được JWT cũ; thay đổi vai trò có hiệu lực từ request tiếp theo.
Tài khoản khóa tạm có thể được mở bằng thao tác cập nhật trạng thái ACTIVE;
cập nhật tài khoản sẽ xóa failed_login_count và locked_until.

### Danh mục

```json
{
  "maDanhMuc": "KHOA_MOI",
  "tenDanhMuc": "Khoa mới",
  "loaiDanhMuc": "KHOA_QUAN_LY",
  "moTa": "Mô tả đơn vị",
  "trangThai": true
}
```

Loại: KHOA_QUAN_LY, BAC_DAO_TAO, KHOI_KIEN_THUC.
ID là chuỗi ghép, ví dụ KHOA_QUAN_LY:1; dùng encodeURIComponent khi gắn vào URL.
Không đổi loại khi sửa. Đơn vị tạo mới có unit_type=FACULTY.
Danh mục khối kiến thức là danh mục mẫu độc lập, không sửa các nhóm curriculum_groups
của CTĐT đã tồn tại. Bậc đào tạo mới chưa có quy tắc min/max tín chỉ hoặc hướng học,
cần bổ sung quy tắc ở chức năng nghiệp vụ tương ứng trước khi dùng.

Không xóa đơn vị còn tài khoản tham chiếu (kể cả đã xóa mềm), đơn vị có con
hoặc danh mục đang được tham chiếu bởi khóa ngoại. Dùng trạng thái INACTIVE
nếu muốn ngừng sử dụng mà giữ lịch sử.
Xóa đơn vị lá chưa dùng cũng xóa các dòng closure trong cùng transaction.

### Cấu hình

Lưu 7 trường giống giao diện, giá trị dạng string, trong system_settings với prefix training.
Các trường tín chỉ/thời hạn phải là số nguyên dương; điểm từ 0 đến 10.
Khi chưa có giá trị đã lưu, API trả mặc định của giao diện.
Nút Đặt lại mặc định có xác nhận và thực sự lưu vào database.
Đây là tham số mặc định; không tự sửa education_levels, registration_period_rules
hay các phiên bản CTĐT đã ban hành. Các module nghiệp vụ dùng các tham số này
khi triển khai quy trình kiểm tra tương ứng.

### Nhật ký

Mọi thao tác ghi admin và audit nằm cùng transaction, không ghi mật khẩu/hash.
Nhật ký chỉ đọc và xuất; không có API sửa/xóa.
Các bản ghi cũ từ module khác vẫn được hiển thị. Bản ghi mới lưu snapshot vai trò actor;
bản ghi cũ không có snapshot lấy nhãn vai trò hiện tại.
Thời gian API là ISO UTC; giao diện hiển thị giờ Việt Nam, file Excel ghi rõ UTC.
IP hiện là địa chỉ kết nối đến NestJS (thường là Next.js proxy);
chưa sử dụng header IP của client làm dữ liệu tin cậy.

## Kiểm tra

```bash
# Trong backend
npm test -- --runInBand
npm run build
npm run lint
# Cần cả backend :3002 và frontend :3000 đang chạy
npm run test:admin-integration
```

Bài tích hợp chạy trên database phát triển, cần có sẵn một ADMIN hoạt động.
Dùng JWT kiểm thử ngắn hạn cho tài khoản ADMIN đã có, không thay mật khẩu của họ.
Tạo dữ liệu với prefix smoke_, thử CRUD, tạo/đăng nhập tài khoản mới, kiểm tra quyền,
khôi phục cấu hình trước test, xóa danh mục test và xóa mềm tài khoản test.
Chỉ bỏ liên kết đơn vị của chính tài khoản thử đã xóa để dọn được đơn vị tạm;
audit bất biến và tài khoản thử đã xóa mềm được giữ lại.
Có thể đổi FRONTEND_URL và ADMIN_TEST_BACKEND_URL khi chạy.
Không chạy bài tích hợp trên database production.
