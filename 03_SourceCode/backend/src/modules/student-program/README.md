# Tra cứu CTĐT cá nhân của học viên

## Cách mở và kiểm thử

1. Đăng nhập ở trang chủ bằng tài khoản học viên có vai trò SQL **STUDENT** và quyền **PROGRAM_READ_OWN**. Sau đăng nhập, học viên trở về trang chủ, thấy nút **CTĐT của tôi** và bấm để mở trang riêng. Học viên không sử dụng dashboard; gõ URL dashboard sẽ được chuyển sang khu vực cá nhân. Admin/cán bộ/người duyệt/giảng viên theo vai trò SQL có thể qua lại trang chủ và dashboard; các chức năng dashboard vẫn kiểm tra quyền riêng.
2. Đường dẫn: `http://localhost:3000/ctdt-cua-toi`.
3. Đối chiếu mã/họ tên học viên, phiên bản và hướng được phân công. Các tài khoản hiện có trên database đang dùng:

   | Tài khoản | Mã học viên | Phiên bản được phân công | Hướng |
   |---|---|---|---|
   | sv001 | SV001 | MIT-2024-v1 (ARCHIVED) | Nghiên cứu |
   | sv002 | SV002 | MIT-2025-v1 (PUBLISHED) | Ứng dụng |
   | sv003 | SV003 | MIT-2025-v1 (PUBLISHED) | Nghiên cứu |

   Dùng mật khẩu hiện có của từng tài khoản; chức năng này không đổi/reset mật khẩu hoặc thêm tài khoản mẫu vào database thật. Nếu tài khoản yêu cầu đổi mật khẩu, hoàn tất luồng đổi mật khẩu trước.
4. Với `sv003`, phải lấy phân công **id=4, ACTIVE, RESEARCH**. Phân công cũ id=3 (APPLICATION, ENDED) không được dùng. Không tự chọn phiên bản mới nhất hoặc suy đoán CTĐT từ khoa/ngành.
5. Đối chiếu nhóm/môn, phiên bản học phần, tín chỉ, tiết LT/TH, tính chất, học kỳ và tiên quyết. Trong MIT-2025, **INF506** là `REQUIRED` ở APPLICATION và `ELECTIVE` ở RESEARCH theo dữ liệu hiện tại. `INF507` hiện là `ELECTIVE` ở cả hai hướng; không nhầm với CTĐT TEST tạo riêng ở các bước kiểm thử trước.
6. Thử tìm `INF506`, lọc nhóm hoặc bắt buộc/tự chọn. Các bộ lọc chỉ lọc danh sách của chính học viên trên trình duyệt, không đổi phân công hay ghi CSDL. Trang không có nút sửa/lưu/gửi duyệt.
7. Đăng xuất rồi đăng nhập học viên khác trên cùng trình duyệt: mã học viên, hướng và dữ liệu phải đổi đúng người; không dùng lại nội dung tài khoản trước.
8. Dùng Admin/cán bộ không có vai trò học viên và quyền riêng: không thấy menu, mở trực tiếp trang bị chặn. Gọi API chưa đăng nhập trả 401; sai quyền trả 403; thử thêm `studentId`, `userId` hoặc `assignmentId` vào query trả 400.

## Đối chiếu DBeaver, không cần gõ SQL

Trong đúng database backend đang dùng, mở **Tables → tên bảng → View Data → All Rows**, rồi bấm **Refresh**:

