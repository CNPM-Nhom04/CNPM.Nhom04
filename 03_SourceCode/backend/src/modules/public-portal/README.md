# Trang chủ công khai và đăng ký nhận thông tin tuyển sinh

## Giao diện

| Đường dẫn frontend | Chức năng |
|---|---|
| `/` | Trang chủ, CTĐT đã công bố, thông báo tuyển sinh, form đăng ký |
| `/chuong-trinh-dao-tao` | Tìm/lọc bậc đào tạo, phân trang các phiên bản đã ban hành |
| `/chuong-trinh-dao-tao/:id` | Khung phiên bản công khai, từng hướng/nhóm/môn/tín chỉ/tiên quyết |
| `/quy-che` | Tìm văn bản, lọc Quy chế / Tuyển sinh / Hướng dẫn, mở tài liệu HTTPS |
| `/dang-ky-thong-tin` | Form nhận thông tin tuyển sinh, không yêu cầu đăng nhập |
| `/dang-nhap` | Đăng nhập tại cổng chung; học viên về trang chủ, nhân sự quản lý vào dashboard theo quyền SQL |
| `/dashboard/admin/cong-thong-tin` | Admin quản lý văn bản và xem đăng ký nhận thông tin |

Bố cục tham khảo ảnh người dùng gửi từ `https://pgd.agu.edu.vn/`; website tham khảo chặn truy cập tự động (403), không sao chép nội dung quy chế hay thông báo chưa được xác minh. Minh họa khuôn viên là SVG trong `frontend/public/campus-illustration.svg`, không phải ảnh chụp khuôn viên thật. Footer ghi rõ đây là đồ án Nhóm 04. Trang chủ thay redirect `/` cũ; các trang `/dashboard/...` và luồng đăng nhập giữ nguyên.

## CSDL và migration

Chạy trong backend:

```bash
npm ci
npm run migration:run
npm run start:dev
```

Frontend ở terminal khác:

```bash
cd 03_SourceCode/frontend
npm ci
npm run dev
```

Cấu hình `backend/.env` và `frontend/.env.local` như các module đã có; không cần biến môi trường mới cho chức năng này. Migration **1793653200000-PublicPortal.ts** thêm:

- **public_documents**: `title`, `category`, `summary`, `document_url`, `reference_number`, `issued_on`, `status`, `revision`, `updated_by`. Trạng thái `DRAFT` hoặc `PUBLISHED`.
- **admission_subscriptions**: tên, email, điện thoại, bậc/ngành quan tâm, thông tin học trước đó, nội dung tư vấn, thời điểm đồng ý, trạng thái `NEW`/`CONTACTED`, `revision` và fingerprint chống đăng ký trùng.

Không chèn mẫu quy chế hoặc người đăng ký vào database đang dùng. Sau migration, văn bản/đăng ký ban đầu có thể trống. Admin cần nhập tài liệu thực sự được phép công khai. Không chạy migration `down` trên database đang dùng: thao tác đó xóa hai bảng mới và dữ liệu của chúng.

Chương trình công khai lấy từ các bảng hiện có: **training_programs, program_versions, education_levels, majors, organizational_units, program_version_tracks, curriculum_groups, curriculum_courses, course_versions, curriculum_prerequisites, program_ui_details**. Chỉ phiên bản `PUBLISHED`, chương trình/bậc/ngành/đơn vị còn `ACTIVE` được hiển thị. Không lấy bản nháp, hồ sơ thẩm định, người duyệt, tài liệu nội bộ, học viên hoặc điểm. Khung công khai lấy đúng `course_version_id` đã gắn trong phiên bản; đọc trong giao dịch snapshot. Hướng ngừng hoạt động không hiển thị công khai. Ngày hiệu lực nếu có được hiển thị để người đọc đối chiếu; điều kiện hiển thị dựa trên trạng thái công bố, không tự đánh dấu là đang tuyển sinh.

## Test từng phần

