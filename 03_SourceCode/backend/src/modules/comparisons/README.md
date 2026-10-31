# So sánh chương trình đào tạo — NestJS + Next.js

Module chỉ đọc CSDL, không thêm dữ liệu mẫu, không cập nhật CTĐT, không đổi quyền hiện có.
Không cần migration mới. Máy mới vẫn phải import CSDL và chạy đầy đủ migration của dự án (đặc biệt ProgramUi).

## Nguồn SQL

| Giao diện/API | Bảng/cột SQL |
|---|---|
| Chọn phiên bản | program_versions.id, version_code, program_name_snapshot, cohort_year, status |
| Mã CTĐT, ngành, bậc, đơn vị | training_programs + majors + education_levels + organizational_units |
| Chọn hướng | program_version_tracks.id, track_code_snapshot, track_name_snapshot, status |
| Định mức TC hướng | program_version_tracks.required_total_credits |
| Thông tin nhập bổ sung | program_ui_details: study_form, duration_label, cohort_label, required_total_credits, language_requirement, it_requirement |
| Nhóm kiến thức | curriculum_groups: group_code, group_name, parent_group_id, minimum_credits, maximum_credits |
| Học phần | curriculum_courses.course_id, course_version_id → đúng course_versions, không lấy bản mới nhất |
| Vị trí học phần | curriculum_courses.curriculum_group_id, requirement_type, suggested_semester, notes |
| Nội dung HP | course_versions.course_name, english_name, version_no, credits, theory_hours, practice_hours, description |
| Tiên quyết | curriculum_prerequisites + curriculum_courses đích; giữ minimum_grade kể cả NULL |
| Chuẩn đầu ra | program_learning_outcomes.plo_code, description, status |
| Ánh xạ HP–PLO | curriculum_course_plos.contribution_level + PLO gốc |
| Phạm vi | vw_user_program_access: GLOBAL/ORG_UNIT và đơn vị con/MAJOR/PROGRAM |

## Logic

- Mỗi bên chọn **phiên bản + hướng thuộc đúng phiên bản đó**. Không cộng lẫn nghiên cứu/ứng dụng.
- Nhận diện cùng học phần bằng course_id; đổi course_version_id được đánh dấu thay đổi ngay cả khi tên/TC giống nhau.
- Nhóm và PLO đối chiếu bằng mã. Đổi mã là chỉ A/chỉ B; không tự suy luận tương đương theo tên.
- Tiên quyết/ánh xạ được chuẩn hóa: đổi thứ tự dòng không tạo khác biệt giả. Thứ tự hiển thị không phải tiêu chí khác biệt cấu trúc.
- Bốn kết quả: giữ nguyên, thay đổi, chỉ A, chỉ B. “Chỉ A/B” không khẳng định lịch sử thêm/xóa nếu A/B không theo thời gian.
- Định mức hướng khác tổng TC toàn bộ danh sách: danh sách chứa toàn bộ lựa chọn tự chọn.
- Thiếu dữ liệu bổ sung giữ NULL/chuỗi trống và hiển thị “—”; không suy ra IELTS, thời gian, hình thức, định mức chung.
- Giữ đầy đủ hướng/PLO ngừng hoạt động và phiên bản nháp/chờ duyệt/ban hành/lưu trữ/ngừng dùng trong phạm vi SQL.
- Phiên bản chưa có hướng không so sánh được; CTĐT chưa có phiên bản chưa có cấu trúc để đưa vào bộ chọn.
- Hai bên đọc trong cùng transaction REPEATABLE READ. Xuất Excel đọc lại và kiểm tra quyền ở thời điểm xuất.
- Không chỉnh sửa/sao chép cấu trúc, quy đổi tín chỉ, kết luận tương đương HP hay đối chiếu nội dung file đề cương.
- Bậc/ngành/đơn vị lấy danh mục liên kết hiện tại. SQL gốc chỉ lưu snapshot tên CTĐT/hướng, không có snapshot lịch sử tên đơn vị.

## Quyền

Cần JWT + session còn hiệu lực + quyền SQL PROGRAM_COMPARE.
Guard đọc lại quyền từ role ACTIVE mỗi request. Không có ngoại lệ ADMIN.

SQL hiện tại cấp quyền này cho TRAINING_OFFICER và APPROVER; ADMIN mặc định không có.
Nguồn local lúc đối chiếu:
- officer.fit, approver.fit: CTĐT thuộc phạm vi CNTT.
- officer.fbe, thuan: theo phạm vi Kinh tế; không được đọc CTĐT CNTT.
- Dùng mật khẩu hiện tại; module không đặt lại mật khẩu.

