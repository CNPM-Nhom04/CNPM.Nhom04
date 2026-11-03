# Chạy cùng dữ liệu bàn giao bằng Ubuntu/WSL

Quy trình dành cho Windows + Ubuntu/WSL, phù hợp backend đang chạy tại `/home/thanhdat/...`. Node, source code và MariaDB Server đều chạy trong CÙNG Ubuntu. DBeaver trên Windows chỉ là công cụ xem SQL tùy chọn, không phải điều kiện để boot ứng dụng. Không làm xen kẽ hướng dẫn MariaDB Windows MSI.

## 0. Người bàn giao và kết quả kiểm tra file SQL

Cần gửi riêng `ctdt-ban-giao.sql`, tài khoản/mật khẩu website hiện tại và storage nếu có tài liệu. Không push dump hoặc .env thật. Chốt code commit đã push/merge bằng `git rev-parse --short HEAD`; working tree sạch trước khi bàn giao.

Đã phục hồi thử file `D:\Download\ctdt-ban-giao.sql` trên MariaDB 11.8.6 vào database tạm ngày 02/11/2026, sau đó xóa database tạm. Kết quả: 63 bảng, 13 view, 58 trigger, 8 migrations, view học viên truy vấn được. File KHÔNG có CREATE DATABASE/USE, vì vậy phải tạo database trước và chỉ rõ database khi import. File không có DEFINER tường minh, có chỉ thị sandbox của MariaDB nên dùng client MariaDB mới cùng dòng 11.8.

Tài khoản có trong file và đã đối chiếu nguồn: `test.ctdt.01` để test cán bộ; người thực hiện RETURN/APPROVE trên bản thử là `thuan`. `test.duyet.01` là tên đề xuất trong hướng dẫn cũ, KHÔNG có trong snapshot đã kiểm tra. `admin` và `approver.fit` có trên nguồn, chọn tài khoản hợp lệ thực sự có trong bộ bàn giao; mật khẩu phải do người bàn giao gửi riêng. Không tự suy ra mật khẩu từ mã nguồn hoặc hash.

Bản `TEST-MIT-2026-v1` đã PUBLISHED. Nếu cần snapshot sau thời điểm này, xuất lại; file cũ không tự cập nhật.

## 1. WSL/Ubuntu

Nếu đã chạy được terminal `tenuser@tenmay:~$` thì bỏ qua cài WSL. Với máy mới, PowerShell Run as Administrator:

```powershell
wsl --install -d Ubuntu-24.04
```

Khởi động lại nếu được yêu cầu, mở Ubuntu, tạo username/password Ubuntu. Mật khẩu này dùng với sudo, KHÁC mật khẩu MariaDB và tài khoản website. Nếu đã có Ubuntu, dùng distro hiện tại thay vì tạo thêm distro rồi không biết code/DB nằm đâu.

Nguồn: https://learn.microsoft.com/windows/wsl/install

## 2. Git, Node và clone (tất cả trong Ubuntu)

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential apt-transport-https
```

Nếu Ubuntu đã có `node -v` là v24.21.0 thì bỏ cài Node. Nếu chưa có, dùng nvm chính thức:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh -o /tmp/ctdt-nvm-install.sh
bash /tmp/ctdt-nvm-install.sh
source ~/.bashrc
nvm install 24.21.0
nvm use 24.21.0
node -v
npm -v
```

Nguồn: https://github.com/nvm-sh/nvm/tree/v0.40.3 . Nếu curl/install lỗi thì dừng, không chạy các bước sau với Node Windows nhầm môi trường. `which node` phải chỉ tới binary Linux, thường trong `/home/<user>/.nvm/`.

Clone mới:

```bash
mkdir -p ~/ctdt-system
cd ~/ctdt-system
git clone https://github.com/CNPM-Nhom04/CNPM.Nhom04.git
cd CNPM.Nhom04
git switch main
git pull --ff-only origin main
git rev-parse --short HEAD
```

Nếu đã clone, cd tới repo có sẵn, kiểm tra `git status`; chỉ pull khi đã xử lý thay đổi local, không git clone lồng vào repo và không reset --hard. Dùng đúng nhánh/commit bàn giao. Nếu `.nvmrc` có trong commit, các lần sau có thể dùng `nvm use` tại root repo.

