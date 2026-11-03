# Lớp quản lý và nhập tài khoản học viên hàng loạt

Luồng dành cho danh sách học viên **đã nhập học**. Không xét tuyển, không tự công nhận trúng tuyển và không đăng ký học phần.

## Chạy và mở giao diện

Trong `03_SourceCode/backend`, cấu hình `.env` trỏ đúng MariaDB đang dùng rồi chạy một lần:

```bash
npm run migration:run
```

Migration `1793700000000-StudentClasses.ts` thêm hai bảng lớp quản lý và quyền `STUDENT_ACCOUNT_IMPORT` cho vai trò ADMIN. Không tạo lớp/học viên mẫu, không đổi mật khẩu tài khoản cũ. Tiếp tục chạy backend và frontend như bình thường:

```bash
# Terminal backend
npm run start:dev
```

```bash
# Terminal frontend, tại 03_SourceCode/frontend
npm run dev
```

Đăng nhập Admin rồi mở **Lớp & Tài khoản học viên** tại:
`http://localhost:3000/dashboard/admin/lop-hoc-vien` (đổi cổng nếu frontend chạy cổng khác).
Nếu vừa áp dụng migration, tải lại trang để lấy quyền mới từ SQL.

## Test theo giao diện

1. Bấm **Tạo lớp quản lý**. Nhập mã lớp riêng, tên lớp; chọn đúng phiên bản/hướng CTĐT từ danh sách SQL và khóa nhập học. Bấm **Lưu lớp**.
2. Mỗi lớp gắn với **một** `program_version_tracks.id`. Ví dụ cùng MIT-2025-v1 nhưng hướng nghiên cứu và hướng ứng dụng là hai lựa chọn khác nhau. Đơn vị lấy từ CTĐT, không tự chọn lẫn khoa.
3. Tại dòng lớp, bấm **Nhập Excel → Tải mẫu học viên**. Điền sheet `Hoc vien`, giữ nguyên tiêu đề:

| Mã học viên              | Họ và tên       | Email                   | Tên đăng nhập   |
| ------------------------ | --------------- | ----------------------- | --------------- |
| Mã mới chưa có trong SQL | Họ tên học viên | Email thực của học viên | Có thể bỏ trống |

4. Mã học viên bắt buộc, tối đa 50 ký tự chữ/số không dấu hoặc `_.-`. Giữ ô dạng Text để không mất số 0 đầu. Họ tên bắt buộc, tối đa 255 ký tự. Email bắt buộc, đúng định dạng và không trùng tài khoản khác. Tên đăng nhập tối thiểu 3 ký tự; bỏ trống sẽ dùng mã học viên viết thường. Không nhập mật khẩu trong file; không dùng công thức. Email Excel tự chuyển thành liên kết mailto đúng địa chỉ hiển thị vẫn được chấp nhận; không mở hay truy cập liên kết.
5. Chọn file `.xlsx` rồi bấm **Kiểm tra file học viên**. Chỉ xem trước, chưa ghi tài khoản. Dòng lỗi hiển thị nguyên nhân. Toàn bộ file phải hợp lệ mới cho tạo; sửa file, chọn lại và kiểm tra lại khi có lỗi.
6. Bấm **Tạo N tài khoản & tải bàn giao**. Chờ xử lý, không đóng trang. Khi thành công, tải file `Ban_Giao_Tai_Khoan_<ma-lop>.xlsx` chứa tên đăng nhập và mật khẩu ban đầu ngẫu nhiên riêng cho từng người.
7. Bấm **Xem học viên**: đối chiếu mã, họ tên, tài khoản, phiên bản/hướng và cờ cần đổi mật khẩu. Lớp có học viên không được xóa; có thể sửa tên hoặc ngừng tiếp nhận. Mã, CTĐT/hướng và khóa được giữ nguyên sau khi tạo.
8. Dùng cửa sổ riêng đăng nhập tài khoản vừa tạo tại `/dang-nhap`. Hệ thống bắt buộc đổi mật khẩu lần đầu. Nhập mật khẩu từ file bàn giao, mật khẩu mới và xác nhận; sau đó đăng nhập lại.
9. Học viên về trang chủ, bấm **CTĐT của tôi** để xem đúng phiên bản/hướng của lớp tại `/ctdt-cua-toi`. Học viên không vào dashboard hoặc API Admin.
10. Thử nhập lại file đã tạo: phải báo tài khoản/mã/email đã có, không ghi đè hoặc đặt lại mật khẩu. Thử file trùng mã/email trong hai dòng: phải bị chặn và không lưu dòng nào.