Menu/truy cập trực tiếp dùng PROGRAM_COMPARE đã có trong dashboardAccess.
Inject ID khoa khác hoặc hướng không thuộc phiên bản → 404.
Thiếu đăng nhập/phiên bị thu hồi → 401; thiếu quyền → 403; query sai → 400.

## API / Swagger

Swagger: http://localhost:3002/api → nhóm Comparisons - So sánh CTĐT.

- GET /so-sanh/options?searchTerm=&page=1&limit=30: phiên bản + hướng, tối đa 100/trang, tìm mã/tên/phiên bản.
- GET /so-sanh?versionA=1&trackA=1&versionB=2&trackB=3: snapshot hai bên, differences học phần/nhóm/PLO, thống kê.
- GET /so-sanh/export với cùng bốn query: .xlsx thật, 4 sheet tổng quan/học phần/nhóm/PLO, cột A/B từng trường.
- ID là chuỗi số nguyên dương, không chuyển BIGINT qua Number.
- Frontend gọi /api/so-sanh/...; proxy lấy JWT từ cookie HttpOnly, không đưa token vào JavaScript.
- Proxy chỉ cho GET ba đường dẫn trên, không cache, che lỗi nội bộ, xóa cookie khi upstream trả 401.
- ExcelJS ghi chuỗi thành text, không biến tên bắt đầu bằng dấu bằng thành công thức.
  Nội dung quá giới hạn ô Excel được chia tiếp dòng, không bỏ nội dung.
- Tìm HP/lọc khác biệt chỉ lọc bảng màn hình; Excel xuất **toàn bộ** đối chiếu đã chọn.

## Chạy để test giao diện

Tại gốc dự án:

```bash
sudo systemctl start ctdt-mariadb-dev
cd 03_SourceCode/backend
npm ci                 # khi mới clone hoặc dependency thay đổi
npm run migration:run  # máy mới/thiếu migration; so sánh không có migration mới
npm run start:dev
```

Terminal khác:

```bash
cd 03_SourceCode/frontend
npm ci                 # khi cần
npm run dev
```

Cấu hình backend/.env và frontend/.env.local riêng mỗi máy theo file mẫu.
BACKEND_API_URL ở frontend thường http://127.0.0.1:3002.
Mở http://localhost:3000/dang-nhap rồi http://localhost:3000/dashboard/so-sanh.
Nếu đã có next dev chạy thì dùng server đang có, không khởi động trùng.

1. Đăng nhập officer.fit hoặc approver.fit với mật khẩu hiện tại.
2. Chọn phiên bản A, hướng A, phiên bản B, hướng B. Ban đầu không chọn dữ liệu giả.
3. Nguồn local hiện có MIT-2024-v1 / MIT-2025-v1 / MIT-2026-v1 và BIT-2026-v1: 4 phiên bản, 7 hướng, 106 dòng cấu trúc.
4. A = MIT-2024-v1 → RESEARCH: 15 HP, định mức 60 TC. B cùng phiên bản → APPLICATION: 18 HP, định mức 60 TC.
   Tổng TC danh sách mỗi bên 63 (gồm toàn bộ tự chọn), không đổi định mức thành 63.
   Nguồn lúc kiểm tra: 11 giữ nguyên, 1 thay đổi, 3 chỉ A, 6 chỉ B.
5. Chọn cùng phiên bản/hướng: tất cả HP giữ nguyên.
6. So MIT-2024-v1 RESEARCH với MIT-2025-v1 RESEARCH: mở chi tiết kiểm tra đúng phiên bản HP cũ/mới.
7. Tìm tên/mã, lọc chỉ A/chỉ B/thay đổi. Không có kết quả phải hiện trạng thái rỗng.
8. Mở “Xem đầy đủ dữ liệu”: TC/nhóm/học kỳ/tiên quyết/PLO/mô tả từng bên.
9. Xuất Excel, mở 4 sheet. Xuất lại có thể phản ánh sửa đổi mới nếu người khác sửa nháp.
10. Đăng nhập thuan/officer.fbe: không thấy CNTT. Kinh tế chưa có phiên bản/hướng thì danh sách trống là đúng.
11. Admin mặc định: không có menu So sánh; API trả 403.
12. Đăng xuất gọi API: 401. Không có quyền không thể vượt guard bằng URL trực tiếp.

SQL chỉ đọc để đối chiếu DBeaver:

