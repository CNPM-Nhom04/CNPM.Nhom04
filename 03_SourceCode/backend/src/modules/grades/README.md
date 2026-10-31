# Quản lý điểm — NestJS và frontend

- Trang: http://localhost:3000/dashboard/quan-ly-diem
- Đăng nhập: http://localhost:3000/dang-nhap
- Swagger: http://localhost:3002/api → Grades - Quản lý điểm

## Đối chiếu SQL

CSDL.sql đã có student_course_results với grade dạng VARCHAR, result_status,
course_id/course_version_id, course_offering_id nullable và passed_at.
Dữ liệu hiện tại có 9 kết quả: 7 PASSED, 1 FAILED, 1 EXEMPTED.
Các kết quả gốc chưa liên kết lớp học phần và chưa có điểm thành phần.
Module giữ nguyên các giá trị này, không chuyển miễn học phần thành điểm 0,
không suy điểm chuyên cần/giữa kỳ/thi hoặc áp lại ngưỡng hiện tại cho quá khứ.

CSDL còn có course_registrations, course_offerings, registration_periods,
academic_terms, courses/course_versions, students, quyền và các view phạm vi.
Điểm nhập mới gắn với **đúng đăng ký, học viên, lớp và phiên bản học phần**.
Không nhập lại họ tên hoặc chọn tên học phần gán cứng; không đổi lớp/học viên
khi sửa điểm; học lại ở lớp khác tạo kết quả khác.

Migration 1793350800000-Grades thêm:

| Thành phần                      | Công dụng                                                                |
| ------------------------------- | ------------------------------------------------------------------------ |
| student_course_results.revision | Chặn hai người sửa từ cùng dữ liệu cũ                                    |
| grade_policies                  | Trọng số, điểm đạt, số chữ số, kiểu làm tròn, hồ sơ theo lớp             |
| grade_details                   | Điểm thành phần, tổng điểm, đăng ký, quy tắc và trạng thái nháp/chốt/hủy |
| grade_revisions                 | Lịch sử bất biến trước/sau, người, thời điểm, lý do, số hồ sơ            |
| GRADE_READ / GRADE_MANAGE       | Quyền xem / ghi điểm từ SQL                                              |

Có foreign key, unique key một kết quả/học viên/lớp và một chi tiết/đăng ký,
CHECK điểm/trọng số, trigger kiểm tra quan hệ lớp/phiên bản/quy tắc,
khóa sửa quy tắc đã dùng và khóa xóa/sửa lịch sử.
Không chèn điểm hoặc quy tắc mẫu. Không sửa CSDL.sql gốc.

## Quyền và phạm vi

| Vai trò được migration cấp | Xem                         | Ghi / chốt / điều chỉnh |
| -------------------------- | --------------------------- | ----------------------- |
| ADMIN                      | Có                          | Không                   |
| APPROVER                   | Có                          | Không                   |
| TRAINING_OFFICER           | Có                          | Có                      |
| STUDENT                    | Không ở trang nghiệp vụ này | Không                   |

Quyền thực tế luôn lấy từ SQL, không bypass theo tên tài khoản/ADMIN.
Lịch sử điểm và danh sách đăng ký yêu cầu **đồng thời**:
vw_user_student_access cho học viên và vw_user_course_access cho học phần.
GLOBAL/ORG_UNIT/đơn vị con phải phù hợp; PROGRAM/MAJOR đơn thuần không
cấp quyền danh tính học viên hoặc ngân hàng học phần theo các view hiện có.
Danh sách lớp/quy tắc theo phạm vi học phần; không trả danh tính học viên ngoài phạm vi.
Ngoài phạm vi ID trả 404, thiếu quyền chức năng trả 403, phiên hết hạn trả 401.
Mọi lệnh ghi kiểm tra lại quyền SQL và quan hệ trong transaction.

## Quy tắc chấm điểm

Không gán cứng 10%–30%–60% hoặc ngưỡng 5,5.

1. Mở tab Lớp & quy tắc chấm điểm, chọn lớp thật.
2. Nhập tỷ trọng chuyên cần/giữa kỳ/thi theo hồ sơ; tổng phải 100%.
3. Nhập điểm đạt >0..10, số chữ số thập phân 0/1/2,
   HALF_UP (từ 5 làm tròn lên) hoặc TRUNCATE (cắt phần dư), và số hồ sơ áp dụng.