Giới hạn lấy từ `system_settings`: `import.max_file_mb`, `import.max_rows`, `account.password_min_length`. Ngoài giới hạn SQL, hệ thống giới hạn kỹ thuật tối đa 5 MB và **200 dòng mỗi đợt** để kiểm tra file và băm mật khẩu. Có thể chia danh sách lớp thành nhiều file.

## Đối chiếu DBeaver bằng cách mở bảng

Trong đúng kết nối/database mà backend đang dùng, mở **Tables → tên bảng → Data**, bấm **Refresh** sau mỗi lần thao tác. Không cần chạy SQL:

| Bảng                          | Cột cần xem                                                                                          | Ý nghĩa                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `student_classes`             | `id`, `class_code`, `class_name`, `program_version_track_id`, `admission_year`, `status`, `revision` | Lớp vừa tạo và hướng CTĐT cố định                         |
| `student_class_memberships`   | `student_id`, `class_id`                                                                             | Học viên thuộc lớp nào                                    |
| `users`                       | `id`, `username`, `email`, `organizational_unit_id`, `must_change_password`                          | Tài khoản mới, cờ 1 trước khi đổi mật khẩu, 0 sau khi đổi |
| `students`                    | `id`, `student_code`, `user_id`, `organizational_unit_id`, `admission_year`                          | Hồ sơ liên kết đúng tài khoản                             |
| `user_roles` và `roles`       | `user_id`, `role_id` → `role_code=STUDENT`                                                           | Chỉ cấp vai trò học viên                                  |
| `student_program_assignments` | `student_id`, `program_version_track_id`, `assignment_status`                                        | Phân công ACTIVE đúng hướng của lớp                       |
| `program_version_tracks`      | `id`, `program_version_id`, `track_code_snapshot`                                                    | Hướng chính xác đã chọn                                   |
| `program_versions`            | `id`, `version_code`, `status`                                                                       | Phiên bản gắn với hướng                                   |
| `audit_logs`                  | `action`, `entity_type`, `entity_id`, `new_value`                                                    | Tạo lớp/tài khoản và đợt IMPORT; không lưu mật khẩu       |

Tài khoản học viên không được cấp `user_scopes` GLOBAL/ORG_UNIT. API cá nhân nhận diện bằng `students.user_id` của phiên đăng nhập, không lấy mã do trình duyệt truyền lên.

`course_offerings` là **lớp học phần**, không phải lớp quản lý vừa bổ sung. Không sửa/xóa dữ liệu lớp học phần để test tính năng này.

## Quy tắc khi đã có hồ sơ

- Mã học viên chưa tồn tại: tạo `users`, `students`, vai trò STUDENT, phân công CTĐT và thành viên lớp trong cùng một transaction.
- Hồ sơ tồn tại nhưng chưa có `user_id`: chỉ liên kết khi ACTIVE, đúng họ tên/khóa, đơn vị trống hoặc đúng đơn vị của lớp; không thuộc lớp khác và không có phân công ACTIVE sang hướng khác.
- Phân công ACTIVE đã đúng hướng: giữ nguyên ID phân công; nếu chưa có ACTIVE thì thêm mới. Không thay thế phân công cũ hoặc tự chuyển sang phiên bản mới nhất.
- Hồ sơ đã có tài khoản, trùng tên đăng nhập/email kể cả tài khoản xóa mềm: báo lỗi, không ghi đè. Quản lý tài khoản cũ tại **Nhân sự & Phân quyền**; đặt lại mật khẩu bằng luồng email.
- Chỉ nhận hướng ACTIVE của phiên bản PUBLISHED/ARCHIVED; chương trình, ngành, bậc và đơn vị phải ACTIVE. Không nhận bản nháp hoặc đang thẩm định.
- Ngừng tiếp nhận lớp chỉ chặn nhập thêm, vẫn giữ tài khoản và phân công đang có.
- Bất kỳ lỗi khi lưu đều rollback cả đợt. Lớp thay đổi sau xem trước sẽ yêu cầu kiểm tra lại. Quyền Admin được kiểm tra lại trong transaction.

## Mật khẩu và phân quyền