1. Mở `http://localhost:3000/` bằng cửa sổ riêng tư. Kiểm tra menu, nút đăng nhập, nút khám phá CTĐT và form cuối trang. Trên điện thoại có menu thu gọn.
2. Vào Chương trình đào tạo, tìm `MIT`, chọn bậc, mở phiên bản đã ban hành. Đổi hai hướng, kiểm tra nhóm và môn với SQL. Bản nháp trong dashboard không được hiện ở đây.
3. Đăng nhập Admin → **Cổng thông tin & Tuyển sinh → Văn bản công khai → Thêm văn bản**. Nhập tiêu đề, loại, liên kết HTTPS của tài liệu được phép công khai; chọn **Bản nháp**, lưu. Mở `/quy-che`: chưa thấy bản nháp. Sửa sang **Công bố**, lưu; tìm lại trên trang công khai phải thấy. Sửa hoặc xóa sẽ thay đổi danh sách công khai; `revision` ngăn ghi đè khi hai người cùng sửa.
4. Mở `/dang-ky-thong-tin` không đăng nhập. Chọn bậc, họ lót, tên, email, điện thoại, ngành (tùy chọn), thông tin học trước, tích đồng ý rồi gửi. Không đồng ý hoặc sai email/điện thoại thì không lưu. Bậc/ngành phải còn hoạt động trong SQL; năm tốt nghiệp không lớn hơn năm hiện tại.
5. DBeaver: mở đúng database của backend → **Tables → admission_subscriptions → View Data → All Rows → Refresh**. Kiểm tra `email`, `education_level_id`, `major_id`, các cột snapshot tên và `consented_at`. Đăng ký cùng email/bậc/ngành không tạo thêm dòng và không ghi đè thông tin cũ; phản hồi công khai không tiết lộ ID hay việc email từng đăng ký.
6. Admin → **Đăng ký nhận thông tin**, tìm email vừa gửi. Bấm **Đánh dấu đã liên hệ** sau khi thực sự liên hệ; xem `status=CONTACTED` trong SQL. Đây là dấu theo dõi công việc, không phải nút gửi email.
7. DBeaver xem **public_documents** để đối chiếu `status` với văn bản hiện trên `/quy-che`; xem **audit_logs** với `entity_type=public_document` hoặc `admission_subscription` để kiểm tra thao tác quản trị.
8. Đăng nhập cán bộ hoặc thử gọi API Admin không có JWT: không xem được danh sách liên hệ, không sửa văn bản. Khu vực quản trị yêu cầu `ADMIN` + `MASTERDATA_MANAGE` hiện có trong SQL. Dữ liệu liên hệ không có API đọc công khai.

**Luồng đăng ký chỉ lưu yêu cầu để cán bộ theo dõi/liên hệ. Không tự tạo tài khoản, không phải nộp hồ sơ dự tuyển và chưa có lịch gửi/email tuyển sinh hàng loạt.** SMTP quên mật khẩu hiện có hoạt động riêng. Không hứa tự gửi email trong giao diện khi chưa có luồng gửi.

## API

Công khai:

- `GET /public/options`: bậc/ngành đang hoạt động từ SQL.
- `GET /public/chuong-trinh-dao-tao?search=&levelId=&page=1&limit=12` (bỏ `levelId` khi chưa lọc).
- `GET /public/chuong-trinh-dao-tao/:versionId`: chi tiết công khai.
- `GET /public/van-ban?search=&category=ALL&page=1&limit=12`: chỉ trả `PUBLISHED`, kể cả client sửa query `status`.
- `POST /public/dang-ky-thong-tin`: họ lót/tên, email, điện thoại, `levelId`, tùy chọn `majorId`, giới tính, ngành/năm tốt nghiệp, lời nhắn; `consent=true` bắt buộc. Honeypot `website` phải rỗng. Có giới hạn 30 yêu cầu/phút theo địa chỉ kết nối backend, bộ nhớ giới hạn; đây là cơ chế trong một tiến trình, không phải rate limit phân tán.

