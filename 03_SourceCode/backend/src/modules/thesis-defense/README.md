# Bảo vệ luận văn / luận án

Module NestJS cho trang frontend/app/dashboard/bao-ve-luan-van/page.tsx.
Cấu trúc theo module hiện có:

- domain: hợp đồng dữ liệu và DefenseRepository;
- application: DTO validation và ThesisDefenseService;
- infrastructure: truy vấn MySQL/MariaDB, transaction và ghi audit;
- presentation: controller REST và guard phân quyền.

Repository truy vấn các bảng hiện có bằng TypeORM DataSource; không tạo lại entity
students/programs. Bảng thesis_defenses được quản lý bằng migration, synchronize vẫn tắt.

## Chạy local (WSL/bash)

Backend:

```bash
cd 03_SourceCode/backend
npm install
npm run migration:run
PORT=3002 npm run start:dev
```

Database phải có schema CSDL.sql và cấu hình DB_* trong backend/.env.
Migration đã chạy trên database local trong phiên làm việc này.

Frontend: cấu hình frontend/.env.local:

```dotenv
BACKEND_API_URL=http://127.0.0.1:3002
```

Đây là URL NestJS nhìn từ server Next.js. Trong Docker dùng hostname service backend.

```bash
cd 03_SourceCode/frontend
npm run dev -- --port 3000
```

Mở http://localhost:3000/dang-nhap?next=/dashboard/bao-ve-luan-van.
Đăng nhập bằng tài khoản hệ thống đã được gán ADMIN, TRAINING_OFFICER hoặc APPROVER.
JWT lưu trong cookie HttpOnly; Route Handler Next.js chuyển tiếp JWT đến NestJS,
không cần bật CORS. Không thay mật khẩu hoặc tự nâng quyền tài khoản hiện có.

## Phân quyền

Vai trò được kiểm tra trực tiếp từ users/user_roles/roles, không tin role trong JWT.
Tài khoản bị vô hiệu hóa hoặc xóa mềm không được truy cập.

- ADMIN: xem, lập lịch, ghi kết quả toàn hệ thống.
- TRAINING_OFFICER: xem, lập lịch và ghi kết quả trong phạm vi được gán.
- APPROVER: xem và ghi kết quả trong phạm vi; không lập lịch.
- Các vai trò khác: HTTP 403.

Phạm vi lấy từ user_scopes: GLOBAL, PROGRAM, MAJOR, ORG_UNIT.
ORG_UNIT bao gồm đơn vị con qua organizational_unit_closure.
Cán bộ/hội đồng chưa được gán phạm vi sẽ nhận danh sách rỗng; truy cập ID ngoài
phạm vi trả 404. Frontend ẩn/khóa thao tác theo permissions trong response danh sách.

## API NestJS

Swagger tại http://localhost:3002/api. Mọi API cần Authorization: Bearer <JWT>.

| Method | URL                          | Chức năng                            |
| ------ | ---------------------------- | ------------------------------------ |
| GET    | /bao-ve-luan-van             | Danh sách, tìm kiếm, lọc, phân trang |
| GET    | /bao-ve-luan-van/hoc-vien    | Tìm học viên đủ điều kiện lập lịch   |
| GET    | /bao-ve-luan-van/:id         | Chi tiết hội đồng và điểm            |
| POST   | /bao-ve-luan-van             | Lập lịch                             |
| POST   | /bao-ve-luan-van/:id/ket-qua | Ghi điểm một lần                     |

Danh sách nhận searchTerm (mã HV/tên/đề tài), selectedStatus (ALL, CHO_BAO_VE,
DA_DAT, CHUA_DAT), page (mặc định 1), limit (mặc định 20, tối đa 100).
Response: { data, meta: { page, limit, total, totalPages }, permissions: { canSchedule, canRecord } }.

API học viên nhận searchTerm (mã/tên), page, limit, trả { data, meta }.
Học viên phải ACTIVE, có gán CTĐT ACTIVE, hướng học ACTIVE, thuộc bậc có level_code
MASTER, PHD, DOCTOR hoặc DOCTORATE và chưa có lịch CHO_BAO_VE.
Database hiện có bậc MASTER; không thêm giả học viên/bậc Tiến sĩ.

Payload lập lịch:

