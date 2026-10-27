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
Nếu chưa cấu hình, mặc định là http://127.0.0.1:3000.
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
1. Đăng nhập, tự chuyển đến trang báo cáo.
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