Quản trị (JWT + Admin + quyền):

- `GET/POST /admin/cong-thong-tin/van-ban`
- `PUT/DELETE /admin/cong-thong-tin/van-ban/:id` (sửa có `revision` trong body; xóa trong query).
- `GET /admin/cong-thong-tin/dang-ky?status=ALL&search=&page=1&limit=20`
- `POST /admin/cong-thong-tin/dang-ky/:id/da-lien-he` với `revision` hiện tại.

Frontend gọi proxy cùng origin `/api/public/...` và `/api/admin/cong-thong-tin/...`. POST công khai chỉ nhận JSON tối đa 16 KB và kiểm tra Origin; body có giới hạn độ dài ở backend. Proxy không gửi JWT vào public API, không mở đường dẫn tùy ý. Nội dung văn bản hiển thị dạng text, liên kết chỉ chấp nhận HTTPS. Nhật ký và cập nhật quản trị cùng giao dịch; lỗi nhật ký phải hoàn tác thao tác.

## Kiểm tra tự động

```bash
npm test -- --runInBand
npm run test:portal-integration
npm run test:portal-browser
```

Integration/browser chỉ chạy trên database bản sao `ctdt_major_review_<timestamp>` có `MAJOR_TEST_ALLOW_WRITES=1`; backend/frontend trỏ đúng bản sao và dùng JWT_SECRET riêng. Cần áp dụng migration trên bản sao, fixture `MAJOR_BROWSER_FIXTURE` do `test:major-integration` tạo. Portal integration tạo `portal.json` cạnh fixture; browser dùng file này và Playwright/Chromium (`PLAYWRIGHT_MODULE_PATH` nếu module ngoài dự án). Script từ chối database thật. Không gửi SMTP trong các bài test; toàn bộ dữ liệu thử nằm trên bản sao và được xóa sau khi kiểm tra.

## Danh mục Thạc sĩ / Tiến sĩ và lọc theo khoa (03/11/2026)

Trang `/chuong-trinh-dao-tao` chia hai phần Thạc sĩ/Tiến sĩ, tìm kiếm chung, phân trang riêng 8 phiên bản mỗi phần. `levelCode=MASTER` lọc Thạc sĩ; `levelCode=DOCTOR` bao gồm mã DOCTOR/PHD trong SQL. Không tạo chương trình mẫu để làm đầy giao diện. Bậc chưa có phiên bản công bố hiển thị thông báo chưa có dữ liệu.

Chỉ hiển thị `program_versions.status=PUBLISHED`, cùng chương trình/ngành/khoa/bậc ACTIVE. Không trả bản nháp, hồ sơ đang duyệt, tài liệu nội bộ hoặc dữ liệu học viên. Khách xem tất cả CTĐT công khai của hai bậc, có thể xem hết qua phân trang. Đây là tra cứu công khai, không phải phân hệ xét tuyển.

Khi gửi JWT hợp lệ:

- Khoa lấy bằng ID SQL từ `users.organizational_unit_id`; nếu chưa gắn đơn vị nhưng có hồ sơ học viên liên kết bằng `students.user_id`, dùng đơn vị hồ sơ đó. Không đoán tên đăng nhập/email hoặc nhận khoa/userId từ query.
- Nếu tài khoản ở bộ môn, tìm khoa cha gần nhất có `unit_type=FACULTY`, trạng thái ACTIVE qua `organizational_unit_closure`.
- Chỉ trả chương trình có đơn vị quản lý nằm trong khoa đó. Cùng điều kiện áp dụng cho danh sách, tổng số, trang chi tiết, phần chương trình nổi bật ở trang chủ. Trang chi tiết ngoài khoa trả 404; không chỉ giấu trên frontend.
- Tài khoản không xác định được khoa: danh sách rỗng và thông báo cần Admin liên kết đơn vị/hồ sơ. Không fallback thành toàn hệ thống.
- Admin không gắn đơn vị có thể xem tất cả CTĐT đã công bố (`view.mode=ADMIN_ALL`). Admin gắn khoa cũng lọc theo khoa đó.
- JWT hết hạn/sai hoặc tài khoản bị vô hiệu: 401, không coi lại là khách trong cùng yêu cầu. Cờ bắt buộc đổi mật khẩu: 403 cho đến khi đổi.

