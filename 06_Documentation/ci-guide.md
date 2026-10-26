# CI và bảo vệ nhánh main

## Workflow duy nhất

Repo chỉ dùng `.github/workflows/ci.yml`. Workflow chạy khi mở/cập nhật PR vào
`main`, push vào `main`, push tag `v*`, chạy thủ công, hoặc kiểm tra merge queue.
Không lọc theo `paths`, để PR chỉ sửa tài liệu vẫn có kết quả CI.

| Job | Kiểm tra |
| --- | --- |
| `Frontend` | Node.js 22, `npm ci`, ESLint, Prisma schema, TypeScript, production build |
| `Backend` | Node.js 22, `npm ci`, ESLint, unit test xác thực và NestJS build |
| `CI` | Chỉ thành công khi cả hai job trên thành công; thất bại nếu job bị lỗi, hủy hoặc bỏ qua |

Backend đã được đồng bộ từ `main`, gồm mã xác thực, lockfile và cấu hình NestJS.
Mọi bước backend đều bắt buộc chạy. Unit test dùng repository giả để kiểm tra
đăng nhập, khóa tài khoản và các trường hợp từ chối đổi/đặt lại mật khẩu;
không cần database hoặc gửi email. Script test không dùng `--passWithNoTests`:
thiếu test hoặc test lỗi sẽ làm CI thất bại. Lint không tự sửa source.
Frontend chưa có bộ unit test; hiện kiểm tra lint, kiểu dữ liệu, schema và build.

Workflow không publish image hoặc deploy: các Dockerfile hiện đang rỗng. Không
cần secret để chạy CI, kể cả PR từ fork. `DATABASE_URL` trong workflow là URL
kiểm tra giả, không phải database thật. Prisma validate/generate không kết nối DB;
hai trang có truy vấn DB chờ request thực tế, nên build không cần MariaDB. Việc
kiểm tra kết nối DB/migration cần một bộ integration test riêng khi được bổ sung.

## Chạy kiểm tra trước khi tạo PR

Yêu cầu Node.js 22.12 trở lên trong dòng 22 (CI dùng bản 22 mới nhất).

```bash
cd 03_SourceCode/frontend
npm ci
npm run lint
npm run prisma:validate
npm run typecheck
npm run build
```

Kiểm tra backend từ thư mục gốc repo:

```bash
cd 03_SourceCode/backend
npm ci
npm run lint -- --no-fix
npm test -- --ci --runInBand
npm run build
```

Trên PowerShell nếu `npm.ps1` bị chặn bởi Execution Policy, dùng `npm.cmd` thay
cho `npm`. Không cần đổi Execution Policy của máy.

`npm ci` yêu cầu lockfile khớp `package.json`. Khi chủ động thay dependencies,
chạy `npm install` tại đúng thư mục và commit cả manifest lẫn lockfile.

## Kết quả kiểm tra lại ngày 26/10/2026

Trước khi đồng bộ mã backend từ `main`, đã tạo bản sao riêng từ các file frontend được Git theo dõi, dùng nội dung đang
sửa trong workspace; không sao chép `.env`, `.env.local`, `node_modules` hay
`.next`. Kiểm tra trên Windows với Node.js 22.18.0:

| Kiểm tra | Kết quả |
| --- | --- |
| Cài mới từ lockfile bằng `npm ci --offline --no-audit --no-fund` | Thành công; dùng cache tải package của npm |
| `npm run lint` | Thành công; 0 lỗi, 45 cảnh báo import/biến chưa dùng |
| `npm run prisma:validate` | Thành công |
| `npm run typecheck` | Thành công; tự sinh Prisma client và route types từ đầu |
| `npm run build` | Thành công; không có database chạy tại URL kiểm tra |
| Parse YAML, kiểm tra triggers, dependencies và tên check `CI` | Thành công |
| Chạy script tổng hợp với 16 cặp trạng thái job | Chỉ cặp `success/success` thành công |

Sau khi hợp nhất backend từ `origin/main` (`9afbb48`), đã kiểm tra thêm:

- Cài dependencies backend từ lockfile: thành công.
- Backend lint không sửa source: thành công.
- Unit test `AuthService`: 10/10 trường hợp thành công.
- Backend production build: thành công.
- Chạy Jest với mẫu không khớp test nào: thoát mã 1, xác nhận thiếu test chặn CI.

Đã bỏ `fallbackPolling` khỏi `compilerOptions` trong tsconfig backend vì
TypeScript báo TS5023 (tùy chọn không hợp lệ). Các bước backend hiện luôn chạy;
không còn cơ chế bỏ qua khi backend chỉ có scaffold.

Build còn cảnh báo nhiều lockfile do lockfile rỗng ở thư mục gốc và lockfile của
frontend cùng tồn tại. Build hiện vẫn thành công. Build cần truy cập Google Fonts;
Prisma có thể cần tải engine trong lần chạy đầu.