4. Trọng số/ngưỡng/làm tròn chưa có thì form để trống.
   Nếu SQL thật có system_settings.training.diemDatHocPhan,
   API đọc làm giá trị tham khảo/điền sẵn; không lấy fallback của giao diện Admin.
   Quy tắc theo lớp phải được cán bộ đối chiếu với hồ sơ và lưu rõ vào SQL.
   Tham số SQL sai định dạng trả lỗi, không thay bằng ngưỡng giả.
5. Backend tính tổng bằng số nguyên theo phần trăm/điểm có hai chữ số,
   rồi áp dụng đúng cách làm tròn của policy. Tránh lỗi nhị phân ở các mốc như 1,015.
6. Chưa nhập điểm khác với điểm 0. Thành phần có trọng số >0 mà trống
   làm tổng để NULL; trọng số 0 cho phép bỏ trống.
7. Quy tắc được sửa với revision trước khi có bảng điểm.
   Sau khi đã nhập một bảng điểm, quy tắc giữ cố định để bảo toàn kết quả;
   module chưa có quy trình đổi công thức và tính lại cả lớp.

## Nhập, chốt và điều chỉnh

- Chọn đăng ký REGISTERED thực tế, không chọn đăng ký CANCELLED/WITHDRAWN/VOIDED.
- Nhập nháp cho lớp OPEN/CLOSED/CONFIRMED/COMPLETED.
  Lớp PLANNED/CANCELLED không được ghi mới.
- Lưu DRAFT tạo student_course_results.INCOMPLETE, grade/passed_at NULL.
  Điểm nháp không được tính vào vw_student_passed_courses.
- Chỉ chốt DRAFT khi lớp COMPLETED, đăng ký còn REGISTERED và đủ điểm có trọng số.
  Backend so tổng đã làm tròn với ngưỡng SQL để ghi PASSED hoặc FAILED.
- Bản đã chốt được sửa theo hồ sơ và lý do, tính lại đúng policy cũ,
  tăng revision và lưu toàn bộ trước/sau. Sửa PASSED thành PASSED giữ thời điểm đạt cũ;
  đổi FAILED thành PASSED ghi thời điểm xác nhận đạt; chuyển FAILED xóa passed_at.
- Hủy hiệu lực giữ chi tiết/lịch sử, chuyển kết quả INCOMPLETE và ngừng tính đạt.
  Mở lại chỉ từ VOIDED, đăng ký/lớp còn hợp lệ, trở về DRAFT với các ô điểm trống.
- Không xóa cứng, không ghi đè lần học khác. Một học phần có thể có nhiều kết quả
  ở các lớp khác nhau; view SQL vẫn tính đạt khi còn bất kỳ PASSED/EXEMPTED nào.
- Không tự đổi trạng thái lớp, đăng ký, chương trình, xét tốt nghiệp hoặc tự hủy
  các đăng ký đã tồn tại khi điều chỉnh điểm. Những nghiệp vụ đó có luồng riêng.

**Kết quả cũ LEGACY** không có thành phần/policy được điều chỉnh bằng hồ sơ chính thức:
nhập grade/ký hiệu và result_status rõ ràng. Không tính lại từ trọng số/ngưỡng hiện tại.
PASSED/EXEMPTED cần ngày đạt/miễn theo hồ sơ, không ở tương lai.
PASSED/FAILED cần điểm/ký hiệu; INCOMPLETE phải để trống điểm và ngày đạt.
EXEMPTED cho phép grade NULL. Ngày theo múi giờ Việt Nam được lưu về UTC.
Điểm gốc có thể là ký hiệu như A; không tự quy đổi sang điểm số.
Thao tác này không xác minh được tính xác thực của chứng từ; cán bộ phải đối chiếu hồ sơ thật.

Tất cả thao tác ghi yêu cầu số hồ sơ và nội dung/lý do; grade_revisions và audit_logs
lưu cùng transaction. Audit lỗi thì điểm/chi tiết được rollback, không ghi dở dang.

## API backend

Frontend dùng /api/quan-ly-diem/... qua cookie HttpOnly và proxy cùng origin.

