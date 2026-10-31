# Xét điều kiện tốt nghiệp — NestJS + Next.js + MariaDB

Module thay dữ liệu mẫu trên xet-tot-nghiep bằng SQL thực.
Phạm vi là đối chiếu điều kiện và lưu lịch sử kiểm tra. Không có quyết định công nhận, số hiệu bằng hay phát hành bằng trong schema gốc;
module không tự đổi students.status thành GRADUATED và không tạo bằng.

## Nguồn SQL

| Nội dung | Bảng/cột |
|---|---|
| Học viên | students: student_code, full_name, status |
| Đúng lần phân công | student_program_assignments.id, student_id, program_version_track_id, assignment_status |
| Phiên bản/hướng | program_versions, program_version_tracks; dùng snapshot tên và đúng ID đã phân công |
| Định mức TC | program_version_tracks.required_total_credits, không mặc định 60/90 |
| Nhóm kiến thức | curriculum_groups: parent_group_id, minimum_credits, maximum_credits |
| Học phần/TC | curriculum_courses → đúng course_versions.credits/version_no; không lấy bản mới nhất |
| Kết quả đạt/miễn | student_course_results: PASSED/EXEMPTED, course_version_id, passed_at |
| Bảo vệ | thesis_defenses: assignment_id, status DA_DAT, defense_date, average_score |
| Quy định xét | graduation_policies theo program_version_track_id |
| Hồ sơ xác minh | graduation_evidence theo assignment_id |
| Lịch sử | graduation_events: POLICY/EVIDENCE/CHECK, data JSON, actor, thời điểm |
| Phạm vi | đồng thời vw_user_program_access và vw_user_student_access |

Danh sách mỗi dòng là một assignment, mặc định ACTIVE. Có bộ lọc ENDED/ALL để xem các lần cũ.
Học viên chưa được phân công không có căn cứ CTĐT để xét; module không tự gán chương trình.
Không dùng toàn bộ học phần ngân hàng hoặc CTĐT của khoa khác để bù tín chỉ.

## Logic đối chiếu

1. Kiểm tra trạng thái học viên và assignment ACTIVE; phiên bản phải PUBLISHED/ARCHIVED.
2. Dùng đúng curriculum của track, đọc nhóm cha/con và định mức từng nhóm.
3. Một curriculum course chỉ được tính một lần dù có nhiều lần học/đạt.
   PASSED và EXEMPTED là kết quả đủ điều kiện tính TC. EXEMPTED với grade NULL không biến thành điểm 0.
4. Chỉ kết quả **đúng course_version_id** được tự tính. Cùng course_id nhưng phiên bản khác được ghi rõ,
   chưa tự coi là công nhận tương đương. Schema hiện chưa có hồ sơ công nhận tương đương cho tốt nghiệp.
5. Phải đạt toàn bộ HP REQUIRED, đủ TC mỗi nhóm và tổng định mức.
   TC vượt maximum_credits của nhóm không bù cho nhóm khác. Nhóm con được cộng một lần và áp dụng trần trước khi lên nhóm cha.
6. Cấu trúc trống/sai/vòng lặp/định mức nhóm không khớp phải hiện thiếu thông tin, không kết luận đủ điều kiện.
7. Không tự tính ĐTB từ transcript tối giản: SQL hiện có điểm chữ, miễn, nhiều lần học và chưa có quy tắc GPA tốt nghiệp.
   Cán bộ nhập **ĐTB chính thức đã xác minh cùng căn cứ**; chưa có thì để trống. Điểm 0 vẫn là giá trị 0.
8. Người có quyền nhập quy định thực tế: có/không yêu cầu GPA, ngưỡng GPA nếu có,
   chuẩn ngoại ngữ, có/không yêu cầu bảo vệ và tiêu chí khác nếu có. Bắt buộc văn bản/căn cứ.
   Không có policy: không tự lấy ĐTB 7,0, IELTS 6,0, giá trị fallback từ giao diện Admin hay mặc định quy định.
9. Ngoại ngữ có UNKNOWN/MET/NOT_MET, cần căn cứ khi đã xác minh.
   MET cần ngày hết hạn hoặc xác nhận rõ hồ sơ không quy định hết hạn. Quá hạn → chưa đạt.
   Nội dung chứng chỉ được cán bộ đối chiếu theo policy, không tự phân tích chuỗi IELTS/VSTEP để xác nhận đạt.
10. Bảo vệ phải có DA_DAT của **đúng assignment** và ngày hợp lệ; kết quả của assignment khác không thay thế.
    Dùng kết luận hội đồng đã lưu, không tự áp ngưỡng bảo vệ mới.
