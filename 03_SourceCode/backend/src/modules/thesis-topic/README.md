# Đề tài luận văn và phân công GVHD

Trang: http://localhost:3000/dashboard/de-tai-luan-van  
Đăng nhập: http://localhost:3000/dang-nhap  
Swagger: http://localhost:3002/api → Thesis Topics - Đề tài và GVHD.

## CSDL và cấu trúc

CSDL.sql gốc có học viên, phân CTĐT, ngành, bậc, đơn vị và RBAC nhưng
chưa có bảng đề tài hoặc giảng viên hướng dẫn. Migration
1793340000000-ThesisTopics bổ sung:

- thesis_supervisors: hồ sơ GVHD do cán bộ nhập từ hồ sơ thực tế, FK đơn vị quản lý.
  Mã hồ sơ duy nhất trong đơn vị. Không tự tạo tài khoản đăng nhập.
- thesis_topics: FK assignment_id đến đúng student_program_assignments và
  supervisor_id đến hồ sơ GVHD. Lưu tên học viên, CTĐT và GVHD dạng snapshot;
  trạng thái, revision, người/thời điểm/lý do duyệt, trả lại, hủy, nghiệm thu.
- thesis_defenses.topic_id: liên kết đề tài đã duyệt với lịch bảo vệ.
  Nullable để giữ nguyên lịch sử bảo vệ có sẵn, không tự đoán đề tài của dữ liệu cũ.
- TOPIC_READ, TOPIC_MANAGE, TOPIC_APPROVE, TOPIC_COMPLETE cùng các role grants.
- Foreign key, unique key cho một đề tài hiện hành/phân CTĐT, CHECK và trigger
  giữ nhất quán, cấm sửa/xóa hồ sơ đã chốt.

Không chèn giảng viên, đề tài, học viên hay kết quả mẫu.
Không sửa file CSDL.sql gốc, không đổi mật khẩu tài khoản.

Họ tên, mã học viên, ngành, CTĐT, bậc và khoa trên form đều lấy từ SQL:
students → student_program_assignments → program_version_tracks →
program_versions → training_programs → majors / education_levels / organizational_units.
Không cho nhập lại danh tính học viên hoặc tự chọn chuyên ngành gán cứng.
Học viên hợp lệ có phân CTĐT ACTIVE, các hồ sơ liên quan hoạt động,
phiên bản PUBLISHED/ARCHIVED và bậc thuộc thesis_defense_levels đã cấu hình trong SQL.
Không coi việc đang học là bằng chứng đã đạt mọi điều kiện học thuật.

## Quyền và phạm vi

Migration thêm quyền cho các vai trò đang có, theo trách nhiệm nghiệp vụ:

| Vai trò          | Xem   | Hồ sơ GVHD / đăng ký, sửa, hủy | Duyệt / trả lại | Nghiệm thu |
| ---------------- | ----- | ------------------------------ | --------------- | ---------- |
| ADMIN            | Có    | Không                          | Không           | Không      |
| TRAINING_OFFICER | Có    | Có                             | Không           | Không      |
| APPROVER         | Có    | Không                          | Có              | Có         |
| STUDENT          | Không | Không                          | Không           | Không      |

Đây là các grant mới trong migration; CSDL gốc chưa định nghĩa quyền đề tài.
Quyền thực tế luôn truy vấn lại SQL, không gán bằng tên tài khoản/JWT role claim.
Tài khoản có nhiều vai trò vẫn không được tự duyệt/nghiệm thu đề tài mình tạo.

Đọc/sửa đề tài cần đồng thời quyền truy cập chương trình và học viên từ
vw_user_program_access + vw_user_student_access.
GLOBAL hoặc ORG_UNIT/đơn vị con xác định phạm vi. PROGRAM/MAJOR đơn thuần
không cấp quyền đọc danh tính học viên.
GVHD phải thuộc chính đơn vị quản lý CTĐT và còn hoạt động khi phân công/duyệt.
Không cho cán bộ khoa này gán GVHD khoa khác bằng cách sửa request.
Ngoài phạm vi ID trả 404; thiếu quyền chức năng trả 403.
Ẩn nút frontend chỉ hỗ trợ trải nghiệm; backend vẫn kiểm tra mọi API.

