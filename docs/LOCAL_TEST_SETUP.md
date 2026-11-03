# Clone và chạy test trên máy khác

Mục tiêu: chạy cùng code và cùng dữ liệu với máy bàn giao. Chỉ clone Git không chuyển database, mật khẩu local hay tệp upload. Hướng dẫn dùng MariaDB local, backend 3002, frontend 3000; chưa dùng Docker vì cấu hình Docker dev hiện chưa hoàn chỉnh.

> **Máy chạy backend trong Ubuntu/WSL:** làm theo [quy trình WSL thống nhất](WSL_TEST_SETUP.md), bao gồm tạo database, import bằng terminal và user TCP riêng. Đừng trộn bước Windows native bên dưới với WSL.

## 1. Người bàn giao chuẩn bị

- Chốt commit đã push/merge: `git status`, `git rev-parse --short HEAD`. Gửi nhóm nhánh và commit, ghi lại thời điểm xuất database.
- Tạm dừng ghi dữ liệu; trong DBeaver nhấp phải database `ctdt_management` → Tools → Backup/Dump database (tên tùy phiên bản/driver). Xuất toàn bộ cấu trúc + dữ liệu + view + trigger; giữ cả bảng `migrations`. Nếu có routine/event thì xuất kèm. Không chọn chỉ Data Transfer các bảng vì có thể thiếu view/trigger.
- DBeaver cần native client: cài MariaDB client, chọn Local Client/Client Home đúng bản cài; Windows thường là thư mục cài MariaDB có `bin/mariadb-dump.exe`, Linux dùng client trong `/usr/bin`. Đọc log export để xác nhận thành công.
- Gửi dump riêng trong nhóm, KHÔNG commit dump đầy đủ lên GitHub: dump chứa dữ liệu cá nhân, password hash, session/reset-token metadata. Không gửi `.env` thật. Người nhận dùng JWT secret mới.
- Nếu cần tải tài liệu đã upload: gửi kèm `03_SourceCode/backend/storage/`, giữ nguyên cấu trúc. Nếu máy bàn giao dùng `PROGRAM_UPLOAD_DIR` riêng, chuyển đúng dữ liệu của thư mục đó và cấu hình tương ứng trên máy nhận.
- Gửi riêng tài khoản test và mật khẩu HIỆN TẠI sau lần đổi mật khẩu. Tài khoản MariaDB khác tài khoản đăng nhập website.

Bản sao sau bài test CTĐT đã kiểm tra có `test.ctdt.01`, `thuan`, `TEST_MIT_01`, phiên bản `TEST-MIT-2026-v1` đã PUBLISHED. Chúng không tự có từ Git; chỉ có nếu nằm trong dump được bàn giao.

## 2. Công cụ trên máy nhận

- Git, Node.js/npm. Môi trường đã dùng để test: Node 24.21.0 (xem `.nvmrc` ở gốc).
- MariaDB Server và client; môi trường nguồn là MariaDB 11.8.6. Dùng cùng dòng 11.8 để giảm khác biệt CHECK/trigger/view.
- DBeaver để restore và đối chiếu, VS Code nếu cần.
- Chọn chạy Windows native hoặc WSL nhất quán. Không copy `node_modules` giữa hai môi trường. DBeaver không thay thế MariaDB Server.
- Cổng DB không bắt buộc giống nguồn. Hai file env mẫu cùng dùng 3307; MariaDB máy nhận thường dùng 3306. Sửa CẢ backend và frontend theo cổng thật.
- `ctdt-mariadb-dev` là service riêng của máy nguồn, không được tạo bởi clone. Windows bật service MariaDB đã cài trong Services; Ubuntu dùng service đã cài thực tế (`mariadb` hoặc service riêng).

## 3. Clone đúng code

```bash
git clone https://github.com/CNPM-Nhom04/CNPM.Nhom04.git
cd CNPM.Nhom04
git switch main
git pull --ff-only origin main
git rev-parse --short HEAD
```

Đối chiếu commit với người bàn giao. Nếu dùng feature branch chưa merge, switch đúng branch được chỉ định. Các lệnh terminal tiếp theo ghi rõ thư mục làm việc; mở thêm terminal mới ở thư mục gốc repo khi cần.

## 4. Restore database trước khi chạy ứng dụng

