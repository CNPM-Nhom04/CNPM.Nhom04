# Xét duyệt và thẩm định CTĐT

Backend NestJS theo domain/application/infrastructure/presentation.
Frontend Next.js gọi proxy cookie HttpOnly → NestJS → MariaDB. Không dùng dữ liệu mẫu trong giao diện.

## Nguồn dữ liệu

| Nội dung | Bảng/cột |
|---|---|
| Mỗi lượt gửi duyệt | approval_requests.id, program_version_id, request_no, current_status |
| Người gửi/thời điểm | approval_requests.requested_by, requested_at + users |
| Tiến trình | review_started_at, reviewing_by |
| Hoàn tất/ý kiến | completed_at, latest_comment |
| Thông tin nhắc đã lưu | next_reminder_at, last_reminded_at, reminder_count |
| Lịch sử từng lượt | approval_actions: SUBMIT, START_REVIEW, APPROVE, RETURN, CANCEL |
| Phiên bản liên quan | program_versions; tên từ program_name_snapshot, không đổi sang tên mới nhất |
| Đơn vị/bậc | training_programs + organizational_units + education_levels |
| Biên bản | program_review_minutes.approval_request_id |
| Tài liệu | program_review_documents.approval_request_id và program_version_id |
| Phạm vi | vw_user_program_access: GLOBAL, ORG_UNIT và đơn vị con, MAJOR, PROGRAM |
| Workflow | workflow_transitions cho PROGRAM_VERSION và APPROVAL_REQUEST |
| Kiểm tra tín chỉ | education_levels, education_level_tracks, tracks/groups/courses/prerequisites trong module programs |

Trang danh sách là **lượt gửi duyệt**, không phải danh sách CTĐT. Một phiên bản có nhiều lượt gửi sẽ có nhiều dòng.
Kết quả của lượt cũ không bị thay bằng trạng thái hiện tại của phiên bản.
Thống kê 4 trạng thái theo phạm vi/từ khóa/phiên bản; không bị giới hạn theo trạng thái/tiến trình đang lọc.
MINE chỉ gồm hồ sơ PENDING có reviewing_by là tài khoản hiện tại.

Cấu trúc CTĐT xem từ chi tiết là **cấu trúc hiện tại** của phiên bản. Schema không có bản chụp cấu trúc riêng cho mỗi lượt;
không khẳng định cấu trúc hiện tại là cấu trúc tại một lượt cũ đã trả về.
Thông tin biên bản/tiên quyết/tài liệu thiếu giữ trống, không tự điền hội đồng, quyết định hay điểm chuẩn.

## Migration bắt buộc

```bash
cd 03_SourceCode/backend
npm run migration:run
```

Migration Approvals1793448000000 thêm:
- approval_requests.revision để chặn thao tác từ màn hình cũ/đồng thời.
- program_review_documents.approval_request_id nullable, FK đúng lượt duyệt.
- Trigger bảo toàn danh tính và kết quả hồ sơ đã hoàn tất; biên bản/tài liệu chỉ thêm, không ghi đè/xóa.
- Giữ trigger workflow và lịch sử approval_actions đã có.
- Không thêm bảng duyệt trùng, quyền mới, tài khoản, quyết định hay biên bản mẫu.
- Không tự backfill tài liệu cũ: association NULL nghĩa là SQL chưa xác định thuộc lượt nào.
  Frontend ghi rõ “Tài liệu cũ của phiên bản, SQL chưa xác định thuộc lượt duyệt nào”.

Đã áp dụng trên database local. Dữ liệu cũ của 6 bảng request/action/version/minutes/document/UI được đối chiếu hash trước/sau và giữ nguyên.
Máy QA/nhóm pull về phải chạy migration, không chỉ npm install.

## Quyền và nghiệp vụ

Cần PROGRAM_APPROVE trong role đang ACTIVE và phạm vi SQL của CTĐT.
SQL hiện tại: approver.fit có quyền theo Khoa CNTT; cán bộ chỉ có PROGRAM_SUBMIT không được vào trang duyệt.
ADMIN không có ngoại lệ tự phê duyệt. Vai trò đọc từ SQL mỗi request, không tin claim role trong JWT.
Người gửi không tự bắt đầu thẩm định, đính kèm tài liệu thẩm định hay kết luận, kể cả được gán thêm APPROVER.

