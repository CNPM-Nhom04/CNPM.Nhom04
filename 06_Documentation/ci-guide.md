# Hướng dẫn CI và bảo vệ nhánh main

## Workflow duy nhất

File cấu hình: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Workflow chạy khi mở hoặc cập nhật PR vào `main`, push vào `main`, push tag `v*`, có sự kiện merge queue hoặc chạy thủ công. Không lọc theo đường dẫn để PR chỉ sửa tài liệu vẫn tạo required check.

| Check | Nội dung |
| --- | --- |
| `Frontend` | Node.js 22, `npm ci`, lint không có cảnh báo, Prisma validate/generate, TypeScript và production build |
| `Backend` | Node.js 22, `npm ci`, lint không có cảnh báo, unit test xác thực và NestJS build |
| `CI` | Chỉ thành công khi cả `Frontend` và `Backend` thành công; thất bại nếu job con lỗi, bị hủy hoặc bị bỏ qua |

CI dùng `contents: read`, cache npm theo lockfile và hủy lần chạy cũ khi cùng PR/nhánh có cập nhật. Lint chỉ kiểm tra; lệnh `npm run lint:fix` ở backend dành cho việc sửa mã trên máy cá nhân. Jest sẽ thất bại nếu không tìm thấy test.

Next.js được cấu hình dùng thư mục frontend làm root cho Turbopack và tracing của bản standalone, tránh suy luận nhầm root từ lockfile ở thư mục gốc repository.

`DATABASE_URL` trong workflow là cấu hình MySQL giả dành cho validate/generate/build, không phải thông tin kết nối production. Hai trang đọc database được render khi có request nên build không truy vấn database. Prisma CLI đọc `DATABASE_URL` từ môi trường hoặc `.env`; khi chạy ứng dụng cần cấu hình database thực tế.

## Kiểm tra trên máy

Dùng Node.js 22. Chạy từng lệnh theo thứ tự và sửa ngay khi có lệnh thất bại.

Frontend, từ thư mục gốc dự án:

```bash
cd 03_SourceCode/frontend
cp .env.example .env
npm ci
npm run lint
npx --no-install prisma validate
npx --no-install prisma generate
npm run typecheck
npm run build
```

Nếu đã có `.env`, giữ file đó và kiểm tra biến `DATABASE_URL` thay vì chép đè. Trên PowerShell có thể dùng `Copy-Item .env.example .env`; nếu execution policy chặn `npm.ps1`, dùng `npm.cmd` và `npx.cmd`. Build tải font Google qua `next/font/google`, nên máy build cần truy cập mạng.

Backend, từ thư mục gốc dự án:

```bash
cd 03_SourceCode/backend
npm ci
npm run lint
npm test -- --ci --runInBand
npm run build
```

## Bắt buộc CI trước khi merge

Thay đổi file YAML không tự thay đổi branch protection hoặc ruleset trên GitHub. Người có quyền quản lý rules của repository cần thực hiện:

1. Push nhánh sửa lỗi và mở/cập nhật PR vào `main`. Đợi workflow mới chạy để GitHub nhận check `CI`.
2. Mở **Settings → Branches → Branch protection rules** và sửa rule của `main`; nếu repository dùng ruleset, mở **Settings → Rules → Rulesets** và sửa ruleset đang áp dụng cho `main`.
3. Bật **Require status checks to pass before merging**, xóa các required check của workflow cũ, rồi chọn check có tên chính xác **`CI`**, nguồn **GitHub Actions**. `Frontend` và `Backend` đã được check tổng này kiểm tra.
4. Bật **Require branches to be up to date before merging**, hoặc dùng merge queue theo quy trình của nhóm. Workflow đã hỗ trợ `merge_group`.
5. Giữ **Require a pull request before merging** và số lượt approve theo quy định nhóm. Nếu yêu cầu một lượt approve, một thành viên khác có quyền Write phải duyệt PR; CI xanh không thay thế việc review.
6. Lưu rule và kiểm tra lại phần merge của PR. Nếu còn check cũ ở trạng thái **Expected**, tìm và cập nhật cả branch protection lẫn ruleset đang áp dụng.

Nếu tổ chức bắt buộc workflow qua ruleset, quản trị viên cũng cần cập nhật tham chiếu workflow cũ sang `ci.yml`.

## Phạm vi kiểm tra

15 unit test backend kiểm tra đăng nhập, giới hạn lần đăng nhập sai, khóa tài khoản, đổi mật khẩu và token đặt lại mật khẩu. Repository và JWT được giả lập; việc băm/kiểm tra mật khẩu dùng bcrypt thực tế.

Frontend chưa có unit test. CI chưa kiểm tra tích hợp database, SMTP, end-to-end hoặc deploy. Kết quả CI thành công chỉ xác nhận các bước hiện có; vẫn cần review và kiểm thử chức năng phù hợp với thay đổi.

Tài liệu GitHub: [cú pháp workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [bảo vệ nhánh và required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