Chỉ ADMIN có đủ `USER_MANAGE`, `ROLE_SCOPE_MANAGE`, `STUDENT_ACCOUNT_IMPORT` được sử dụng. Cán bộ đào tạo/giảng viên/học viên không tự nhập tài khoản hoặc nâng vai trò. Menu ẩn và API cùng kiểm tra quyền hiện tại từ SQL.

Mật khẩu ngẫu nhiên tối thiểu 16 ký tự, tuân thủ ngưỡng SQL, lưu bcrypt cost 12. Không có mật khẩu chung. File bàn giao chỉ nhận khi tạo thành công; không có chức năng tải lại mật khẩu đọc được. Giữ file riêng, bàn giao đúng người; không push file này lên GitHub.

Nếu đã tạo nhưng mất file/tải bị gián đoạn, kiểm tra **Xem học viên** trước; dùng **Quên mật khẩu** với email đã lưu để cấp lại quyền truy cập. Không nhập lại để đặt mật khẩu. Gửi email khôi phục cần SMTP đã cấu hình trong backend `.env`; nhập hàng loạt không tự gửi email.

## API

Prefix NestJS `/admin/lop-hoc-vien`, proxy Next.js `/api/admin/lop-hoc-vien`, JWT cookie HttpOnly và kiểm tra Origin khi ghi.