1. Cán bộ gửi qua module programs → phiên bản SUBMITTED, một approval_requests PENDING + action SUBMIT.
2. Người duyệt có thể bấm Bắt đầu thẩm định → phiên bản REVIEWING, request vẫn PENDING,
   lưu review_started_at/reviewing_by + action START_REVIEW.
3. SQL cũng cho duyệt trực tiếp từ SUBMITTED. Không ép tạo START_REVIEW giả khi duyệt trực tiếp.
4. Kết luận DAT_DIEU_KIEN: kiểm tra lại toàn bộ cấu trúc/định mức/quyết định, ghi biên bản,
   request APPROVED, phiên bản PUBLISHED và locked_at.
5. YEU_CAU_SUA_DOI hoặc KHONG_DAT: bắt buộc lý do, request và phiên bản RETURNED.
   KHONG_DAT không tạo trạng thái REJECTED vì schema không có trạng thái đó.
6. Người soạn sửa/bổ sung rồi gửi lại → request mới, không ghi đè kết luận/tài liệu lượt cũ.
7. Không tự lưu trữ phiên bản đã ban hành khác. Nếu cùng chương trình/cohort đã có PUBLISHED,
   unique constraint chặn, trả 409 và rollback toàn bộ biên bản/hành động/quyết định mới.
8. Người duyệt khác có cùng quyền/phạm vi vẫn có thể kết luận; SQL không quy định độc quyền người bắt đầu.
   reviewing_by giữ người bắt đầu nếu đã có; tác giả quyết định thực tế đọc trong action APPROVE/RETURN.
9. Ngày họp phải là ngày thực, không trước ngày gửi theo UTC+7, không ở tương lai.
   Tên chủ tịch/thư ký không trống và không trùng nhau. Số biên bản tùy chọn theo schema hiện có.
10. Mọi ghi giữ khóa người dùng/phiên bản/request và kiểm tra quyền lại trong transaction.
    Quyết định kiểm tra cả revision phiên bản và requestRevision; thao tác lặp/cũ trả 409.
    Bắt đầu/biên bản/action/workflow/audit nằm trong cùng transaction; lỗi bất kỳ sẽ rollback.
11. Upload chỉ nhận PDF/DOCX có nội dung đúng định dạng, tối đa 25MB, vào request PENDING đúng phiên bản.
    Tài liệu tải trước khi lưu kết luận; sau kết thúc chỉ xem/tải, không thêm/xóa/ghi đè.
    SQL lưu metadata, file ở PROGRAM_UPLOAD_DIR (mặc định backend/storage/program-reviews).
12. Thông tin lịch nhắc trên màn hình chỉ đọc dữ liệu đang lưu trong SQL.
    Module này không triển khai worker gửi mail/nhắc tự động, không tự tính lịch mới hay gửi email.
    Khi kết luận, xóa next_reminder_at của hồ sơ đã kết thúc.
13. CANCELLED và lịch sử CANCEL nếu có vẫn được đọc từ SQL; thao tác thu hồi thuộc luồng người gửi, không thêm trong màn hình người duyệt.

Workflow trên hồ sơ legacy không tạo program_ui_details chỉ để tăng revision.
Như vậy không tự chèn CHINH_QUY/định mức/niên khóa mặc định vào thông tin chưa được nhập.

## API

Swagger http://localhost:3002/api → Approvals - Xét duyệt CTĐT.
ID trong API này là **approval_requests.id**, không phải program_versions.id.

| Method | URL | Nội dung |
|---|---|---|
| GET | /xet-duyet | Danh sách, thống kê, tìm kiếm, phân trang |
| GET | /xet-duyet/:id | Chi tiết lượt, biên bản, action, tài liệu, phiên bản hiện tại |
| POST | /xet-duyet/:id/bat-dau | Bắt đầu, body requestRevision |
| POST | /xet-duyet/:id/ket-luan | Ghi kết luận, body bên dưới |
| POST | /xet-duyet/:id/tai-lieu | multipart/form-data, trường file |
| GET | /xet-duyet/:id/tai-lieu/:documentId | Tải file sau kiểm tra scope và association |

Query danh sách:
- searchTerm: mã hồ sơ, mã/tên chương trình, mã phiên bản, tên người gửi, tối đa 255 ký tự.
- status: ALL/PENDING/APPROVED/RETURNED/CANCELLED, mặc định PENDING.
- reviewState: ALL/NOT_STARTED/STARTED/MINE, mặc định ALL.
- versionId: lọc một program_versions.id.
- page: từ 1; limit: 1–100, mặc định 20.