## Luồng xử lý

1. Cán bộ nhập hồ sơ GVHD thật: mã, họ tên, đơn vị. Cơ quan, học hàm/học vị,
   email chưa có thì để trống. Sau đó chọn hồ sơ từ SQL khi đăng ký đề tài.
2. Chọn học viên/phân CTĐT từ SQL, nhập đề tài/mô tả, chọn GVHD cùng đơn vị.
   Lưu CHO_DUYET, audit cùng transaction.
3. Lãnh đạo khác người tạo duyệt với ký hiệu hồ sơ/quyết định và nội dung kiểm tra
   → DANG_THUC_HIEN; hoặc trả lại với lý do → TU_CHOI.
4. Cán bộ sửa đề tài CHO_DUYET/TU_CHOI và gửi lại → CHO_DUYET.
   Lưu revision để chặn thao tác từ dữ liệu cũ và hai người sửa/duyệt đồng thời.
   Lịch sử cũ vẫn ở audit_logs. Không sửa nội dung đề tài đã duyệt tại chỗ.
5. Trang bảo vệ chỉ liệt kê học viên có đề tài DANG_THUC_HIEN tương ứng.
   Tên đề tài điền từ SQL và chỉ đọc. Backend tự lấy title và topic_id,
   bỏ qua tên giả trong request, kiểm tra lại trạng thái trong transaction.
   Điều kiện bảo vệ khác vẫn cần cán bộ kiểm tra hồ sơ và xác nhận như module bảo vệ.
6. Sau kết quả bảo vệ DA_DAT được liên kết đúng topic_id/assignment_id,
   lãnh đạo xác nhận nghiệm thu kèm số hồ sơ và nội dung → HOAN_THANH.
   Không tự nghiệm thu khi chưa chấm, chưa đạt hoặc chỉ có lịch sử bảo vệ không liên kết.
   Không tự cộng điểm học phần hay xét tốt nghiệp.
7. Hủy giữ lịch sử → DA_HUY. Không hủy khi đang có lịch bảo vệ chờ hoặc đã đạt.
   Lịch bị hủy/kết quả chưa đạt không chặn hủy đề tài. Phân CTĐT còn hợp lệ
   có thể đăng ký đề tài khác sau khi hủy.
8. Ngừng phân công hồ sơ GVHD không xóa hoặc thay tên lịch sử.
   Hồ sơ đang bị ngừng không được phân công mới/duyệt mới.
   Hồ sơ đã duyệt giữ GVHD snapshot và vẫn được xử lý kết quả/nghiệm thu.
9. Hồ sơ HOAN_THANH/DA_HUY chỉ xem, không có xóa cứng.
   Bản ghi bảo vệ cũ topic_id NULL vẫn đọc/chấm/hủy theo quy tắc cũ;
   không tự gắn hoặc dùng để nghiệm thu đề tài mới.

Hệ thống chưa có bảng/quy định xác minh học hàm, học vị, hạn mức hướng dẫn,
đồng hướng dẫn hay cộng tác liên khoa. Không gán ngưỡng giả hoặc tự kết luận
GVHD đủ điều kiện chỉ từ dòng chữ học vị. Cán bộ/lãnh đạo phải kiểm tra hồ sơ thực.
Muốn điều chỉnh đề tài đã duyệt khi đang có lịch: hủy lịch chờ trước rồi hủy
đề tài và lập hồ sơ mới. Kết quả đã đạt cần quy trình điều chỉnh riêng, không sửa lịch sử.

## API