## 3. MariaDB trong CÙNG Ubuntu

Nếu đã có MariaDB đang chạy và đang xử lý lỗi Access denied/Unknown database, bỏ phần cài đặt, chuyển đến bước 4. Không cài lại/nâng cấp server có dữ liệu cần giữ chỉ để theo hướng dẫn.

Máy mới chưa có MariaDB, chọn dòng 11.8 bằng script repository chính thức:

```bash
curl -fsSL https://r.mariadb.com/downloads/mariadb_repo_setup -o /tmp/ctdt-mariadb-repo-setup.sh
sudo bash /tmp/ctdt-mariadb-repo-setup.sh --mariadb-server-version=mariadb-11.8 --skip-maxscale --skip-tools
sudo apt update
sudo apt install -y mariadb-server mariadb-client
sudo service mariadb start
sudo mariadb -e "SELECT VERSION(), @@port;"
```

Chỉ dùng trên Ubuntu được MariaDB hỗ trợ, ví dụ Ubuntu 24.04. Nếu script báo distro không được hỗ trợ hoặc apt lỗi thì dừng và kiểm tra, không bypass kiểm tra phiên bản. Nguồn: https://mariadb.com/docs/server/server-management/install-and-upgrade-mariadb/mariadb-package-repository-setup-and-usage .

Kết quả mong muốn: MariaDB 11.8.x, cổng 3306. Nếu cổng khác thì thay thống nhất bước kiểm tra, backend.env, frontend.env. Không dùng `ctdt-mariadb-dev`: đó là service riêng trên máy nguồn, không có sau clone. Nếu systemd đang bật cũng có thể dùng `sudo systemctl start mariadb`.

## 4. Tạo database TRƯỚC KHI import

```bash
sudo mariadb
```

Tại dấu nhắc `MariaDB [(none)]>`:

```sql
CREATE DATABASE IF NOT EXISTS ctdt_management
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES LIKE 'ctdt_management';
EXIT;
```

Phải thấy tên database. Nếu server này đã có database chứa dữ liệu quan trọng, backup trước và thống nhất nơi restore; dump có DROP TABLE nên có thể thay thế dữ liệu cũ. Không nhập vào database chung/production.

Đây là bước khắc phục lỗi ERROR 1049 Unknown database. GRANT không tự tạo database.

## 5. Nhập file SQL trên đúng MariaDB này

Cách dễ nhất không phải nhớ tên user/ổ đĩa: trong Ubuntu tạo thư mục nhận file và mở Explorer:

```bash
mkdir -p ~/ctdt-handoff
cd ~/ctdt-handoff
explorer.exe .
```

Trong cửa sổ Explorer vừa mở, dán file `ctdt-ban-giao.sql` đã nhận vào đó. Quay lại Ubuntu:

```bash
ls -lh ~/ctdt-handoff/ctdt-ban-giao.sql
sudo mariadb ctdt_management < ~/ctdt-handoff/ctdt-ban-giao.sql
```

Chỉ cần import MỘT lần theo đường dẫn này; phần sau là cách khác nếu file còn trên ổ Windows, không chạy import hai lần.

Ví dụ người nhận lưu file ở `D:\Download\ctdt-ban-giao.sql`, Ubuntu nhìn thấy tại `/mnt/d/Download/ctdt-ban-giao.sql`. Đường dẫn phải theo MÁY NGƯỜI NHẬN. Nếu ở Downloads của Windows user khác thì dùng `/mnt/c/Users/<ten-user>/Downloads/ctdt-ban-giao.sql`.

Trong Ubuntu:

```bash
ls -lh /mnt/d/Download/ctdt-ban-giao.sql
sudo mariadb ctdt_management < /mnt/d/Download/ctdt-ban-giao.sql
```

Nếu đường dẫn có dấu cách phải bọc trong nháy kép. Lệnh import thành công thường không in gì; nếu có ERROR thì dừng và xử lý trước, không dùng `--force` bỏ qua lỗi. Không chạy lại SQL gốc `src/core/database/CSDL.sql` sau bước này.

Kiểm tra:

