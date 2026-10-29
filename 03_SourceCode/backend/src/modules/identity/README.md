# Đăng nhập, mật khẩu, phiên và quyền truy cập

Backend NestJS được gọi qua `/api/auth/*` của Next.js. JWT nằm trong cookie HttpOnly,
SameSite=Lax, Secure khi chạy production; không trả bearer token cho JavaScript trình duyệt.
Frontend có `/dang-nhap`, `/quen-mat-khau`, `/reset-password?token=...`, `/doi-mat-khau`.
Header dùng tên, vai trò, đơn vị thật từ SQL; có đổi mật khẩu và đăng xuất.

## Chạy local

Cấu hình backend/.env theo .env.example. JWT_SECRET bắt buộc, không dùng khóa mặc định.
Chạy `npm run migration:run` để tạo auth_sessions, sau đó chạy backend tại cổng 3002.
Frontend dùng BACKEND_API_URL=http://127.0.0.1:3002 trong .env.local và DATABASE_URL
trỏ cùng database trong .env (Prisma CLI cũng đọc file .env).
MariaDB local của phiên này dùng cổng 3307, dịch vụ `ctdt-mariadb-dev`.
Các file .env có thông tin truy cập được Git bỏ qua.

## Gửi email thật qua Gmail

1. Dùng Gmail cá nhân có Xác minh 2 bước, tạo mật khẩu ứng dụng tại
   https://myaccount.google.com/apppasswords .
2. Điền SMTP_USER bằng địa chỉ Gmail gửi; SMTP_PASS bằng mật khẩu ứng dụng đó.
   SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_SECURE=false.
   SMTP_FROM để trống sẽ dùng SMTP_USER. Không lưu mật khẩu thật trong .env.example.
3. Chạy `npm run check:smtp` trong backend để kiểm tra kết nối/xác thực SMTP.
4. Khởi động lại backend sau khi đổi .env.
5. Email trên form quên mật khẩu phải khớp một tài khoản ACTIVE, chưa xóa trong users.
   Dữ liệu mẫu dùng example.edu, nên cần cập nhật email tài khoản thử sang email thật
   do bạn quản lý (có thể dùng cùng Gmail gửi). Đổi email sẽ thu hồi các phiên và
   liên kết reset cũ; cần đăng nhập lại.
6. Mở `/quen-mat-khau`, nhập email đã lưu; mở thư nhận được, bấm liên kết và nhập
   mật khẩu mới + xác nhận. Thử lại liên kết cũ phải thất bại.

Tham khảo Google: https://support.google.com/accounts/answer/185833?hl=vi .
Khi thiếu SMTP, API trả 503 cho mọi email. Khi đã cấu hình, phản hồi cho email
không tồn tại/không hoạt động/yêu cầu đang trong cooldown là thông báo trung tính.
Lỗi chuyển thư chỉ ghi mã lỗi ở backend, không ghi mật khẩu SMTP hay link/token.
SMTP chấp nhận thư không đảm bảo thư đã vào Inbox; vẫn phải xác nhận thư thực nhận.

## Chính sách và phiên

- Đọc từ system_settings: account.lock_threshold, account.lock_minutes,
  session.timeout_minutes, account.reset_token_minutes, account.password_min_length.
- Giới hạn đăng nhập sai mặc định 5 lần, khóa 15 phút. Bộ đếm cập nhật dưới khóa dòng,
  không bị mất lượt khi nhiều request sai đồng thời. Hết thời gian khóa bắt đầu đếm lại.
- Mật khẩu mới có chữ và số, tối thiểu theo SQL (ít nhất 10 ký tự), tối đa 72 byte UTF-8,
  khác username và mật khẩu hiện tại, xác nhận phải khớp. Băm bcrypt cost 12.
- Mỗi JWT có jti và một dòng auth_sessions. Phiên có thời hạn tối đa theo cấu hình
  session.timeout_minutes, đồng thời kiểm tra last_seen_at và trạng thái tài khoản.
  Token cũ không có session/jti cần đăng nhập lại sau migration.
- Đăng xuất thu hồi phiên hiện tại trong SQL và xóa cookie. Đổi/reset mật khẩu thu hồi
  tất cả phiên và liên kết reset cũ. Khóa/xóa tài khoản hoặc đổi email qua Admin cũng
  thu hồi các phiên và token reset để không thể dùng lại khi mở khóa tài khoản.
- Tài khoản do Admin tạo phải đổi mật khẩu ban đầu; trước khi đổi chỉ dùng profile,
  change-password, logout. Mật khẩu ban đầu cũng kiểm tra chính sách và xác nhận.