Ví dụ body kết luận (dùng giá trị thực từ hồ sơ, ví dụ chỉ mô tả cấu trúc):

```json
{
  "revision": 3,
  "requestRevision": 1,
  "hoiDongThamDinh": "Tên hội đồng thực tế",
  "chuTichHoidong": "Họ tên chủ tịch",
  "thuKhao": "Họ tên thư ký",
  "ngayHop": "2026-10-31",
  "ketLuan": "YEU_CAU_SUA_DOI",
  "yKienDongGop": "Lý do cụ thể cần chỉnh sửa",
  "soBienBan": ""
}
```

revision lấy từ detail.program.revision; requestRevision lấy từ detail.revision.
401: thiếu/hết phiên; 403: thiếu quyền/tự duyệt; 404: ngoài scope/không có hồ sơ hoặc file;
400: nhập sai/thiếu điều kiện; 409: cũ/đã kết thúc/xung đột workflow/đã có bản ban hành cùng cohort.
Proxy frontend: /api/xet-duyet, GET/POST theo allowlist; ghi phải cùng Origin, JWT từ cookie HttpOnly, no-store.
API chương trình cũ vẫn dùng được; logic ghi dùng chung MysqlProgramRepository, không tạo hai bộ quyết định khác nhau.
URL cũ /dashboard/chuong-trinh-dao-tao/:versionId/xet-duyet chuyển sang hàng đợi lọc phiên bản để chọn đúng lượt.

## Test thủ công

Khởi động MariaDB, backend và frontend như các module trước:

```bash
sudo systemctl start ctdt-mariadb-dev
cd 03_SourceCode/backend
npm ci                 # khi clone mới hoặc đổi dependency
npm run migration:run
npm run start:dev
```

Terminal khác:

```bash
cd 03_SourceCode/frontend
npm ci                 # khi cần
npm run dev
```

Mở http://localhost:3000/dang-nhap, dùng approver.fit và mật khẩu hiện tại.
Vào http://localhost:3000/dashboard/xet-duyet.
Không khởi động trùng next dev nếu server đã chạy.

Nguồn local đã đối chiếu:
- 4 lượt: APR-2024-001 RETURNED, APR-2024-002 APPROVED, APR-2025-001 APPROVED, APR-2026-001 PENDING.
- Tổng 10 action. Biên bản chi tiết/tài liệu của seed chưa có thì hiện đúng trạng thái chưa có dữ liệu.
- APR-2026-001 gắn MIT-2026-v1 (version id 3), chưa có số/ngày quyết định trong program_ui_details.

Các bước:
1. Mặc định thấy 1 hồ sơ đang chờ. Chọn Tất cả trạng thái để thấy đủ 4 lượt theo phạm vi CNTT.
2. Tìm APR-2026-001; mở hồ sơ, đối chiếu người gửi/ngày gửi/reminder với SQL.
3. Chọn lượt cũ: xem lịch sử và kết quả, không có form sửa kết luận/tải tài liệu mới.
4. Bấm Bắt đầu thẩm định trên hồ sơ PENDING: phiên bản REVIEWING, thêm đúng một START_REVIEW.
5. Chọn tệp PDF/DOCX thật, tải lên, bấm tên file để tải lại; xem association SQL.
6. Form kết luận ban đầu trống, phải chủ động chọn kết luận.
7. Với hồ sơ seed chưa có quyết định, bấm phê duyệt sẽ bị chặn bởi kiểm tra dữ liệu; không bỏ qua để demo.
   Muốn hoàn tất luồng thật: người duyệt trả về với lý do → đăng nhập officer.fit bổ sung số/ngày quyết định thực tế
   và sửa các lỗi cấu trúc nếu có → gửi lại → approver.fit duyệt lượt mới.
8. Sau trả/gửi lại: thấy hai lượt khác nhau; mở lượt cũ vẫn thấy biên bản/tệp cũ.
9. Đạt điều kiện: request APPROVED, phiên bản PUBLISHED khóa sửa. Reload vẫn giữ kết quả.
10. Dùng hai tab, một tab bắt đầu/kết luận rồi tab kia lưu dữ liệu cũ: nhận 409, tải lại hồ sơ.
11. Officer/Admin không có PROGRAM_APPROVE không thấy menu và API trả 403.
    Người duyệt scope khoa khác không thấy CNTT; nhập trực tiếp ID ngoài scope trả 404.

