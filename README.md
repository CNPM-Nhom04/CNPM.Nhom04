# CNPM.Nhom04

> **Hệ thống quản lý đào tạo sau đại học**  
> Software Engineering Project — Nhóm 04

---

## 1. Thông tin dự án
| Thông tin | Chi tiết |
|---|---|
| Nhóm | **Nhóm 04** |
| Dự án | **Hệ thống quản lý đào tạo sau đại học** |
---

## 2. Thành viên nhóm

| STT | MSSV | Họ và tên | Vai trò |
|:---:|:---:|---|---|
| 1 | DPM235492 | **Trần Minh Trường** | Product Owner / Team Lead |
| 2 | DPM235424 | **Nguyễn Đức Huy** | Frontend Developer |
| 3 | DPM235505 | **Nguyễn Lê Thành Đạt** | Frontend Developer |
| 4 | DPM235486 | **Nguyễn Văn Thuận** | Backend Developer |
| 5 | DPM235509 | **Nguyễn Hoàng Kha** | Backend Developer |
| 6 | DPM235464 | **Trương Kiều Phong** | DevOps / Cloud Engineer |
| 7 | DPM235479 | **Nguyễn Văn Thắng** | DevOps / Cloud Engineer |
| 8 | DPM235480 | **Diệp Hoàng Thành** | QA / Security & Data Specialist |
| 9 | DPM235506 | **Trần Thị Phương Dung** | QA / Security & Data Specialist |

## 3. Liên kết hệ thống
* 🌐 **Mã nguồn (Source Code):** [CNPM-Nhom04/CNPM.Nhom04](https://github.com/CNPM-Nhom04/CNPM.Nhom04)

## 4. Clone và chạy test trên máy khác

Xem [hướng dẫn cài đặt và bàn giao dữ liệu](docs/LOCAL_TEST_SETUP.md) để chuẩn bị MariaDB, phục hồi database, cấu hình env, cài thư viện và chạy NestJS/Next.js. Chỉ clone Git không chuyển dữ liệu vừa test hoặc file upload.

Nếu backend chạy trong Ubuntu/WSL, dùng [quy trình WSL từ cài đặt đến chạy test](docs/WSL_TEST_SETUP.md). Hướng dẫn tạo database và user ứng dụng riêng để tránh lỗi root/Unknown database.

## 5. Bố cục và kiểm chứng bàn giao

| Nhóm | Nội dung |
|---|---|
| [01_Requirements](01_Requirements/README.md) | Phạm vi và yêu cầu chức năng hiện có |
| [02_Design](02_Design/README.md) | Kiến trúc, quyền và liên kết dữ liệu |
| [03_SourceCode](03_SourceCode) | Backend NestJS, frontend Next.js và tài liệu module |
| [04_Infrastructure](04_Infrastructure/docker/README.md) | Docker dev/staging/production |
| [05_Testing](05_Testing/README.md) | Test, coverage, audit và hồi quy QA |
| [06_Documentation](06_Documentation/README.md) | Chỉ mục cài đặt và bàn giao |

Các tài liệu cũ trong `docs/` và dữ liệu nguồn AGU trong `artifacts/` giữ đường dẫn hiện có. CI bao gồm frontend tests, backend coverage, audit Critical/High và HTTP integration trên MariaDB riêng. Không dùng database đào tạo thật để chạy bộ test ghi dữ liệu.