| Method | Đường dẫn sau prefix    | Chức năng                                                                                 |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/`, `/options`, `/:id` | Danh sách, lựa chọn SQL, chi tiết                                                         |
| POST   | `/`                     | Tạo lớp `{code,name,trackId,admissionYear}`                                               |
| PUT    | `/:id`                  | Sửa `{name,status,revision}`                                                              |
| DELETE | `/:id?revision=...`     | Xóa lớp trống, kiểm tra revision                                                          |
| GET    | `/:id/hoc-vien`         | Học viên trong lớp; tìm kiếm/phân trang                                                   |
| GET    | `/:id/import/mau-excel` | Tải mẫu `.xlsx`                                                                           |
| POST   | `/:id/import/kiem-tra`  | Multipart `file`; trả previewHash, classRevision và lỗi từng dòng                         |
| POST   | `/:id/import/luu`       | Multipart `file`, `previewHash`, `classRevision`; trả XLSX bàn giao và `X-Imported-Count` |

Danh sách dùng `page`, `limit`, `searchTerm`; lớp có thêm `status=ALL/ACTIVE/INACTIVE`. ID là chuỗi số nguyên; không đổi hướng/khóa qua API sửa lớp.

## Kiểm tra tự động

```bash
npm test -- --runInBand
npm run lint
```

`npm run test:student-accounts-integration` và `npm run test:student-accounts-browser` **chỉ chạy trên database sao chép dùng thử** có tên `ctdt_major_review_<chuso>` và `MAJOR_TEST_ALLOW_WRITES=1`. Backend/Next.js của bài test phải cùng trỏ database sao chép, cùng JWT_SECRET; `MAJOR_TEST_URL` là địa chỉ frontend test (mặc định http://localhost:3101). Không bật cờ test trên database đang sử dụng.

Bài integration tự tạo fixture thử và kiểm tra API/SQL, tải XLSX, băm mật khẩu, liên kết hồ sơ, rollback khi lỗi giữa đợt, đổi mật khẩu và tra cứu CTĐT. Bài browser dùng fixture `accounts.json` trong thư mục chứa `MAJOR_BROWSER_FIXTURE` (mặc định `/tmp`) được bài integration tạo; chạy sau integration. Cài Playwright và Chromium trong môi trường test, hoặc đặt `PLAYWRIGHT_MODULE_PATH` tới module đã cài.

Fixture và file bàn giao chứa thông tin đăng nhập **chỉ của database thử**; xóa chúng cùng database thử sau khi kiểm tra. Không dùng script kiểm thử để tạo học viên thật.

## Liên kết tài khoản học viên đã tồn tại (bổ sung 03/11/2026)

Không cần tạo lại tài khoản hoặc nhập lại Excel khi tài khoản STUDENT đã có nhưng chưa có hồ sơ/phân công. Admin có đủ ba quyền của module thao tác tại `/dashboard/admin/lop-hoc-vien`:

1. Tạo/chọn lớp đúng khoa, khóa và phiên bản/hướng CTĐT đã ban hành hoặc lưu trữ từ SQL.
2. Tại dòng lớp, bấm **Liên kết tài khoản**. Tìm và chọn tài khoản học viên đang hoạt động. Không chọn tài khoản nhân sự quản lý.
3. Nếu tài khoản chưa có hồ sơ, chọn một trong hai cách:
   - **Chọn hồ sơ học viên có sẵn từ SQL**: chỉ hiển thị hồ sơ ACTIVE chưa gắn tài khoản, đúng khoa/khóa, không có phân công ACTIVE sang hướng khác. Đối chiếu tên tài khoản với mã/họ tên hồ sơ đúng người; không đoán theo tên đăng nhập/email.
   - **Tạo hồ sơ mới cho tài khoản này**: chỉ dùng khi đã kiểm tra chưa có hồ sơ đúng người. Nhập mã học viên mới duy nhất. Họ tên lấy từ tài khoản SQL; khoa/khóa lấy từ lớp.
4. Nếu tài khoản đã có hồ sơ nhưng chưa vào lớp quản lý, dùng chính hồ sơ đó; không tạo hồ sơ thứ hai.
5. Nhập **Căn cứ liên kết**, đánh dấu đã xác minh đúng người và bấm **Lưu liên kết**.
6. Mở **Xem học viên** để đối chiếu; tài khoản học viên đăng nhập như trước, mở **CTĐT của tôi** trên trang chủ và thấy phiên bản/hướng của lớp.

Mật khẩu, email, vai trò, phạm vi và cờ bắt buộc đổi mật khẩu giữ nguyên. Nếu cờ đổi mật khẩu là 1, học viên vẫn phải đổi trước khi xem CTĐT. Nếu tài khoản/hồ sơ có khoa khác, hồ sơ sai khóa/trạng thái, đã có lớp khác hoặc phân công ACTIVE sang hướng khác thì từ chối; không tự chuyển khoa/lớp/CTĐT và không thay danh tính của hồ sơ đã gắn tài khoản khác.

Liên kết dùng transaction và khóa bản ghi, kiểm tra revision lớp và quyền Admin hiện tại; lỗi bất kỳ sẽ rollback toàn bộ. Audit action `LINK_STUDENT_ACCOUNT`, entity `student_class`, ghi ID tài khoản/hồ sơ/hướng và căn cứ trong `new_value`, không ghi mật khẩu.

Đối chiếu DBeaver vẫn qua `users.id → students.user_id → student_program_assignments.student_id`; bảng `student_class_memberships` ghi lớp quản lý. Luồng mới **không cần migration bổ sung** ngoài migration StudentClasses đã có. Không tự sửa `CSDL.sql` hay tạo dữ liệu mẫu để gán cho tài khoản thật.

API cùng guard với nhập Excel:

| Method | Đường dẫn sau `/admin/lop-hoc-vien` | Chức năng |
| --- | --- | --- |
| GET | `/:id/lien-ket/tai-khoan?page=1&limit=10&searchTerm=...` | Tìm tài khoản STUDENT ACTIVE, không có vai trò nhân sự quản lý, chưa thuộc lớp quản lý |
| GET | `/:id/lien-ket/ho-so?page=1&limit=10&searchTerm=...` | Tìm hồ sơ SQL phù hợp với lớp |
| POST | `/:id/lien-ket` | `{userId, studentId?, studentCode?, revision, confirmed:true, reason}` |

Chọn `studentId` khi dùng hồ sơ cũ; chọn `studentCode` khi tạo hồ sơ mới, không gửi cả hai. Nếu tài khoản đã liên kết hồ sơ thì phải giữ hồ sơ đó. Proxy frontend tương ứng tại `/api/admin/lop-hoc-vien/...`, kiểm tra Origin và JWT HttpOnly.

Kiểm tra tự động chỉ trên clone như mục trước: `npm run test:student-account-link-integration`, sau đó `npm run test:student-account-link-browser`. Bài integration lưu `link.json` cạnh `MAJOR_BROWSER_FIXTURE` (mặc định `/tmp`); chứa thông tin đăng nhập chỉ của clone, xóa sau khi test. Kiểm tra cả liên kết hồ sơ cũ, tạo hồ sơ mới, giữ nguyên bảo mật tài khoản, chặn sai dữ liệu, rollback khi audit lỗi và đăng nhập học viên xem CTĐT sau liên kết.