Thao tác trả/duyệt trên dữ liệu thật sẽ ghi kết quả thật. Dùng database sao nếu muốn thử nhiều vòng mà giữ nguyên seed.

SQL đối chiếu DBeaver:

```sql
SELECT r.id AS request_id,r.request_no,r.current_status,r.revision,
       v.id AS version_id,v.version_code,v.status AS version_status,
       r.requested_by,r.requested_at,r.reviewing_by,r.review_started_at,r.completed_at,
       r.next_reminder_at,r.reminder_count
FROM approval_requests r
JOIN program_versions v ON v.id=r.program_version_id
ORDER BY r.id;

SELECT * FROM approval_actions WHERE approval_request_id=4 ORDER BY created_at,id;
SELECT * FROM program_review_minutes WHERE approval_request_id=4;
SELECT id,program_version_id,approval_request_id,original_name,storage_key
FROM program_review_documents ORDER BY id;
```

Thay request_id bằng lượt đang xem; không nhầm ID lượt với ID phiên bản.

## Kiểm tra tự động / bàn giao

Backend:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm run test:approval-parity
```

approval-parity chỉ đọc DB trong backend/.env, đối chiếu từng lượt/action/biên bản/file/progress và scope với SQL.
Không tạo tài khoản/phiên đăng nhập hay đổi trạng thái trên nguồn.
Frontend: npm run build và npm run lint.

Hai test có ghi chỉ chạy trên bản sao:
- Clone đầy đủ SQL/view/trigger/migration sang ctdt_approval_review_<timestamp>, chạy migration mới trên clone.
- Backend PORT=3102, DB_DATABASE là clone; PROGRAM_UPLOAD_DIR nên trỏ thư mục test riêng.
- Frontend cổng 3101, BACKEND_API_URL=http://127.0.0.1:3102, DATABASE_URL trỏ cùng clone.
- Truyền APPROVAL_TEST_ALLOW_WRITES=1, DB_DATABASE đúng clone, APPROVAL_TEST_URL=http://localhost:3101.
- Chạy npm run test:approval-integration: fixture chỉ trên clone; probe session riêng trước mọi HTTP ghi.
- Sau đó npm run test:approval-browser với Playwright đã cài trong môi trường test riêng;
  PLAYWRIGHT_MODULE_PATH chỉ đường dẫn module nếu không nằm trong node_modules dự án.
- integration ghi fixture /tmp/ctdt-approval-browser.json (có credential test riêng, không commit);
  có thể đổi bằng APPROVAL_BROWSER_FIXTURE. Browser kiểm tra đúng DB trước khi chạy.
- APPROVAL_SCREENSHOT đổi ảnh mặc định /tmp/ctdt-approval-browser.png.
- Test kiểm tra JWT/proxy, thiếu quyền/khác khoa/tự duyệt, START_REVIEW, ngày/lý do,
  race, rollback audit, return/resubmit/publish, trùng bản ban hành, tài liệu theo lượt,
  immutable history và dữ liệu legacy không tự tạo UI defaults.
- Xóa clone, quyền kết nối clone và file test sau khi xong. Không chạy hai script này trên DB làm việc/production.

Để QA nhìn giống máy bạn: cần cùng SQL + migration + cấu hình local. .env không push vì chứa bí mật.
File PDF/DOCX nằm trên ổ đĩa server, không nằm trong Git hay SQL dump; cần môi trường lưu trữ/tệp test riêng nếu muốn tải cùng file.
Không push node_modules, dist, .next, credential hoặc tài liệu nội bộ.

## Kết quả kiểm tra 31/10/2026

- Build và lint backend/frontend: qua.
- Unit: 212 test / 26 suite, qua.
- API/proxy/JWT/SQL trên clone: 100 kiểm tra, qua; có kiểm tra race, rollback audit và trùng bản ban hành.
- Luồng CTĐT cũ: 57 kiểm tra hồi quy, qua.
- Nguồn thật: 38 kiểm tra SQL chỉ đọc cho đủ 4 lượt, qua.
- Trình duyệt thật: hàng đợi, form trống, bắt đầu, upload/download, trả/gửi lại/phê duyệt, tự duyệt, khoa khác và Admin, qua; không có lỗi runtime.
- Migration đã chạy local; hash dữ liệu cũ của 6 bảng nghiệp vụ được giữ nguyên.
- Tổng 30 file thuộc thay đổi này: 12 sửa, 18 mới (23 backend, 7 frontend). Chưa commit/push.