11. Đổi policy revision làm hồ sơ xác minh cũ chưa được coi là đã đối chiếu theo policy mới.
    Cán bộ phải xác minh lại, có xác nhận trên form. Tính chất học phần/TC không được sửa qua màn hình này.
12. Trạng thái: bất kỳ tiêu chí UNKNOWN → THIEU_THONG_TIN; đã đủ thông tin nhưng có NOT_MET → CHUA_DU_DIEN_KIEN;
    toàn bộ MET/NOT_REQUIRED → DU_DIEN_KIEN.
    Chi tiết vẫn thể hiện từng tiêu chí chưa đạt khi tổng thể đang thiếu thông tin.
13. GET luôn tính lại từ SQL hiện tại. Lịch sử CHECK là snapshot bất biến tại lần đọc.
    fingerprint và changedSinceCheck báo nguồn/quy định đã đổi, không dùng kết quả đủ điều kiện cũ để hiển thị cho dữ liệu mới.
14. Kiểm tra theo bậc chia lô/cursor, chỉ assignment ACTIVE trong cả hai phạm vi. Mỗi lô có transaction riêng,
    UI hiển thị số đã lưu và cho dừng sau lô hiện tại; không khẳng định toàn hệ thống là một transaction.
15. Mọi ghi kiểm tra lại tài khoản/quyền, khóa bản ghi phù hợp, kiểm tra revision;
    thay đổi + event + audit cùng transaction. Audit lỗi → rollback; dữ liệu cũ trả 409.
    graduation_events không được cập nhật/xóa.
16. Không ghi điểm, sửa kết quả bảo vệ, tự công nhận tương đương, ra quyết định tốt nghiệp hoặc cấp bằng.

## Migration và quyền

Chạy migration mới Graduation1793451600000:

```bash
cd 03_SourceCode/backend
npm run migration:run
```

Tạo 3 bảng mới, trigger lịch sử bất biến và quyền:
- GRADUATION_READ: ADMIN, TRAINING_OFFICER, APPROVER.
- GRADUATION_CHECK: TRAINING_OFFICER, APPROVER.
- GRADUATION_EVIDENCE: TRAINING_OFFICER.
- GRADUATION_POLICY: APPROVER.

ADMIN mặc định chỉ đọc, không bypass quyền. STUDENT/LECTURER không tự được cấp quyền của module.
Backend đọc quyền role ACTIVE từ SQL mỗi request; cookie/JWT còn phải có session hợp lệ.
Đọc hồ sơ/histories cần cả chương trình và học viên trong scope; PROGRAM/MAJOR scope không tự cấp quyền đọc học viên.
Policy của track chỉ cần phạm vi chương trình vì không chứa danh tính học viên.

Migration không seed policy, GPA, chứng chỉ, điểm, kết quả tốt nghiệp hay học viên mẫu.
Đã chạy trên local; 9 bảng nghiệp vụ gốc được đối chiếu hash trước/sau và giữ nguyên.
Ba bảng graduation còn trống trên nguồn sau migration. Dữ liệu test chỉ trên clone.

## API

Swagger: http://localhost:3002/api → Graduation - Xét điều kiện tốt nghiệp.
ID hồ sơ là **student_program_assignments.id**, không phải students.id.

| Method | URL dưới /xet-tot-nghiep | Chức năng |
|---|---|---|
| GET | / | Danh sách trực tiếp tính từ SQL, tìm/lọc/phân trang |
| GET | /options | Bậc và hướng trong phạm vi từ SQL |
| GET | /quy-dinh/:trackId | Quy định đang lưu hoặc NULL |
| POST | /quy-dinh/:trackId | Lưu policy, có revision/căn cứ |
| GET | /:assignmentId | Nguồn, tiêu chí, tín chỉ, quy định, minh chứng, fingerprint |
| POST | /:assignmentId/minh-chung | Lưu xác minh, có revision và policyRevision |
| POST | /:assignmentId/kiem-tra | Lưu snapshot kiểm tra, body {} |
| POST | /kiem-tra | Lưu theo bậc: educationLevelId, limit (1–100), afterId tùy chọn |
| GET | /:assignmentId/lich-su?page=1 | CHECK/EVIDENCE và POLICY liên quan, 20 dòng/trang |