1. Bật MariaDB. DBeaver → New Connection → MariaDB; host `127.0.0.1`, port thực tế (3306 hoặc 3307), tài khoản quản trị database do máy nhận cấu hình → Test Connection.
2. Dùng database test riêng `ctdt_management`. Nếu đã có dữ liệu cần giữ, backup trước; restore có thể ghi đè. Không trỏ vào database dùng chung đang làm việc.
3. Trong DBeaver nhấp phải database/kết nối phù hợp → Tools → Restore/Execute script, chọn dump được bàn giao. Dùng native client và kiểm tra log hoàn thành. Tên menu tùy driver; native restore xử lý DELIMITER cho trigger tốt hơn chạy từng câu bằng Ctrl+Enter.
4. Dump có thể chứa CREATE DATABASE/USE và DEFINER của view/trigger. Kiểm tra tên database đích trước khi chạy; nếu lỗi DEFINER/quyền, nhờ người bàn giao xuất bản portable hoặc người quản trị restore với definer hợp lệ. Không bỏ qua lỗi rồi chạy app trên schema thiếu view/trigger.
5. Refresh Tables và Views. Kiểm tra có `users`, `program_versions`, `migrations`, `vw_user_program_access`, `vw_user_student_access`, `vw_student_curriculum`.
6. Trong `migrations` dự kiến có 8 migration sau bộ bài test hiện tại. Trong `users` có hai tài khoản thử, `program_versions` có bản thử PUBLISHED. Dữ liệu có thể thay đổi theo thời điểm dump.
7. Tạo tài khoản kết nối DB local cho ứng dụng hoặc dùng tài khoản local đã được cấp. Migration cần quyền DDL/view/trigger; runtime cần quyền dữ liệu phù hợp. Tài khoản/mật khẩu DB do máy nhận quản lý, không tự được tạo từ dump business database.

KHÔNG chạy lại `backend/src/core/database/CSDL.sql` sau restore: file gốc có DROP DATABASE và hướng dẫn chạy theo khối. SQL gốc không chứa dữ liệu vừa test. Nếu không có dump, chỉ có thể khởi tạo dữ liệu gốc theo các khối trong file rồi chạy migration; dữ liệu và tài khoản sẽ không giống bản hiện tại.

## 5. Backend: env, thư viện, migration

Từ gốc repo:

```bash
cd 03_SourceCode/backend
```

Tạo `.env` từ `.env.example` một lần (không ghi đè cấu hình đã dùng):

PowerShell:
```powershell
Copy-Item .env.example .env
```

WSL/bash:
```bash
cp .env.example .env
```

Sửa `backend/.env` bằng thông tin DB máy nhận:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=ctdt_dev
DB_PASSWORD=MAT_KHAU_DB_LOCAL
DB_DATABASE=ctdt_management
PORT=3002
JWT_SECRET=CHUOI_NGAU_NHIEN_RIENG_CUA_MAY_NHAN
FRONTEND_URL=http://localhost:3000
```

Nếu DB ở 3306 hoặc dùng user khác, thay đúng. Sinh JWT secret rồi dán kết quả vào env:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm ci
npm run migration:run
npm run build
```

`npm ci` phải cài cả dev dependencies vì Nest CLI/TypeORM TS dùng chúng. Không cần cài Nest CLI global. Không dùng `npm ci --omit=dev` trong quy trình test này.

Migration chỉ chạy những bản chưa ghi trong `migrations`. Nếu restore schema mới mà bỏ bảng `migrations`, sẽ có thể gặp lỗi bảng đã tồn tại: restore đúng bộ backup, không tự xóa bảng hoặc sửa lịch sử migration để né lỗi.

## 6. Frontend: env và Prisma Client

Mở terminal mới từ gốc repo:

```bash
cd 03_SourceCode/frontend
```

Copy `.env.example` thành `.env` bằng PowerShell hoặc bash như bước backend. Điền:

```dotenv
DATABASE_URL="mysql://ctdt_dev:MAT_KHAU_DB_LOCAL@127.0.0.1:3307/ctdt_management"
BACKEND_API_URL=http://127.0.0.1:3002
```

Host/port/user/password/database phải trỏ cùng DB backend. Password có ký tự đặc biệt cần percent-encode khi đưa vào DATABASE_URL; backend DB_PASSWORD vẫn là mật khẩu gốc. Không thêm NEXT_PUBLIC_ cho biến kết nối DB/JWT. Next có thể nạp `.env.local` ưu tiên hơn `.env`; kiểm tra file cũ nếu kết nối sai. Prisma CLI đọc `.env` qua prisma.config.ts nên không chỉ đặt DATABASE_URL trong `.env.local`.

```bash
npm ci
npx prisma generate
npm run build
```

Prisma Client là mã sinh trên máy nhận, không gửi `node_modules` từ máy nguồn. KHÔNG chạy `prisma db push`, `prisma migrate reset`, hoặc tạo migration Prisma: dự án dùng SQL và TypeORM migrations để quản lý database.

## 7. File upload và khởi động

Nếu có bộ tài liệu đi kèm, copy vào `backend/storage/` trước khi test tải file. DB chứa metadata không đồng nghĩa có nội dung file trên máy nhận.