1. **users**: xác định `id` của tài khoản (`username`). Không cần mở/sao chép `password_hash`.
2. **students**: `user_id` phải bằng `users.id`; kiểm tra `id`, `student_code`, `full_name`, `admission_year`, `status`.
3. **student_program_assignments**: `student_id` bằng `students.id`. Lấy dòng `assignment_status=ACTIVE`, xem `program_version_track_id`. Dòng `ENDED` không phải phân công hiện hành.
4. **program_version_tracks**: đối chiếu `id`, `track_code_snapshot`, `track_name_snapshot`, `required_total_credits` và `program_version_id`.
5. **program_versions**: `id` bằng `program_version_id` vừa tìm; xem `version_code`, `cohort_year`, `status`. `PUBLISHED` và `ARCHIVED` được tra cứu theo view SQL hiện có.
6. **curriculum_groups**: lọc theo `program_version_track_id`, đối chiếu mã/tên nhóm và `minimum_credits`, `maximum_credits`.
7. **curriculum_courses**: cùng `program_version_track_id`; xem `course_version_id`, `curriculum_group_id`, `requirement_type`, `suggested_semester`.
8. **course_versions**: `id` bằng `course_version_id` đã gắn trong khung. Không thay bằng phiên bản ACTIVE/mới nhất của môn đó. `course_id` nối **courses.id** để đọc `course_code`.
9. **curriculum_prerequisites**: `curriculum_course_id` là môn đang xem; `prerequisite_curriculum_course_id` là dòng môn cần học trước; `minimum_grade` giữ nguyên nội dung SQL, không tự đặt điểm mặc định.
10. Trong **Views → vw_student_curriculum → View Data**, đối chiếu `user_id`, `assignment_id`, `program_version_track_id`, `course_version_id`, `credits`, `requirement_type` với giao diện.

Định mức hướng là `program_version_tracks.required_total_credits`. Tổng TC danh sách cộng cả tất cả lựa chọn tự chọn nên có thể lớn hơn định mức. Ví dụ MIT-2025 có thể hiển thị định mức 60 TC và danh sách 63 TC. Đây **không phải tín chỉ học viên đã tích lũy**; module này không tính kết quả học tập hoặc xét tốt nghiệp.

## Các trạng thái không có khung

- **UNLINKED**: có tài khoản nhưng chưa có `students.user_id` trỏ đến tài khoản đó. Không đoán theo tên đăng nhập/email/mã SV; không tự tạo hồ sơ.
- **UNASSIGNED**: đã liên kết học viên nhưng chưa có phân công `ACTIVE`. Không dùng phân công đã kết thúc hoặc chương trình mới nhất thay thế.
- **UNAVAILABLE**: phân công đang hoạt động nhưng phiên bản chưa `PUBLISHED`/`ARCHIVED`; không đưa cấu trúc bản nháp ra cho học viên.
- **READY**: hồ sơ và phân công hợp lệ theo điều kiện trên; đọc đúng một hướng đã gán. Hướng/đơn vị/học phần về sau ngừng dùng không tự thay đổi phân công lịch sử; trạng thái hướng được hiển thị rõ.

Việc tạo/liên kết hồ sơ học viên và phân công thuộc quy trình quản lý hồ sơ đào tạo/nhập học, không phải thao tác trên trang tra cứu. Đăng ký nhận thông tin tuyển sinh ở trang chủ không tự tạo tài khoản, hồ sơ học viên hoặc phân công CTĐT.

## Backend và API

Cấu trúc NestJS:

- `domain/student-program.ts`: dữ liệu và hợp đồng repository.
- `application/student-program.service.ts`: dịch vụ tra cứu.
- `infrastructure/student-program.repository.ts`: truy vấn SQL trong một transaction `REPEATABLE READ` để hồ sơ/phân công/khung cùng snapshot.
- `presentation/student-program.guard.ts`: kiểm tra vai trò STUDENT + quyền PROGRAM_READ_OWN đang hoạt động trong SQL.
- `presentation/student-program.controller.ts`: API JWT.
- `student-program.module.ts`: đăng ký module/provider; nối vào AppModule.

**GET `/sinh-vien/chuong-trinh-dao-tao`** lấy `userId` duy nhất từ JWT đã kiểm tra session. Không nhận studentId/userId/trackId trong path/query/body; không có API sửa phân công trong module này. Response chỉ trả hồ sơ của chính người đăng nhập và một CTĐT đang được phân công. Phân công/khung tra cứu theo **vw_student_curriculum**, bao gồm `ARCHIVED` để giữ CTĐT cũ của học viên; không dùng danh sách chương trình công khai hoặc phạm vi GLOBAL để chọn CTĐT cá nhân.

Frontend proxy **GET `/api/sinh-vien/chuong-trinh-dao-tao`** dùng cookie HttpOnly hiện có. Không đưa token ra JavaScript phía trình duyệt. Proxy không nhận ID từ người dùng, không cache nội dung cá nhân (`Cache-Control: private, no-store`, `Vary: Cookie`). JWT hết hạn/khóa tài khoản/đổi quyền có hiệu lực khi gọi lại API. Những API quản lý CTĐT chung vẫn theo quyền hiện có; quyền `PROGRAM_READ_OWN` không cho sửa khung, xem học viên khác hoặc truy cập Admin.