Kết quả trên xác nhận kiểm tra local, chưa thay cho một run trên runner Ubuntu
của GitHub Actions. Chưa có unit test
frontend hoặc kiểm tra kết nối database. Branch protection chưa được xác nhận
từ Settings của repository.

## Bật bảo vệ main trên GitHub

File YAML tạo status check, còn branch protection phải được admin bật trong
Settings của repository. Thay đổi file ở máy chưa tự bật bảo vệ trên GitHub.

1. Commit thay đổi trên nhánh làm việc, push nhánh và mở PR có base là `main`.
   Commit kèm các sửa đổi `package.json`, `prisma.config.ts` và các file frontend
   đã sửa lỗi, cùng việc xóa workflow cũ. Các script và sửa lỗi này là một phần
   cần thiết để workflow mới chạy thành công.
   Để workflow chạy thành công ít nhất một lần. Đừng chọn check cũ trước khi
   check mới xuất hiện; GitHub yêu cầu check đã thành công trong 7 ngày gần đây.
2. Vào **Settings → Branches → Add classic branch protection rule** (một số giao
   diện ghi **Add rule**). Nếu đã có rule cho `main`, sửa rule đó.
3. Điền **Branch name pattern** là `main`.
4. Bật **Require a pull request before merging**, **Require approvals** và chọn
   **1** người duyệt. Có thể bật **Dismiss stale pull request approvals when new
   commits are pushed** để yêu cầu duyệt lại sau thay đổi.
5. Bật **Require status checks to pass before merging** và **Require branches to
   be up to date before merging**. Tìm và chọn đúng check **`CI`** của GitHub
   Actions (job cuối trong workflow). Bỏ các required check của workflow đã xóa,
   ví dụ `build-and-test`, để tránh chờ check không còn tồn tại.
   Nếu giao diện đang yêu cầu `CI Backend (NestJS)` hoặc `CI Frontend`, thay các
   yêu cầu đó bằng check `CI` mới. Tên workflow cũ và tên job/status check có thể
   khác nhau; đối chiếu mục Checks của PR để chọn chính xác.
6. Bật **Require conversation resolution before merging** và **Do not allow
   bypassing the above settings** để áp dụng cả cho admin. Không thêm người/bot
   vào danh sách bypass PR. Giữ **Allow force pushes** và **Allow deletions** tắt.
7. Lưu rule. Nếu dùng Rulesets thay classic protection, đặt trạng thái rule là
   **Active**, target `main`, yêu cầu PR và check `CI`, và để danh sách bypass
   trống. Tránh để nhiều rule cũ yêu cầu các check đã xóa.

Sau đó quy trình là: nhánh tính năng → PR vào `main` → `CI` thành công → đủ
review và giải quyết thảo luận → merge. Push vào `main` chỉ kiểm tra sau khi code
đã lên nhánh; chính rule bắt buộc PR và required check mới ngăn code lỗi được merge.

## Xác nhận rule hoạt động

- Tạo PR bình thường và kiểm tra đủ `Frontend`, `Backend`, `CI` trong tab Checks.
- Trên nhánh thử nghiệm, thêm một lỗi TypeScript rồi push vào PR. `Frontend` và
  `CI` phải đỏ, nút merge bị chặn. Sửa lại lỗi rồi push để CI xanh trở lại.
- Nếu thấy **Expected / Waiting for status to be reported**, kiểm tra tên required
  check, base branch `main`, Actions đã bật, và không dùng `[skip ci]` trong commit.
- Nếu CI xanh mà vẫn merge được khi chưa đủ review, kiểm tra rule đã lưu/Active,
  đúng nhánh và tài khoản đang dùng không được bypass.
- Không đổi tên job `CI` trước khi cập nhật required check tương ứng trong rule.
- Các workflow cũ vẫn có thể xuất hiện trong lịch sử Actions sau khi xóa file;
  commit/PR mới chỉ chạy workflow còn tồn tại.

## Lỗi checkout symlink trên runner Linux

Run `40348448959` thất bại ở bước checkout của cả hai job vì 20 symlink trong
`frontend/.claude/skills` và `frontend/.windsurf/skills` có đích rỗng. Lint/test
chưa được chạy trong lần đó. Đã khôi phục các đích tương đối
`../../.agents/skills/<tên-skill>` từ commit trước và kiểm tra đủ 20 đích có
`SKILL.md` được Git theo dõi. Lần kiểm tra frontend local trước đó bỏ qua các
thư mục này nên chưa phát hiện được lỗi checkout.

Trên Windows, Git có thể biểu diễn symlink bằng file văn bản chứa đường dẫn
đích. Giữ nguyên nội dung các file này; file đích rỗng làm checkout trên Linux
thất bại trước khi CI kịp kiểm tra code. `.gitignore` không sửa được symlink
đã nằm trong lịch sử Git.

Tham khảo: [tạo branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule),
[xử lý required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks),
[workflow dependencies và always()](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds).