```bash
sudo mariadb ctdt_management -e "SHOW TABLES; SELECT COUNT(*) AS migrations FROM migrations; SELECT version_code,status FROM program_versions WHERE version_code='TEST-MIT-2026-v1';"
```

Cần thấy 8 migrations và bản thử PUBLISHED với snapshot đã kiểm tra. Quyền/tài khoản MariaDB không đi theo dump business database.

## 6. Tạo user cho ứng dụng (không dùng root trong backend)

```bash
sudo mariadb
```

```sql
CREATE USER 'ctdt_app'@'127.0.0.1'
IDENTIFIED BY 'THAY_BANG_MAT_KHAU_RIENG';
GRANT ALL PRIVILEGES ON ctdt_management.*
TO 'ctdt_app'@'127.0.0.1';
EXIT;
```

Thay chuỗi mẫu bằng mật khẩu riêng; chọn chữ/số đủ dài dễ nhập cho local test, không gửi qua chat/Git. Quyền cấp giới hạn trong database dự án; dùng để migration và test local. Không dùng mật khẩu mẫu trong tài liệu làm mật khẩu thật.

Nếu user đã tạo trước đó và biết mật khẩu, bỏ CREATE USER, dùng user đó. Nếu báo user đã tồn tại thì dừng kiểm tra, không tự ALTER/reset tài khoản đang dùng.

Kiểm tra TCP cùng đường kết nối backend:

```bash
mariadb --protocol=TCP -h 127.0.0.1 -P 3306 -u ctdt_app -p ctdt_management
```

Nhập password vừa đặt, phải thấy `MariaDB [ctdt_management]>`. Chạy `SHOW TABLES;`, sau đó `EXIT;`. Nếu chỉ vào được `sudo mariadb` mà TCP báo Access denied thì chưa được chạy backend. `root` trên Ubuntu có thể xác thực Unix socket; không cần sửa cơ chế xác thực root.

## 7. Backend env và dependencies

```bash
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/backend
```

Nếu chưa có `.env`, copy một lần:

```bash
cp .env.example .env
nano .env
```