- Link reset dùng token ngẫu nhiên 32 byte, SQL chỉ lưu SHA-256. Hiệu lực mặc định
  30 phút, dùng một lần. Cấp link mới vô hiệu link cũ; cooldown 60 giây mỗi tài khoản.
- Đổi mật khẩu, tiêu thụ token, thu hồi phiên và ghi audit chạy cùng transaction.
  Khóa user trước token/session; retry có giới hạn cho deadlock/record-changed của MariaDB.
- Timestamp mới trong transaction xác thực/Admin dùng UTC. Không sửa lại audit bất biến cũ.
- Có giới hạn request ở lớp ứng dụng cho các endpoint công khai; đây là giới hạn trong
  một tiến trình. Khi triển khai nhiều instance cần cơ chế rate limit dùng chung.

## Phân quyền và dữ liệu

JWT chỉ xác nhận danh tính và phiên. Vai trò/quyền được đọc lại từ users, user_roles,
roles, role_permissions, permissions. Không suy vai trò từ username hoặc tin claim role. Quyền là hợp của các vai trò ACTIVE đã gán.
Tài khoản không có vai trò không được tự coi là STUDENT để cấp quyền nghiệp vụ.

Admin cần vai trò ADMIN và quyền theo chức năng: USER_MANAGE, MASTERDATA_MANAGE,
SETTINGS_MANAGE, AUDIT_READ_ALL. Gán vai trò/phạm vi còn cần ROLE_SCOPE_MANAGE.
Phạm vi tạo/sửa có KEEP, UNIT, GLOBAL, NONE; KEEP giữ nguyên mọi scope hiện có,
kể cả MAJOR/PROGRAM. UNIT cấp đơn vị đã chọn và các đơn vị con qua closure table.
Sửa thông tin không tự xóa vai trò phụ khi vai trò chính giữ nguyên.
Tài khoản có thể không gắn đơn vị; scope UNIT yêu cầu chọn đơn vị.

Báo cáo cần PROGRAM_READ. Danh sách, tổng số, thống kê và Excel đều áp cùng user_scopes
GLOBAL/ORG_UNIT/MAJOR/PROGRAM. Học viên chỉ có PROGRAM_READ_OWN không được xem
báo cáo toàn hệ thống. Tài khoản chưa có scope trả danh sách rỗng.

Các màn hình không hiển thị toàn bộ bảng/cột SQL:
- Người dùng: tài khoản chưa xóa mềm, có phân trang/tìm kiếm; không trả password_hash.
- Danh mục: organizational_units, education_levels, knowledge_blocks theo 3 loại có trên form.
- Cấu hình: 7 khóa training.*; nếu chưa lưu khóa thì trả mặc định công bố của form,
  không tự đổi các quy tắc bậc đào tạo hoặc cấu trúc chương trình đã ban hành.
- Nhật ký: audit_logs, chỉ đọc/xuất, giữ bản ghi cũ và phân trang.
- Báo cáo: một dòng mỗi training_programs, chọn phiên bản mới nhất theo cohort/created_at/id;
  vẫn có chương trình chưa có phiên bản. Tổng học viên tính assignment ACTIVE trong phạm vi;
  SQL chỉ cho phép mỗi học viên có một assignment ACTIVE. Học viên được đếm DISTINCT trong từng chương trình. Học phần ngân hàng là tổng ACTIVE.
- Bản dữ liệu mẫu có 3 chương trình, 4 phiên bản. Admin GLOBAL thấy 3 chương trình;
  officer.fit theo đơn vị thấy 2. Số ít hơn do scope không có nghĩa là truy vấn bỏ sót.

## Kiểm thử

```bash
npm test -- --runInBand
npm run build
npm run lint
npm run check:smtp
```

Bài tích hợp ghi cần frontend/backend cùng trỏ vào một DATABASE BẢN SAO riêng,
đã nhập schema và chạy migration. Không chạy các bài dưới trên database dùng chung:

```bash
AUTH_TEST_ALLOW_WRITES=1 npm run test:auth-integration
npm run test:admin-integration
```

Có thể đặt DB_DATABASE, FRONTEND_URL, BACKEND_API_URL, ADMIN_TEST_BACKEND_URL
khi mở các tiến trình test riêng. Bài auth tạm đổi grant/policy của bản sao và khôi phục,
tạo tài khoản có marker auth_smoke_, giữ audit rồi xóa mềm tài khoản thử.
Các test reset qua API dùng token fixture đã băm trong bản sao; unit test kiểm tra
SMTP transport. Gửi/nhận email thật là bước riêng cần SMTP thực đã cấu hình.
 