Frontend gọi /api/de-tai-luan-van/... qua proxy cookie HttpOnly, backend:

| Method | Path                                       | Chức năng                                               |
| ------ | ------------------------------------------ | ------------------------------------------------------- |
| GET    | /de-tai-luan-van                           | Tìm, lọc trạng thái, phân trang                         |
| GET    | /de-tai-luan-van/hoc-vien                  | Học viên có phân CTĐT phù hợp, chưa có đề tài hiện hành |
| GET    | /de-tai-luan-van/don-vi                    | Đơn vị trong phạm vi                                    |
| GET    | /de-tai-luan-van/giang-vien                | Hồ sơ GVHD, lọc đơn vị/trạng thái, phân trang           |
| POST   | /de-tai-luan-van/giang-vien                | Thêm hồ sơ GVHD thật                                    |
| POST   | /de-tai-luan-van/giang-vien/:id/trang-thai | Ngừng/mở phân công                                      |
| GET    | /de-tai-luan-van/:id                       | Chi tiết, lịch sử audit, các lần bảo vệ liên kết        |
| POST   | /de-tai-luan-van                           | Đăng ký                                                 |
| POST   | /de-tai-luan-van/:id/cap-nhat              | Sửa và gửi lại                                          |
| POST   | /de-tai-luan-van/:id/duyet                 | Duyệt                                                   |
| POST   | /de-tai-luan-van/:id/tu-choi               | Trả lại                                                 |
| POST   | /de-tai-luan-van/:id/huy                   | Hủy                                                     |
| POST   | /de-tai-luan-van/:id/nghiem-thu            | Xác nhận nghiệm thu                                     |

Query chung: page, limit (tối đa 100), searchTerm.
Đề tài thêm selectedStatus. GVHD thêm status=ALL|ACTIVE|INACTIVE, unitId.
Body đăng ký: assignmentId, supervisorId (chuỗi ID), title, description tùy chọn.
Cập nhật: supervisorId, title, description và revision (số).
Duyệt/nghiệm thu: revision, note (10..1000 ký tự), reference (1..255 ký tự).
Trả lại/hủy: revision, note.
Mọi thao tác ghi có transaction, kiểm tra lại quyền SQL và audit.

## Chạy trên máy local

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

Dùng backend .env cấu hình MariaDB thật (local hiện tại cổng 3307, DB ctdt_management).
Frontend .env.local: BACKEND_API_URL=http://127.0.0.1:3002.
Không commit .env/password/SMTP; mỗi máy dùng cấu hình riêng theo .env.example.
Máy QA pull code cần chạy migration, không chỉ chạy frontend.

## Test giao diện

Nên dùng database test cho các thao tác ghi:

1. Đăng nhập admin → xem danh sách/chi tiết, không có nút đăng ký hoặc thêm GVHD.
2. Cán bộ FIT → tab Hồ sơ GVHD, thêm hồ sơ thực tế thuộc FIT.
   Reload/tìm lại kiểm tra SQL đã lưu. Mã trùng trong đơn vị phải báo lỗi.
3. Đăng ký đề tài: tìm học viên, chọn đúng phân CTĐT và GVHD.
   Tên/ngành/CTĐT chỉ hiện từ SQL. Lưu rồi reload, tìm mã/tên và mở chi tiết.
4. Đăng nhập lãnh đạo cùng phạm vi → chi tiết → Trả lại, nhập lý do.
   Cán bộ sửa và gửi lại. Lãnh đạo duyệt kèm số hồ sơ.
5. Cán bộ mở trang bảo vệ, chọn học viên vừa được duyệt:
   tên đề tài tự hiện và không sửa được. Lập lịch theo hồ sơ thật,
   nhập ngưỡng đạt thực tế nếu SQL chưa có cấu hình.
6. Chưa có kết quả đạt: không nghiệm thu được.
   Ghi kết quả bảo vệ đạt rồi lãnh đạo xác nhận nghiệm thu kèm hồ sơ.