| Method | Path                              | Chức năng                                         |
| ------ | --------------------------------- | ------------------------------------------------- |
| GET    | /quan-ly-diem                     | Đọc tất cả kết quả, tìm/lọc/phân trang            |
| GET    | /quan-ly-diem/lop-hoc             | Lớp học phần từ SQL                               |
| GET    | /quan-ly-diem/dang-ky             | Đăng ký hợp lệ chưa có kết quả cho đúng lớp       |
| GET    | /quan-ly-diem/lop-hoc/:id/quy-tac | Quy tắc, lớp, trạng thái khóa và tham số SQL thật |
| POST   | /quan-ly-diem/lop-hoc/:id/quy-tac | Lưu quy tắc trước khi nhập điểm                   |
| GET    | /quan-ly-diem/:id                 | Chi tiết và toàn bộ lịch sử                       |
| POST   | /quan-ly-diem                     | Lưu nháp                                          |
| POST   | /quan-ly-diem/:id/cap-nhat        | Sửa điểm thành phần                               |
| POST   | /quan-ly-diem/:id/chot            | Chốt                                              |
| POST   | /quan-ly-diem/:id/huy             | Hủy hiệu lực                                      |
| POST   | /quan-ly-diem/:id/mo-lai          | Mở lại nhập nháp                                  |
| POST   | /quan-ly-diem/:id/dieu-chinh      | Điều chỉnh kết quả cũ theo hồ sơ                  |

Query: page, limit (tối đa 100), searchTerm.
List thêm resultStatus=ALL/PASSED/FAILED/INCOMPLETE/EXEMPTED,
state=ALL/LEGACY/DRAFT/FINALIZED/VOIDED, offeringId.
Đăng ký thêm offeringId.
ID là chuỗi; điểm là JSON number hoặc NULL; không gửi số dưới dạng chuỗi.

Body nháp: registrationId, attendanceScore, midtermScore, examScore, note, reference.
Body sửa: revision thay cho registrationId; gửi đầy đủ ba thành phần, trống gửi NULL.
Chốt/hủy/mở lại: revision, note, reference.
Điều chỉnh cũ: revision, grade, resultStatus, passedDate, note, reference.
Policy: revision (0 khi chưa có, revision hiện tại nếu đã có), attendanceWeight,
midtermWeight, examWeight, passingScore, decimalPlaces, rounding, reference.
Hai request từ revision cũ không được cùng thành công.

## Chạy trên máy local / máy QA

Terminal backend:

```bash
sudo systemctl start ctdt-mariadb-dev
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/backend
npm ci
npm run migration:run
npm run start:dev
```

Terminal frontend:

```bash
cd ~/ctdt-system/CNPM.Nhom04/03_SourceCode/frontend
npm ci
npm run dev
```

MariaDB local hiện dùng ctdt_management, cổng 3307.
Mỗi máy điền backend/.env theo .env.example bằng tài khoản DB của mình.
Frontend/.env.local: BACKEND_API_URL=http://127.0.0.1:3002.
Không commit .env/password/SMTP. Code pull về không mang theo dữ liệu nhập local.
Máy mới import CSDL.sql gốc theo hướng dẫn dự án rồi chạy migrations.
Máy đã có DB chạy migration:run trước khi mở trang quản lý điểm.

## Test giao diện

1. Admin: thấy 9 kết quả gốc (theo SQL local lúc triển khai), cả miễn học phần;
   không có nút nhập/sửa/chốt. Các điểm thành phần cũ hiển thị trống.
2. Cán bộ FIT thấy dữ liệu FIT. FBE/thuan có scope FBE không thấy điểm FIT.
   Đối chiếu user_scopes và hai view quyền, không suy quyền chỉ từ tên tài khoản.
3. Tab Lớp & quy tắc: lớp chưa có policy để trống trọng số/ngưỡng/làm tròn.
   Lưu theo quy định thật, tải lại để kiểm tra đã lưu SQL.
4. Nhập bảng điểm mới: chọn đăng ký từ SQL. Thử nhập 0 và để trống ô khác,
   lưu nháp rồi tải lại. Tổng phải NULL khi còn thiếu thành phần có trọng số.
5. Nhập đủ rồi chốt trên **database test có lớp COMPLETED**.
   Với DB gốc, các lớp hiện là OPEN: lưu nháp được, chưa chốt được là đúng.
   Module điểm không tự chuyển lớp sang COMPLETED.
6. Chốt điểm, điều chỉnh qua ngưỡng đạt, hủy/mở lại và xem lịch sử.
   Lớp khác cùng học phần phải giữ kết quả riêng; miễn học phần không bị biến thành điểm 0.