Query list: searchTerm tối đa 255; educationLevelId; status ALL/DU_DIEN_KIEN/CHUA_DU_DIEN_KIEN/THIEU_THONG_TIN;
assignmentStatus ACTIVE/ENDED/ALL; page từ 1; limit 1–100.
Thống kê theo phạm vi/từ khóa/bậc/phân công trước lọc trạng thái xét.
ID BIGINT là string, TC/điểm DECIMAL là number, NULL không đổi thành 0.
Frontend gọi /api/xet-tot-nghiep: JWT từ cookie HttpOnly, allowlist, Origin khi ghi, no-store và che lỗi SQL nội bộ.

Ví dụ policy, thay bằng quy định thực tế:

```json
{
  "revision": 0,
  "requireGpa": true,
  "minimumGpa": 7.3,
  "requireLanguage": true,
  "languageRule": "Chuẩn ngoại ngữ theo văn bản của đơn vị",
  "requireDefense": true,
  "otherRequirements": null,
  "reference": "Số văn bản thực tế"
}
```

7.3 chỉ minh họa cú pháp, không được seed/mặc định vào database.
revision=0 khi chưa có policy; lần sau dùng revision đang lưu.

Minh chứng có revision=0 khi chưa có; policyRevision phải bằng policy hiện tại.
gpa và gpaReference nhập cùng nhau; languageState/otherState dùng UNKNOWN/MET/NOT_MET.
languageValidUntil nullable, languageNoExpiry là boolean được xác nhận rõ.
Đổi policy hoặc evidence cũ → tải lại sau 409; không tăng revision tùy ý để ghi đè.

## Test giao diện

Backend:

```bash
sudo systemctl start ctdt-mariadb-dev
cd 03_SourceCode/backend
npm ci                 # máy mới/đổi dependency
npm run migration:run
npm run start:dev
```

Terminal khác:

```bash
cd 03_SourceCode/frontend
npm ci                 # khi cần
npm run dev
```

Cấu hình backend/.env và frontend/.env.local theo file mẫu; BACKEND_API_URL thường http://127.0.0.1:3002.
Dùng server Next đang có nếu đã chạy, không khởi động trùng.

1. Mở http://localhost:3000/dang-nhap.
2. officer.fit: xem/kiểm tra và xác minh hồ sơ thuộc CNTT.
   approver.fit: xem/kiểm tra và nhập policy theo văn bản của đơn vị.
   Admin: chỉ đọc. officer.fbe/thuan: theo scope Kinh tế, không thấy hồ sơ CNTT.
   Dùng mật khẩu hiện tại; module không reset mật khẩu.
3. Vào http://localhost:3000/dashboard/xet-tot-nghiep.
4. Nguồn hiện có 3 học viên, 4 assignment (3 ACTIVE, 1 ENDED).
   Mặc định hiển thị 3 assignment ACTIVE theo phạm vi CNTT; chọn ALL thấy lần cũ.
5. Policy/minh chứng chưa nhập nên trạng thái thiếu thông tin là đúng, ĐTB là “—”; không dùng số mẫu.
6. Đăng nhập approver.fit → Quy định xét tốt nghiệp → chọn đúng phiên bản/hướng → nhập căn cứ, yêu cầu thực tế → lưu.
7. Đăng nhập officer.fit → Chi tiết → xem yêu cầu TC/nhóm/HP và bảo vệ từ SQL.
   Nhập ĐTB chính thức/căn cứ, ngoại ngữ/hạn hiệu lực và tiêu chí khác đã xác minh; xác nhận đã đối chiếu → lưu.
8. Kiểm tra và lưu kết quả: nguồn giữ nguyên, lịch sử có snapshot.
   Chạy kiểm tra theo bậc để lưu nhiều hồ sơ trong scope; có bộ đếm và nút dừng sau lô.
9. Thay policy rồi mở lại: minh chứng cũ phải được xác minh lại. Thay kết quả điểm qua module điểm rồi mở lại:
   kết quả live đổi, snapshot cũ giữ nguyên và có cảnh báo nguồn thay đổi.
10. Tìm/lọc theo trạng thái, bậc và assignment; mở lịch sử, chuyển trang.
11. Admin không có nút ghi. Tài khoản khoa khác không xem được cả khi nhập ID thủ công.
12. Kết quả đủ điều kiện không tự trở thành quyết định cấp bằng; trạng thái SQL học viên giữ nguyên.

Các thao tác lưu trên nguồn là dữ liệu thật. Muốn thử nhiều quy định giả lập, dùng clone để không thay quy định/hồ sơ thật.

## SQL đối chiếu DBeaver