```json
{
  "maHocVien": "MA_HOC_VIEN_CO_TRONG_DATABASE",
  "tenDeTai": "Ứng dụng học máy trong dự báo",
  "ngayBaoVe": "2026-10-27",
  "diaDiem": "Phòng họp 302",
  "chuTichHoidong": "PGS.TS. Nguyễn Văn A",
  "phanBien": "TS. Lê Văn B",
  "thuKy": "ThS. Phạm Thị C"
}
```

phanBien và thuKy là tùy chọn. Thông tin hội đồng nhập dạng tên, không giả định
có bảng thành viên hội đồng mà schema hiện chưa có.
Họ tên/chuyên ngành lấy từ hồ sơ và phiên bản CTĐT đang gán, lưu snapshot khi tạo;
không nhận hai thông tin này từ dữ liệu người dùng tự nhập.
Tên đề tài nhập theo form, chưa liên kết với module đề tài/luận văn riêng.

Mỗi học viên chỉ có 1 lịch chờ; unique generated key ngăn cả request đồng thời.
Ngày hợp lệ có dạng YYYY-MM-DD. Cho nhập lịch quá khứ để ghi nhận dữ liệu lịch sử.
Không kiểm tra trùng phòng theo giờ vì giao diện chỉ có ngày, chưa có giờ bắt đầu/kết thúc.

Payload ghi điểm:

```json
{ "diemTrungBinh": 8.6 }
```

Điểm là JSON number từ 0 đến 10, tối đa 2 chữ số thập phân.
Chỉ ghi từ ngày tổ chức bảo vệ, ngày hiện tại tính theo Asia/Bangkok (UTC+7).
Ngưỡng đạt 5.5 theo giao diện, lưu passing_score trên từng lịch.

- Chưa chấm: diemTrungBinh=null, trạng thái CHO_BAO_VE.
- Điểm >=5.5: DA_DAT.
- Điểm <5.5, kể cả 0: CHUA_DAT.
  Ghi kết quả một lần, khóa dòng trong transaction để ngăn ghi đồng thời.
  Sau khi có kết quả, học viên có thể được lập lịch khác; lịch cũ vẫn được giữ.
  Điểm bảo vệ không tự cập nhật bảng điểm học phần hoặc quyết định tốt nghiệp.

ID BIGINT trả string, điểm DECIMAL trả number hoặc null.
Lập lịch/ghi điểm và audit nằm cùng transaction.
Không có API sửa/xóa kết quả hoặc xóa lịch vì giao diện gốc không có những thao tác đó.

## Test trên giao diện

1. Đăng nhập, vào /dashboard/bao-ve-luan-van.
2. Bấm Thêm Lịch Bảo Vệ Mới; tìm học viên theo mã/tên và chọn trong danh sách.
3. Họ tên/chuyên ngành tự điền. Nhập đề tài, ngày, phòng và hội đồng, bấm Lưu.
4. Tìm kiếm/lọc trạng thái, chuyển trang và mở Chi tiết.
5. Nhập điểm tại chi tiết của lịch đang chờ, xác nhận Lưu Kết Quả Bảo Vệ.
6. Thử điểm 0 và 5.5 trên các lịch riêng để kiểm tra Chưa đạt/Đã đạt.
7. Tắt backend để kiểm tra thông báo lỗi/nút Thử lại; hết phiên sẽ có liên kết đăng nhập.

Nếu không có học viên để chọn, kiểm tra trạng thái học viên, việc gán CTĐT,
bậc/hướng học, lịch đang chờ và phạm vi dữ liệu của tài khoản.

## Kiểm tra tự động

```bash
# Trong backend
npm test -- --runInBand
npm run build
npm run lint
# Cần frontend :3000 và backend :3002, database phát triển có ADMIN và HV SĐH
npm run test:defense-integration
```

Bài tích hợp dùng JWT ADMIN thử ngắn hạn để tìm học viên, tạo một tài khoản officer
riêng và đăng nhập thật qua frontend, kiểm tra scopes, validation, lịch trùng,
request đồng thời, điểm và audit. Không sửa mật khẩu của tài khoản thật.
Kết thúc chỉ xóa các dòng thesis_defenses có đúng marker/ID của bài test,
xóa phạm vi của tài khoản thử rồi xóa mềm tài khoản thử; audit được giữ.
Không chạy bài tích hợp trên database production.
Có thể đổi FRONTEND_URL khi frontend chạy ở cổng khác.

Build frontend cần DATABASE_URL vì dự án còn dùng Prisma ở các trang khác.
Cấu hình biến này theo frontend/.env.example khi build độc lập.