```sql
SELECT p.program_code, v.id AS version_id, v.version_code, v.status,
       t.id AS track_id, t.track_code_snapshot, t.required_total_credits,
       COUNT(cc.id) AS course_count, COALESCE(SUM(cv.credits),0) AS listed_credits
FROM training_programs p
JOIN program_versions v ON v.program_id=p.id
JOIN program_version_tracks t ON t.program_version_id=v.id
LEFT JOIN curriculum_courses cc ON cc.program_version_track_id=t.id
LEFT JOIN course_versions cv ON cv.id=cc.course_version_id
GROUP BY p.program_code,v.id,v.version_code,v.status,t.id,t.track_code_snapshot,t.required_total_credits
ORDER BY v.id,t.id;

SELECT cc.id, cc.course_id, c.course_code, cc.course_version_id, cv.version_no,
       cv.course_name, cv.credits, g.group_code, cc.requirement_type, cc.suggested_semester
FROM curriculum_courses cc
JOIN courses c ON c.id=cc.course_id
JOIN course_versions cv ON cv.id=cc.course_version_id
JOIN curriculum_groups g ON g.id=cc.curriculum_group_id
WHERE cc.program_version_track_id=1
ORDER BY c.course_code;
```

Thay track_id phù hợp. Không so số HP của một hướng với tổng cả phiên bản.

## Kiểm tra tự động

Backend:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm run test:comparison-integration
```

test:comparison-integration chỉ đọc DB trong backend/.env:
- Đối chiếu phạm vi/danh sách/nhóm/HP/đúng course_version/tiên quyết/PLO/metadata NULL với SQL.
- Phân trang/tìm kiếm/query sai, so cùng hướng và khác phiên bản/hướng, đảo A/B, export và ngoài phạm vi.
- Dùng controller/DTO/SQL guard thật trong Nest test app; chỉ JWT guard được thay để lặp qua user mà không tạo session trong nguồn.
- Script này không kiểm tra transport đăng nhập/JWT; dùng test trình duyệt sau.

Frontend: npm run build và npm run lint.

Test trình duyệt tùy chọn (Playwright) chỉ dùng **bản sao dùng xong bỏ**:
1. Clone SQL sang tên ctdt_comparison_review_<timestamp>, giữ view/trigger/migration và quyền kết nối clone.
2. Backend: DB_DATABASE trỏ clone, PORT=3102.
3. Frontend: BACKEND_API_URL=http://127.0.0.1:3102, cổng 3101, DATABASE_URL cũng trỏ clone.
4. Cài Playwright/trình duyệt trong môi trường test riêng; không thêm dependency runtime vào dự án.
5. Tại backend truyền DB_DATABASE cùng clone, COMPARISON_TEST_ALLOW_WRITES=1,
   COMPARISON_TEST_URL=http://localhost:3101, PLAYWRIGHT_MODULE_PATH=/đường/dẫn/node_modules/playwright;
   chạy npm run test:comparison-browser.
   Có thể truyền COMPARISON_SCREENSHOT (mặc định /tmp/ctdt-comparison-browser.png).
6. Script tạo user test trên clone, kiểm tra đăng nhập thật/cookie/chọn/lọc/xuất/thiếu quyền/khác khoa,
   thu hồi role ngay trong phiên, thu hồi session, lỗi runtime.
7. Dừng server test và xóa clone sau khi xong. Không chạy script browser trên database làm việc/production.
   Clone cần phiên bản có ≥ 2 hướng và một đơn vị khác để kiểm tra cách ly.

Bàn giao QA: push module/API/frontend/test/README và package.json, không push .env/node_modules/dist/.next/DB test.
Dữ liệu riêng nhập trên máy không tự đi theo Git; nhóm cần import cùng dữ liệu để thấy cùng nội dung.

## Kết quả kiểm tra lần triển khai 31/10/2026

- Backend/frontend build và lint: qua.
- Toàn bộ unit test: 196 test, 24 suite, qua.
- Nguồn SQL thực: 1.121 kiểm tra chỉ đọc SQL/HTTP/XLSX, qua (14 lượt hướng theo các tài khoản có quyền).
- Trình duyệt thật trên clone: chọn cùng/khác hướng, lọc, tải Excel, đăng nhập, proxy/JWT, thiếu quyền,
  ngoài khoa, thu hồi role/session và 18 kiểm tra hợp đồng, qua; không có lỗi runtime.
- Clone và quyền kết nối clone đã được dọn; không thêm tài khoản hay thay đổi nội dung CTĐT trên nguồn.
- Không có migration mới; thay đổi gồm 19 file (3 sửa, 16 mới). Chưa commit/push tự động.