```sql
SELECT a.id AS assignment_id,s.student_code,s.full_name,s.status,
       a.assignment_status,v.version_code,t.track_code_snapshot,t.required_total_credits
FROM student_program_assignments a
JOIN students s ON s.id=a.student_id
JOIN program_version_tracks t ON t.id=a.program_version_track_id
JOIN program_versions v ON v.id=t.program_version_id
ORDER BY s.id,a.id;

-- Tổng TC thô, chưa áp trần nhóm: EXISTS tránh đếm trùng học lại.
SELECT a.id AS assignment_id,COALESCE(SUM(cv.credits),0) AS raw_credits
FROM student_program_assignments a
JOIN curriculum_courses cc ON cc.program_version_track_id=a.program_version_track_id
JOIN course_versions cv ON cv.id=cc.course_version_id
WHERE a.id=1 AND EXISTS (
 SELECT 1 FROM student_course_results r
 WHERE r.student_id=a.student_id AND r.course_version_id=cc.course_version_id
   AND r.result_status IN ('PASSED','EXEMPTED')
   AND (r.passed_at IS NULL OR DATE(r.passed_at)<=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR))
)
GROUP BY a.id;

SELECT * FROM graduation_policies ORDER BY program_version_track_id;
SELECT * FROM graduation_evidence ORDER BY assignment_id;
SELECT * FROM graduation_events WHERE assignment_id=1 ORDER BY id DESC;
SELECT id,assignment_id,status,defense_date,average_score FROM thesis_defenses WHERE assignment_id=1;
```

Thay assignment_id/track ID theo hồ sơ, không nhầm mã HV, ID học viên và ID assignment.
TC hiển thị cuối cùng còn áp trần nhóm và kiểm tra HP bắt buộc, không chỉ so SUM với 60.

## Kiểm thử tự động

Backend:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm run test:graduation-parity
```

graduation-parity chỉ đọc DB cấu hình trong backend/.env; đối chiếu assignment/scope, phiên bản học phần,
TC đạt/miễn, định mức/GPA NULL, kết quả live và lịch sử, không tạo session hay dữ liệu tốt nghiệp.
Frontend: npm run build, npm run lint.

Hai script có ghi chỉ được chạy trên database dùng xong bỏ:
1. Clone đầy đủ SQL/view/trigger/migration sang ctdt_graduation_review_<timestamp>, áp migration mới.
2. Backend: PORT=3102, DB_DATABASE trỏ clone. Frontend: cổng 3101,
   BACKEND_API_URL=http://127.0.0.1:3102 và DATABASE_URL cùng clone.
3. Tại backend truyền GRADUATION_TEST_ALLOW_WRITES=1, DB_DATABASE đúng clone,
   GRADUATION_TEST_URL=http://localhost:3101; chạy npm run test:graduation-integration.
4. Script tạo user, học viên, điểm, policy/minh chứng và bảo vệ test chỉ trên clone.
   Probe session riêng của clone trước các HTTP ghi để tránh trỏ nhầm backend.
   Dùng clone mới cho mỗi lần chạy đầy đủ vì policy/version đã được thay đổi trong bài test.
5. Sau integration chạy npm run test:graduation-browser với Playwright/trình duyệt cài trong môi trường test riêng;
   PLAYWRIGHT_MODULE_PATH=/đường/dẫn/node_modules/playwright nếu không ở dependency dự án.
6. Fixture credential test ở /tmp/ctdt-graduation-browser.json; đổi đường dẫn bằng GRADUATION_BROWSER_FIXTURE.
   Ảnh mặc định /tmp/ctdt-graduation-browser.png, đổi bằng GRADUATION_SCREENSHOT.
7. Dừng server test, xóa clone/quyền kết nối/fixture sau khi hoàn tất. Không chạy script có ghi trên nguồn hoặc production.

Bàn giao QA cần SQL + migration + cấu hình local, không push .env/credential, node_modules, dist hoặc .next.
Những hồ sơ nhập riêng trên máy không tự đi theo Git.

## Kết quả triển khai 31/10/2026

- Backend/frontend build và lint: qua.
- Toàn bộ unit test: 236 test / 28 suite, qua.
- API/proxy/JWT/SQL: 67 kiểm tra trên clone, qua.
- Nguồn thật: 113 kiểm tra parity chỉ đọc, qua.
- Trình duyệt đăng nhập thật: policy ban đầu trống, lưu quy định, xác minh GPA 0/giá trị thật,
  kết quả live, lịch sử, batch, reload, Admin chỉ đọc và khoa khác, qua; không có lỗi runtime.
- 9 bảng nghiệp vụ gốc giữ nguyên hash trước/sau migration. Không có policy/evidence/event thử trên nguồn.
- Thay đổi 24 file: 5 sửa, 19 mới (18 backend, 6 frontend). Chưa commit/push.