Terminal 1, tại `03_SourceCode/backend`:
```bash
npm run start:dev
```

Terminal 2, tại `03_SourceCode/frontend`:
```bash
npm run dev
```

Giữ hai terminal chạy, MariaDB cũng phải đang bật.

- Đăng nhập: http://localhost:3000/dang-nhap
- Swagger: http://localhost:3002/api
- Dùng `localhost` nhất quán trên browser. Nếu đổi frontend sang 3001, đổi FRONTEND_URL sang http://localhost:3001 và khởi động lại backend. Backend vẫn 3002.
- Nếu Next báo có server cùng repo đang chạy thì dùng server đó hoặc dừng bằng Ctrl+C ở terminal sở hữu rồi chạy lại. Không khởi động trùng.

## 8. Kiểm tra bàn giao

1. Đăng nhập Admin bằng tài khoản và mật khẩu hiện tại được gửi riêng. JWT secret mới nên không dùng lại cookie cũ; dùng cửa sổ ẩn danh.
2. Danh mục chung khớp 3 bảng `education_levels`, `organizational_units`, `knowledge_blocks`.
3. Cấu hình khớp khóa `training.*` trong `system_settings`; thiếu khóa thì code hiện trả mặc định, không khẳng định mọi số đều đã có bản ghi SQL.
4. `test.ctdt.01`: không vào được `/dashboard/admin/nguoi-dung`, chỉ thấy CTĐT trong phạm vi CNTT.
5. Mở bản thử `TEST-MIT-2026-v1`: PUBLISHED; NC có 14 môn và nhóm 9/24/12/15; UD có 17 môn và nhóm 9/36/6/9. Không sửa được bản ban hành.
6. `thuan`: xem lượt cũ RETURNED và lượt mới APPROVED của bản thử. Dữ liệu chỉ khớp nếu snapshot được xuất sau bước test này.
7. Xuất báo cáo Excel, tải tài liệu nếu có.
8. Hai trang đăng ký học phần hiện còn dữ liệu mẫu; không xem đó là lỗi restore hoặc khẳng định đã nối API.

Mật khẩu app hiện tại không lấy ngược từ password_hash. Không tự đặt lại mật khẩu hàng loạt trên SQL. Nếu tài khoản cần đổi mật khẩu lần đầu thì làm trên giao diện.

## 9. SMTP và kiểm tra mã nguồn (khi cần)

SMTP không bắt buộc để boot/đăng nhập. Muốn test quên mật khẩu: điền SMTP_HOST/PORT/SECURE/USER/PASS/FROM trong backend/.env bằng thông tin được cấp riêng, rồi tại backend chạy:

```bash
npm run check:smtp
```

Dùng email thật thuộc quyền quản lý của người test; email example.com của tài khoản thử không nhận thư. Không commit mật khẩu ứng dụng Gmail.

Kiểm tra code tại backend:
```bash
npm test -- --runInBand
npm run lint
```

Frontend:
```bash
npm run lint
```

Các script integration/browser có thể ghi SQL: không chạy tùy tiện trên bản bàn giao; đọc README module và dùng clone database riêng. Playwright/browser là công cụ bổ sung cho bài test browser, không cần để test giao diện thủ công.

## 10. Các lần chạy sau và xử lý lỗi

- Hằng ngày: bật MariaDB → start backend → start frontend. Không restore lại mỗi lần vì sẽ mất thay đổi local.
- Code cập nhật: giữ working tree sạch, pull đúng branch; `npm ci` khi lockfile thay đổi, `npm run migration:run` khi có migration mới, `npx prisma generate` khi cần sinh lại client. Dừng server trước build, restart sau sửa env.
- `nest: not found`: tại backend chạy `npm ci`, đảm bảo dev dependencies được cài.
- Access denied/ECONNREFUSED: kiểm tra service DB, user/password, host/port; frontend và backend phải cùng database.
- Table/view không tồn tại: kiểm tra restore log và migration, không nhập chồng SQL gốc lên database đang dùng.
- Sai mật khẩu website: dùng mật khẩu mới nhất của snapshot, không dùng mật khẩu MariaDB; kiểm tra account_status/locked_until nếu bị khóa.
- Upload tải lỗi: kiểm tra file storage và PROGRAM_UPLOAD_DIR.
- Hiện sai dữ liệu sau restore: Refresh DBeaver, kiểm tra filter, DATABASE_URL/.env.local, DB_* backend và đúng commit.

.env, .env.local, node_modules, dist, .next và storage được bỏ qua có chủ đích. Code + lockfile + env mẫu + migrations cần commit; database và tài liệu thật chuyển riêng. Không dùng Dockerfile/Compose trống để chạy bộ test này.
