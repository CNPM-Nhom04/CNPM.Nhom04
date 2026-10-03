# Hướng Dẫn Cài Đặt và Chạy Dự Án (dành cho Lập trình viên)

Tài liệu này hướng dẫn cách setup môi trường code chuẩn nhất bằng WSL (Ubuntu) và Docker trên máy tính cá nhân.
Mọi người trong nhóm bắt buộc làm theo để không bị lỗi linh tinh khi code nhé!

## 1. Yêu cầu Cài đặt
1. **WSL2 & Ubuntu:** Cài đặt bằng cách mở PowerShell (Quyền Admin) và gõ `wsl --install`. Khởi động lại máy.
2. **Docker Desktop:** Tải từ trang chủ Docker và cài đặt. Nhớ vào Settings > Resources > WSL Integration và bật công tắc cho Ubuntu.
3. **VS Code:** Trình biên dịch chính. Cài đặt thêm extension "WSL" của Microsoft.
4. **Git:** Cài đặt Git bên trong Ubuntu bằng lệnh `sudo apt update && sudo apt install git`.

## 2. Cách Clone Code Về Máy
**KHÔNG** clone code ra ổ C: hay D: của Windows. Phải clone vào thư mục gốc của Ubuntu.
1. Mở Ubuntu Terminal lên.
2. Tạo thư mục làm việc (nếu chưa có):
   ```bash
   mkdir -p ~/projects
   cd ~/projects
   ```
3. Lấy code từ Github về:
   ```bash
   git clone <link_github_của_dự_án>
   cd ctdt-system
   ```
4. Mở thẳng VS Code từ đây:
   ```bash
   code .
   ```
   *(VS Code sẽ tự động cài extension "WSL" để kết nối vào môi trường Linux).*

## 3. Khởi chạy dự án ở môi trường Phát triển (Local Development)

### Chạy Backend (NestJS)
```bash
cd 03_SourceCode/backend
npm install
npm run start:dev
```
Backend sẽ chạy tại: `http://localhost:3000`

### Chạy Frontend (Next.js)
```bash
cd 03_SourceCode/frontend
npm install
npm run dev
```
Frontend sẽ chạy tại: `http://localhost:3001` (hoặc cổng mà Next.js tự chọn).

## 4. Ghi chú về Môi trường (.env)
- Đừng quên copy file `.env.example` thành `.env` trong cả 2 thư mục backend và frontend.
- Cập nhật các thông tin Database, API Keys vào file `.env` theo môi trường máy của bạn.

## 5. Cấu trúc thư mục & Ý nghĩa từng File
Để team làm việc không bị nhầm lẫn, dưới đây là chi tiết chức năng của các thư mục và file quan trọng trong dự án:

### 1️⃣ Thư mục `.github/` (Tự động hóa CI/CD)
Khu vực này do DevOps/Tech Lead quản lý. Các Developer bình thường không cần sửa vào đây.
- `workflows/ci-backend.yml`: Kịch bản tự động test (Kiểm tra lỗi) cho code Backend mỗi khi có code mới.
- `workflows/ci-frontend.yml`: Kịch bản tự động test cho code Giao diện (Frontend).
- `workflows/cd-production.yml`: Kịch bản tự động đẩy code lên máy chủ thật khi dự án hoàn thành.
- `workflows/cd-staging.yml`: Kịch bản tự động đẩy code lên máy chủ nháp để thầy cô/team test thử.

### 2️⃣ Thư mục `01_Requirements/` & `02_Design/`
- Nơi lưu trữ các tài liệu word, hình ảnh, file PDF yêu cầu đề tài của giáo viên.
- Chứa các link thiết kế Figma, Sơ đồ cơ sở dữ liệu (Database Schema).

### 3️⃣ Thư mục `03_SourceCode/` (Khu Vực Cốt Lõi)
Đây là nơi anh em Dev sẽ làm việc 99% thời gian.
- **`backend/`**:
  - Là mã nguồn API viết bằng **NestJS**. (Chịu trách nhiệm xử lý logic, kết nối CSDL).
  - `package.json`: Danh sách các thư viện cần dùng cho backend.
  - `.env.example`: File mẫu chứa các cấu hình kết nối DB (Team Backend phải tạo file `.env` thật từ file này).
- **`frontend/`**:
  - Là mã nguồn Giao diện viết bằng **Next.js**. (Chịu trách nhiệm hiển thị trang web).
  - `package.json`: Danh sách thư viện giao diện.

### 4️⃣ Thư mục `04_Infrastructure/` (Hạ tầng Máy Chủ)
Khu vực cấu hình hệ thống khi đưa lên mạng (DevOps quản lý).
- `docker/docker-compose.yml`: Bật database môi trường code (local) cho team.
- `docker/docker-compose.prod.yml`: Khởi chạy hệ thống trên máy chủ thật.
- `nginx/`: Cấu hình máy chủ web, điều hướng người dùng vào frontend/backend.

### 5️⃣ Thư mục `05_Testing/` & `06_Documentation/`
- `05_Testing/`: Chứa file Postman Collection để test API hoặc các kịch bản test.
- `06_Documentation/`: Chứa các tài liệu hướng dẫn (ví dụ như chính file Hướng dẫn cài đặt này).

### 6️⃣ Các File Cấu Hình Ở Ngoài Cùng (Root)
- `.gitignore`: Danh sách các file/thư mục CẤM đẩy lên Github (ví dụ: `node_modules`, `.env`).
- `.editorconfig`: Ép buộc mọi người dùng chung một chuẩn thụt lề (2 dấu cách) để code không bị xô lệch giữa các máy.