Có thể sửa bằng VS Code WSL thay nano. Không ghi đè env đã cấu hình. Điền đúng:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=ctdt_app
DB_PASSWORD=MAT_KHAU_VUA_TAO
DB_DATABASE=ctdt_management
PORT=3002
JWT_SECRET=CHUOI_NGAU_NHIEN_RIENG
FRONTEND_URL=http://localhost:3000
```

JWT secret lấy từ kết quả lệnh sau, dán vào env:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Nano: Ctrl+O, Enter để lưu; Ctrl+X để thoát. Giữ các biến SMTP trống nếu chưa test email.

```bash
npm ci
npm run migration:run
npm run build
npm run start:dev
```

Không dùng sudo npm, không cài Nest CLI global. Giữ terminal backend chạy; mở http://localhost:3002/api để kiểm tra. Nếu migration gặp table already exists, kiểm tra snapshot có đủ migrations, không xóa bảng né lỗi.

## 8. Frontend (terminal Ubuntu mới)

```bash
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/frontend
```

Nếu chưa có `.env`:

```bash
cp .env.example .env
nano .env
```

```dotenv
DATABASE_URL="mysql://ctdt_app:MAT_KHAU_VUA_TAO@127.0.0.1:3306/ctdt_management"
BACKEND_API_URL=http://127.0.0.1:3002
```

Phải cùng user/password/host/port/database với backend. Mật khẩu có ký tự đặc biệt cần percent-encode ở URL (DB_PASSWORD vẫn giữ mật khẩu gốc). `.env.local` cũ có thể ghi đè Next; sửa cho đồng bộ nếu có. Prisma CLI đọc `.env` nên không chỉ điền `.env.local`.

```bash
npm ci
npx prisma generate
npm run build
npm run dev
```

Không chạy Prisma db push/reset/migrate vì database do SQL + TypeORM quản lý. Không copy node_modules từ Windows sang WSL. Không build khi dev server đang dùng cùng thư mục output.

## 9. DBeaver trên Windows (tùy chọn để xem bảng)

Không cần DBeaver để chạy hai ứng dụng; import đã thực hiện bằng MariaDB client Ubuntu.

Nếu Windows chưa có MySQL/MariaDB chiếm cổng 3306, kết nối tới WSL qua localhost forwarding: New Connection → MariaDB, host 127.0.0.1, port 3306, database ctdt_management, user ctdt_app, mật khẩu mới → Test Connection → Download driver nếu được hỏi → Finish.

Nếu Windows cũng có MariaDB/MySQL trên cổng 3306, localhost có thể trỏ tới server Windows khác. Kiểm tra/dừng service Windows không dùng trước (chỉ khi không ảnh hưởng công việc), hoặc thống nhất đổi cổng cấu hình riêng. Không mở quyền root từ xa hay bind 0.0.0.0 chỉ để chữa nhầm server. Nếu kết nối tới WSL bị nhận là host khác 127.0.0.1, cần kiểm tra mạng WSL cụ thể, không cấp user@'%' tùy tiện.

Các bảng để kiểm tra: users (tài khoản test), program_versions (bản thử), approval_requests/actions (hai lượt), curriculum_groups/courses (cấu trúc).

## 10. File upload, SMTP và bài kiểm tra cuối

- Nếu có tài liệu: copy storage vào backend/storage hoặc cấu hình PROGRAM_UPLOAD_DIR đúng. DB chỉ lưu metadata nên import SQL không khôi phục nội dung tệp.
- Đăng nhập http://localhost:3000/dang-nhap, user `test.ctdt.01`, mật khẩu hiện tại từ người bàn giao.
- Không vào được Admin, chỉ thấy CTĐT trong scope; bản `TEST-MIT-2026-v1` PUBLISHED, không sửa được, NC 14 môn/nhóm 9-24-12-15, UD 17 môn/nhóm 9-36-6-9.
- Người duyệt thực tế của bài test là `thuan`; dùng đúng tài khoản đã bàn giao để xem RETURNED và APPROVED. Không tự đổi scope/role để demo, chỉ đối chiếu quyền SQL hiện tại.
- Export báo cáo Excel phải mở được. Tài liệu chỉ tải được nếu đã chuyển file storage.
- SMTP chỉ cần cho email: cấu hình riêng backend/.env, chạy npm run check:smtp. example.com không nhận mail. Không cần SMTP để đăng nhập/xem CTĐT.
- Hai trang dang-ky-hoc-phan và sinh-vien/dang-ky còn dữ liệu mẫu, chưa phải luồng API hoàn thành.

## 11. Mỗi lần test sau

Terminal Ubuntu 1:

```bash
sudo service mariadb start
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/backend
npm run start:dev
```

Terminal Ubuntu 2:

```bash
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/frontend
npm run dev
```

Không import lại snapshot mỗi lần. Không cần npm ci mỗi lần nếu dependencies không đổi. Sau pull, chạy migration khi có migration mới, generate khi cần; restart server sau sửa env.

## 12. Nếu lỗi thì dừng đúng bước

| Lỗi | Kiểm tra |
|---|---|
| Connection refused | Service MariaDB chưa chạy/sai port/nhầm Windows với WSL |
| Access denied root | Dùng ctdt_app TCP, không thay root socket auth |
| Access denied ctdt_app | Password + account host 127.0.0.1 + đúng server |
| Unknown database | Tạo database bước 4, import bước 5 trên cùng server |
| Unknown table/view | Dump import chưa đủ, xem lỗi import và migrations |
| Nest not found | npm ci trong backend, không omit dev dependencies |
| Prisma Client chưa sinh | .env frontend đúng, npm ci rồi npx prisma generate |
| Login không nhận password | Mật khẩu app của thời điểm dump khác password DB và password Ubuntu |
| DBeaver lỗi khởi động | Chưa ảnh hưởng MariaDB/Node; vẫn có thể import/chạy bằng terminal |
| Next báo server đã chạy | Dùng server cũ hoặc Ctrl+C ở terminal sở hữu trước khi chạy lại |

Không thể bảo đảm mọi máy không lỗi; mỗi checkpoint phải qua trước khi làm tiếp. Bản dump đã được xác minh bằng restore thật, còn cài mới WSL trên máy người nhận cần xác nhận theo môi trường thực tế.