Không cần migration, thêm quyền mới, dependency mới hoặc sửa dữ liệu nghiệp vụ để sử dụng. Cần backend/frontend đang chạy với `.env` trỏ đúng database đã có các bảng/view trên.

## Kiểm tra tự động

```bash
cd 03_SourceCode/backend
npm test -- --runInBand
npm run test:student-program-integration
npm run test:student-program-browser
```

Hai script cuối chỉ cho phép database bản sao **ctdt_major_review_<timestamp>** với `MAJOR_TEST_ALLOW_WRITES=1`, backend/frontend và JWT_SECRET riêng trỏ đúng bản sao. Integration tạo các tài khoản tạm, liên kết chúng với ba hồ sơ nguồn **trên bản sao**, thử quyền/session, phiên bản ARCHIVED, phân công ENDED/ACTIVE, môn có bản mới, hồ sơ chưa gán và chống truy cập chéo. Fixture `own.json` đặt cạnh đường dẫn `MAJOR_BROWSER_FIXTURE`; browser dùng fixture này và Playwright/Chromium (`PLAYWRIGHT_MODULE_PATH` nếu module ngoài dự án). Không chạy script ghi trên database đang sử dụng; không reset mật khẩu tài khoản thật. Các bài test ghi đều được chạy trên bản sao dùng một lần và dọn sau khi kiểm tra.


## Tách khu vực học viên và bỏ đăng ký học phần mẫu

- Trang cá nhân hiện là **`/ctdt-cua-toi`**, dùng header/footer của trang chủ, không có sidebar hoặc layout dashboard.
- Trang chủ lấy phiên đăng nhập ở server. Khách không thấy nút CTĐT cá nhân; học viên có quyền mới thấy. Mở trực tiếp trang riêng khi chưa đăng nhập được chuyển tới `/dang-nhap?next=/ctdt-cua-toi`.
- Học viên đăng nhập bình thường trở về trang chủ. Khi được yêu cầu đăng nhập để mở trang riêng, quay lại đúng `/ctdt-cua-toi` sau đăng nhập. Không cho học viên dùng `next=/dashboard/...` để đi vào khu vực quản lý.
- Nhân sự có vai trò quản lý `ADMIN`, `TRAINING_OFFICER`, `APPROVER`, `LECTURER` thấy nút **Dashboard** ở trang chủ và liên kết **Trang chủ** trong dashboard. Đây chỉ là điều hướng theo vai trò; không cấp thêm bất kỳ quyền API nào. Tài khoản nhiều vai trò có vai trò nhân sự vẫn vào dashboard theo các quyền được gán trong SQL.
- Menu tài khoản trên trang chủ có đổi mật khẩu và đăng xuất. Đăng xuất về trang chủ và ẩn các mục cần phiên đăng nhập.
- Đã xóa file trang mẫu `frontend/app/dashboard/dang-ky-hoc-phan/page.tsx` và `frontend/app/dashboard/sinh-vien/dang-ky/page.tsx`, cùng các mục menu. Hai URL đó trả 404, không còn thông báo gửi phiếu thành công giả.
- Đường dẫn cá nhân cũ `/dashboard/sinh-vien/chuong-trinh-dao-tao` chuyển hướng sang `/ctdt-cua-toi` để giữ bookmark cũ; file giao diện cũ đã được chuyển vào `components/student/StudentProgramContent.tsx`.
- Giữ nguyên bảng lớp học, đăng ký học phần và các ràng buộc SQL vì module điểm/học vụ vẫn sử dụng. Không xóa đăng ký nhận thông tin tuyển sinh ở trang chủ.
- Các bài kiểm tra chuyển tài khoản, CTĐT lưu trữ, tính chất môn, phân quyền và chống truy cập chéo vẫn áp dụng. Browser test bổ sung kiểm tra khách/học viên/nhân sự, điều hướng hai chiều, URL đăng ký đã xóa và đăng xuất.