Danh sách trả thêm `view` với `mode=PUBLIC/FACULTY/ADMIN_ALL/UNASSIGNED`, `facultyId`, `facultyName`. Dữ liệu chương trình có thêm `levelCode`. Không trả danh tính người đăng nhập cho khách. Next proxy và server loader chuyển JWT HttpOnly tới backend chỉ trên đường dẫn chương trình, dùng cache `private, no-store`/`Vary: Cookie` cho proxy. Không truyền JWT xuống JavaScript hoặc lưu trong localStorage.

`/ctdt-cua-toi` vẫn dùng phân công ACTIVE chính xác của học viên, không đổi sang danh mục theo khoa và không tự chuyển phiên bản. Các quyền dashboard/ghi/xét duyệt giữ nguyên. Bộ lọc khoa tại đây dành cho trải nghiệm danh mục công khai sau đăng nhập, không cấp thêm quyền PROGRAM_READ/PROGRAM_EDIT cho học viên hoặc giảng viên.

### Test tay

1. Chưa đăng nhập, mở `/chuong-trinh-dao-tao`: thấy hai phần Thạc sĩ/Tiến sĩ và tất cả phiên bản đã công bố; tìm mã/ngành, chuyển từng trang riêng.
2. Đăng nhập tài khoản khoa CNTT: danh sách chỉ có CTĐT công bố thuộc CNTT. Đăng nhập tài khoản khoa Kinh tế: chỉ có dữ liệu công bố thuộc Kinh tế; nếu chưa có dữ liệu phải hiển thị rỗng.
3. Giảng viên thuộc bộ môn Hệ thống thông tin lấy khoa cha CNTT. Admin không gắn khoa thấy tất cả CTĐT công bố.
4. Mở link ID CTĐT khác khoa khi đã đăng nhập: không hiển thị dữ liệu. Đăng xuất: tra cứu công khai vẫn xem được nếu phiên bản đã ban hành.
5. Tài khoản chưa gắn khoa/hồ sơ: thông báo đúng, không hiện lẫn dữ liệu khác. Bản nháp/đang duyệt luôn không xuất hiện kể cả Admin ở trang công khai.
6. Đối chiếu DBeaver: `education_levels`, `program_versions`, `training_programs.managing_unit_id`, `users.organizational_unit_id`, `organizational_units` và `organizational_unit_closure`; với học viên kiểm tra thêm `students.user_id`.

Kiểm thử: `test:public-catalog-integration` và `test:public-catalog-browser` chỉ chạy trên SQL clone `ctdt_major_review_<chuso>`, bật `MAJOR_TEST_ALLOW_WRITES=1`, backend/frontend test cùng clone và JWT_SECRET. `MAJOR_TEST_URL` mặc định http://localhost:3101, backend test http://127.0.0.1:3102. Bài integration tạo dữ liệu công bố tổng hợp chỉ trong clone, lưu `catalog.json` cạnh `MAJOR_BROWSER_FIXTURE` (mặc định `/tmp`); browser dùng Playwright/Chromium và `PLAYWRIGHT_MODULE_PATH` nếu cài ngoài repo. Xóa clone và fixture chứa token sau test. Không chạy script tạo fixture trên database thật.

Trang tham khảo `https://pgd.agu.edu.vn/trainings/majors` trả 403 khi kiểm tra từ môi trường thực hiện; giao diện áp dụng bố cục danh mục hai bậc và nhận diện xanh đang có trong dự án, không tuyên bố sao chép chính xác trang nguồn.
