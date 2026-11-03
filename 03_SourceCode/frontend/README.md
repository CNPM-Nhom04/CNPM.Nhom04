## Cài mới và bàn giao cho QA

Xem [quy trình clone, restore database và chạy test](../../docs/LOCAL_TEST_SETUP.md). Cần cấu hình DATABASE_URL cùng database với backend và chạy npx prisma generate trước lần chạy đầu.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Báo cáo kết nối NestJS

Trang `/dashboard/bao-cao` dùng dữ liệu NestJS, không còn mock.
Đăng nhập tại `/dang-nhap` bằng tài khoản hệ thống. JWT lưu trong cookie
HttpOnly, thời hạn 30 phút; Next.js chuyển tiếp JWT đến NestJS, không trả token
cho JavaScript trình duyệt. Khi token hết hạn, trang báo cáo hiển thị liên kết đăng nhập lại.

Cấu hình `frontend/.env.local`:
```dotenv
BACKEND_API_URL=http://127.0.0.1:3002
```
URL này là địa chỉ backend nhìn từ server Next.js, không phải URL trình duyệt.
Nếu chưa cấu hình, mặc định là http://127.0.0.1:3002.
Trong Docker, dùng tên service backend và cổng nội bộ tương ứng.

Chạy trong 2 terminal từ thư mục gốc dự án (WSL/bash):
```bash
cd 03_SourceCode/backend
PORT=3002 npm run start:dev
```
```bash
cd 03_SourceCode/frontend
npm run dev
```
Mở http://localhost:3000/dang-nhap (hoặc cổng Next.js in trong terminal).
Đảm bảo hai ứng dụng dùng cổng khác nhau.
Nếu chọn NestJS cổng 3000, đặt BACKEND_API_URL tương ứng và chạy Next.js
bằng `npm run dev -- --port 3001`.

Kiểm tra trên giao diện:
1. Đăng nhập rồi chọn Tra cứu & Báo cáo trong menu theo quyền được cấp.
2. Bảng và 4 thẻ thống kê lấy từ API; tìm kiếm chờ 300 ms, hủy request cũ.
3. Bậc đào tạo lấy từ database; đổi bộ lọc trở về trang 1.
4. Chuyển trang bằng Trang trước/Trang sau (20 dòng/trang).
5. Xuất Excel tải file XLSX chứa tất cả kết quả khớp bộ lọc.
6. In báo cáo tải đủ các trang khớp bộ lọc trước khi mở hộp thoại in.
7. Khi backend tắt, có thông báo lỗi và nút Thử lại; khi chưa đăng nhập hoặc
   JWT hết hạn, có liên kết đến trang đăng nhập.

Các route Next.js `/api/bao-cao/*` chỉ chuyển tiếp API báo cáo được cho phép.
Không cần bật CORS ở NestJS cho luồng này. Thống kê sử dụng summary trong
response danh sách để bảng và thẻ dùng cùng bộ lọc.

## Các trang Admin

Bốn trang /dashboard/admin/nguoi-dung, master-data, cau-hinh, audit-log đã nối NestJS.
Đăng nhập bằng tài khoản có vai trò ADMIN trong database.
Nếu chưa đăng nhập, liên kết trên trang sẽ đưa đến /dang-nhap và quay lại đúng trang sau đăng nhập.
Dùng cùng BACKEND_API_URL và cookie HttpOnly như trang báo cáo, không cần cấu hình CORS.

Backend cần chạy npm run migration:run trước lần sử dụng đầu tiên.
Hướng dẫn API, payload, migration và bài test tích hợp nằm tại
../backend/src/modules/admin/README.md.
Trang chủ công khai: `/`, `/chuong-trinh-dao-tao`, `/quy-che`, `/dang-ky-thong-tin`. Hướng dẫn SQL/API/test: [Public Portal README](../backend/src/modules/public-portal/README.md).

Học viên tra cứu **CTĐT của tôi** tại `/ctdt-cua-toi`; danh tính/phân công lấy từ SQL theo phiên đăng nhập. Hướng dẫn đối chiếu DBeaver và test: [Student Program README](../backend/src/modules/student-program/README.md).

Học viên đăng nhập tại trang chủ và dùng `/ctdt-cua-toi` bên ngoài dashboard. Nhân sự quản lý chuyển giữa hai khu vực bằng nút Dashboard/Trang chủ. Hai giao diện đăng ký học phần mẫu đã được xóa; dữ liệu SQL lớp/đăng ký phục vụ điểm vẫn giữ nguyên.

Admin nhập tài khoản học viên theo lớp tại `/dashboard/admin/lop-hoc-vien`: tạo lớp gắn phiên bản/hướng SQL → tải mẫu → kiểm tra Excel → tạo tài khoản và tải file bàn giao. Học viên phải đổi mật khẩu lần đầu, sau đó tra cứu `/ctdt-cua-toi`. Chạy migration mới trước khi dùng. Hướng dẫn test và đối chiếu bảng DBeaver: [Student Accounts README](../backend/src/modules/student-accounts/README.md).

Ma trận quyền và các chức năng chưa triển khai: [Đối chiếu phân quyền](../../docs/ACCESS_REVIEW.md). Xuất Excel báo cáo/so sánh cần `PROGRAM_EXPORT` ngoài quyền xem chức năng; Admin hiện không được cấp quyền xuất này trong SQL.

Trong **Lớp & Tài khoản học viên**, nút **Liên kết tài khoản** dành cho tài khoản STUDENT đã có: chọn hồ sơ từ SQL hoặc tạo hồ sơ mới theo mã học viên đã xác minh, gắn đúng lớp/CTĐT và giữ nguyên mật khẩu/quyền. Chi tiết: [Student Accounts README](../backend/src/modules/student-accounts/README.md).