7. FBE/thuan có scope FBE không thấy đề tài/học viên/GVHD FIT.
   Kiểm tra trực tiếp ID qua API vẫn phải 404.
8. Thử hủy, tài khoản chỉ đọc gọi POST, hai tab cùng duyệt, sửa revision cũ,
   GVHD ngừng phân công và học viên đổi phân CTĐT.
   Các trường hợp không còn phù hợp phải bị chặn và giữ lịch sử.

Nếu trang trống sau migration: đúng khi SQL chưa có đề tài/GVHD.
Không tự tạo mẫu để lấp bảng. Có thể đăng xuất/đăng nhập lại để tải menu/quyền mới.

SQL DBeaver:

```sql
SELECT x.id,x.title,x.status,x.revision,s.student_code,
       x.student_name_snapshot,x.program_name_snapshot,
       x.supervisor_name_snapshot,h.supervisor_code,u.unit_name
FROM thesis_topics x
JOIN student_program_assignments a ON a.id=x.assignment_id
JOIN students s ON s.id=a.student_id
JOIN thesis_supervisors h ON h.id=x.supervisor_id
JOIN organizational_units u ON u.id=h.owning_unit_id
ORDER BY x.id DESC;

SELECT * FROM thesis_supervisors ORDER BY id;
SELECT id,topic_id,assignment_id,thesis_title,status,average_score FROM thesis_defenses;
SELECT * FROM audit_logs WHERE entity_type IN ('thesis_topic','thesis_supervisor') ORDER BY id DESC;
```

## Kiểm thử tự động

```bash
# Backend
npm run build
npm test -- --runInBand
npm run lint
npm run test:topic-parity

# Frontend
npm run build
```

Integration ghi dữ liệu chỉ chạy trên bản sao có tên ctdt_topic_review_<timestamp>,
đã import schema/data/trigger/view và chạy migration.
Dừng/xóa bản sao sau test; script giữ lịch sử test trên bản sao để đối chiếu.

```bash
# Backend test, terminal backend
DB_DATABASE=ctdt_topic_review_<timestamp> PORT=3102 npm run start:prod

# Frontend test, terminal frontend
BACKEND_API_URL=http://127.0.0.1:3102 npm run dev -- --hostname 127.0.0.1 --port 3101

# Terminal backend khác
TOPIC_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_topic_review_<timestamp> \
  TOPIC_TEST_URL=http://localhost:3101 npm run test:topic-integration

DEFENSE_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_topic_review_<timestamp> \
  FRONTEND_URL=http://localhost:3101 npm run test:defense-integration
```

Thay <timestamp> bằng số thực, không gõ nguyên dấu <> trong shell.
Dùng localhost khi mở frontend test để origin khớp cấu hình Next.
Integration tạo session chỉ có trên bản sao và probe API trước khi ghi HTTP.
Chạy topic integration trước browser: fixture tạm nằm ngoài repo, chỉ chứa tài khoản test.
Browser optional cần Playwright cài riêng trên máy test, không thêm dependency production:

```bash
TOPIC_TEST_ALLOW_WRITES=1 DB_DATABASE=ctdt_topic_review_<timestamp> \
  PLAYWRIGHT_MODULE_PATH=/duong-dan/node_modules/playwright \
  npm run test:topic-browser
```

Kết quả triển khai: 156 unit test/19 suites; 118 kiểm tra đề tài qua proxy frontend
và SQL; 119 kiểm tra hồi quy bảo vệ; browser test đăng nhập/thêm GVHD/lưu-reload/
duyệt/phân quyền/tên đề tài chỉ đọc đạt; backend/frontend build và lint đạt.

Đối chiếu database local bằng test:topic-parity: 24 kiểm tra chỉ đọc đạt; chưa có đề tài/GVHD mẫu được thêm vào DB thật.