7. Mở kết quả cũ, chọn Điều chỉnh theo hồ sơ: điền đúng kết quả/điểm/ngày đạt
   và chứng từ. Kiểm tra lịch sử giữ nguyên dữ liệu trước khi sửa.
8. Thử điểm âm/>10, số có quá hai chữ số, trọng số không đủ 100,
   revision cũ, tài khoản chỉ đọc gọi POST, ID khác khoa, đăng ký đã hủy.
   Phải trả lỗi và không lưu điểm dở dang.

SQL đối chiếu DBeaver:

```sql
SELECT r.id,s.student_code,s.full_name,c.course_code,v.course_name,
       v.version_no,co.class_code,r.grade,r.result_status,r.passed_at,r.revision,
       d.state,d.attendance_score,d.midterm_score,d.exam_score,d.total_score
FROM student_course_results r
JOIN students s ON s.id=r.student_id
JOIN courses c ON c.id=r.course_id
JOIN course_versions v ON v.id=r.course_version_id
LEFT JOIN course_offerings co ON co.id=r.course_offering_id
LEFT JOIN grade_details d ON d.result_id=r.id
ORDER BY r.id DESC;

SELECT * FROM grade_policies ORDER BY id;
SELECT * FROM grade_revisions ORDER BY result_id,revision;
SELECT * FROM vw_student_passed_courses ORDER BY student_id,course_id;
```

## Kiểm thử tự động

Backend:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm run test:grade-parity
```

Parity chỉ đọc DB được cấu hình, không tạo tài khoản/session hoặc dữ liệu thử.

Frontend:

```bash
npm run build
npx eslint app/dashboard/quan-ly-diem/page.tsx lib/services/gradeService.ts \
  lib/dashboardAccess.ts 'app/api/quan-ly-diem/[[...path]]/route.ts' --max-warnings=0
```

Integration/browser ghi dữ liệu: dùng **bản sao mới** tên ctdt_grade_review_<timestamp>,
đã có schema/data/trigger/view và chạy migration; dừng/xóa sau test.
Không dùng DB thật. Thay <timestamp> bằng số thực, không gõ nguyên dấu <>.

```bash
# Terminal backend
DB_DATABASE=ctdt_grade_review_<timestamp> PORT=3102 npm run start:prod

# Terminal frontend
BACKEND_API_URL=http://127.0.0.1:3102 npm run dev -- --hostname 127.0.0.1 --port 3101

# Terminal backend khác
GRADE_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_grade_review_<timestamp> \
  GRADE_TEST_URL=http://localhost:3101 npm run test:grade-integration
```

Dùng localhost khi mở frontend test để origin khớp cấu hình Next.
Script dùng session chỉ có trên bản sao để probe API trước khi ghi HTTP.
Bài test có điều chỉnh một số kết quả gốc trên **bản sao**, nên dùng bản sao
mới khi chạy lại cả bộ để so sánh đúng dữ liệu ban đầu.

Browser optional: cần Playwright cài riêng trên máy test, chạy sau integration:

```bash
GRADE_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_grade_review_<timestamp> \
  PLAYWRIGHT_MODULE_PATH=/duong-dan/node_modules/playwright \
  npm run test:grade-browser
```

Fixture tạm nằm ngoài repo, chỉ chứa tài khoản test và tên DB bản sao.
Không thêm Playwright vào dependency production.

Kết quả triển khai:

- 176 unit tests / 21 suites đạt.
- 185 kiểm tra HTTP/frontend proxy/SQL đạt, gồm transaction rollback,
  làm tròn, học lại, điều chỉnh, view tiên quyết, cạnh tranh và thu hồi quyền.
- Test trình duyệt trên phiên dev sạch đạt: đăng nhập, cấu hình SQL, nhập 0/NULL,
  nháp/chốt/sửa, reload, điều chỉnh kết quả cũ và quyền theo khoa; không lỗi runtime.
- Backend/frontend production build và lint đạt.
- Khởi động frontend production test bị kiểm tra phê duyệt tự động chặn
  (blocked by policy); không ghi nhận đó là một bài browser test production đã chạy.

Đối chiếu local sau migration: 101 kiểm tra chỉ đọc đạt; hash của toàn bộ 9 kết quả gốc trước/sau migration trùng nhau.
