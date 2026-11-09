# Docker dev, staging và production

Yêu cầu Docker Engine/Desktop có tích hợp WSL nếu chạy trong Ubuntu/WSL, cùng Compose v2. Tất cả lệnh dưới đây chạy tại gốc repository. Build image cần mạng để tải npm package/Prisma engine và font của frontend. Không có secret được COPY vào image; `.dockerignore` loại env, dump, uploads và node_modules.

```bash
cp 04_Infrastructure/docker/.env.example 04_Infrastructure/docker/.env
```

Điền DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET và BOOTSTRAP_ADMIN_PASSWORD riêng. DB_PASSWORD_URLENCODED là cùng DB_PASSWORD nhưng mã hóa cho URL; nếu chỉ chữ/số thì giống nguyên bản. Không dùng secret mẫu cho triển khai. APP_ORIGIN dev là `http://localhost:3000`. Có thể sinh secret bằng `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```bash
docker compose --env-file 04_Infrastructure/docker/.env -f 04_Infrastructure/docker/docker-compose.yml config --quiet
docker compose --env-file 04_Infrastructure/docker/.env -f 04_Infrastructure/docker/docker-compose.yml up -d --build
docker compose --env-file 04_Infrastructure/docker/.env -f 04_Infrastructure/docker/docker-compose.yml ps
```

Mở http://localhost:3000 và Swagger http://localhost:3002/api. DB dev chỉ publish ở 127.0.0.1:3308 để tránh 3306/3307 local. Trong container, backend/frontend đều dùng service `db:3306`; không dùng localhost để gọi container khác.

Service `init` đợi DB khỏe, bootstrap **chỉ khi schema rỗng**, rồi chạy migrations. Nó không xóa/seed lại schema có sẵn. Database mới chỉ có dữ liệu tham chiếu, đơn vị AGU và admin bắt buộc đổi mật khẩu, chưa có danh mục AGU hoặc dữ liệu bạn đã test. Username mặc định `admin`; mật khẩu là BOOTSTRAP_ADMIN_PASSWORD. Không có mật khẩu cố định trong code.

Muốn dùng dữ liệu bàn giao: khởi động riêng `db`, restore dump đầy đủ và migrations vào volume DB mới trước khi chạy các service còn lại. Không chạy SQL gốc có DROP DATABASE lên bản bàn giao. File upload phải được chuyển vào volume `documents`, hoặc mount thư mục đúng `/app/03_SourceCode/backend/storage`. Dump SQL không chứa nội dung tài liệu. Không có file thật trong image.

## Staging / production

Chuẩn bị env RIÊNG theo mẫu, đặt APP_ORIGIN đúng origin HTTPS công khai. Dùng reverse proxy HTTPS trước cổng 3000 chỉ bind loopback. Cấu hình proxy giữ Origin của browser; frontend so với APP_ORIGIN thay vì origin HTTP nội bộ. Không thêm wildcard hoặc tin mọi forwarded header.

```bash
docker compose --env-file /duong-dan-rieng/staging.env -f 04_Infrastructure/docker/docker-compose.staging.yml config --quiet
docker compose --env-file /duong-dan-rieng/staging.env -f 04_Infrastructure/docker/docker-compose.staging.yml up -d --build
```

Đổi thành `docker-compose.prod.yml` và env production khi triển khai thật. Staging/prod dùng Node production, backend đã compile, Next standalone; không chạy dev server. Tên project `ctdt-dev`, `ctdt-staging`, `ctdt-prod` tách network/volume. Chúng dùng cùng cổng host 3000 nên chạy trên máy khác hoặc điều chỉnh port khi cần chạy đồng thời. Database/backend production không publish ra host. Sao lưu volume DB/documents trước nâng cấp; `down` giữ volume, còn `down -v` xóa dữ liệu nên không dùng để cập nhật.

Compose config có thể kiểm tra không cần daemon. Build/up cần Docker Engine đang hoạt động. Khi WSL báo Docker không có, bật Docker Desktop → Settings → Resources → WSL Integration cho distro, hoặc cài Engine phù hợp; không thay bằng việc khởi động service MariaDB của máy thật.
