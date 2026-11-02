# Đối chiếu xác thực, phân quyền và phạm vi dữ liệu

Đã kiểm tra ngày 02–03/11/2026 bằng vai trò/quyền SQL đang dùng, controller/guard NestJS, menu và trang frontend. Quyền chức năng lấy qua `user_roles → roles ACTIVE → role_permissions → permissions`. Phạm vi dữ liệu lấy riêng từ `user_scopes` và các view `vw_user_*_access`. Tên vai trò gửi trong JWT không tự cấp quyền.

## Ma trận vai trò SQL hiện tại

| Chức năng | ADMIN | TRAINING_OFFICER | APPROVER | LECTURER | STUDENT |
| --- | --- | --- | --- | --- | --- |
| Trang chủ / CTĐT công khai / quy chế | Có | Có | Có | Có | Có |
| Dashboard | Có | Có | Có | Có | Không |
| Người dùng / vai trò / phạm vi | Có: USER_MANAGE; gán vai trò/phạm vi cần thêm ROLE_SCOPE_MANAGE | Không | Không | Không | Không |
| Khoa / ngành / danh mục / văn bản cổng thông tin | MASTERDATA_MANAGE | Không | Không | Không | Không |
| Cấu hình / nhật ký toàn hệ thống | SETTINGS_MANAGE / AUDIT_READ_ALL | Không | Không | Không | Không |
| Nhập tài khoản học viên theo lớp | Có, cần đủ 3 quyền trong Student Accounts README | Không | Không | Không | Không |
| Xem danh mục học phần | Có | Có | Có | Có | Không |
| Thêm/sửa học phần, phiên bản | Không | CATALOG_MANAGE | Không | Không | Không |
| Xem CTĐT quản lý và báo cáo | Có | Có | Có | Không | Không |
| Tạo/sửa cấu trúc CTĐT | Không | PROGRAM_EDIT | Không | Không | Không |
| Gửi duyệt CTĐT | Không | PROGRAM_SUBMIT | Không | Không | Không |
| Xét duyệt CTĐT / lưu trữ | Không | Không | PROGRAM_APPROVE / PROGRAM_ARCHIVE | Không | Không |
| So sánh CTĐT | Không | PROGRAM_COMPARE | PROGRAM_COMPARE | Không | Không |
| Xuất khung CTĐT / báo cáo / so sánh | Không | Có: PROGRAM_EXPORT và quyền đọc chức năng tương ứng | Có: PROGRAM_EXPORT và quyền đọc chức năng tương ứng | Không | Không |
| Xuất danh mục học phần | Có | Có | Có | Có | Không |
| Xem đề tài / bảo vệ / điểm / xét tốt nghiệp | Có | Có | Có | Không | Không |
| Tạo/sửa đề tài, hồ sơ GVHD | Không | TOPIC_MANAGE | Không | Không | Không |
| Duyệt / nghiệm thu đề tài | Không | Không | TOPIC_APPROVE / TOPIC_COMPLETE | Không | Không |
| Lập lịch / hủy lịch bảo vệ | Không | DEFENSE_SCHEDULE | Không | Không | Không |
| Ghi kết quả bảo vệ | Không | DEFENSE_RESULT | DEFENSE_RESULT | Không | Không |
| Nhập/sửa/chốt điểm | Không | GRADE_MANAGE | Không | Không | Không |
| Chạy đối chiếu tốt nghiệp | Không | GRADUATION_CHECK | GRADUATION_CHECK | Không | Không |
| Xác minh hồ sơ tốt nghiệp | Không | GRADUATION_EVIDENCE | Không | Không | Không |
| Thiết lập quy định tốt nghiệp | Không | Không | GRADUATION_POLICY | Không | Không |
| CTĐT của tôi ngoài dashboard | Không, trừ khi có thêm vai trò STUDENT hợp lệ | Như Admin | Như Admin | Như Admin | PROGRAM_READ_OWN + hồ sơ/phân công đúng tài khoản |

Đây là **quyền đã có trong SQL**, không tự mở rộng ADMIN thành toàn quyền nghiệp vụ. Nếu muốn thay đổi chính sách vai trò phải thống nhất trước, cập nhật SQL và kiểm tra lại. Xuất danh mục học phần hiện theo CATALOG_READ; xuất nhật ký theo AUDIT_READ_ALL. Hai loại này không sử dụng PROGRAM_EXPORT.

Nhiều vai trò hoạt động được hợp quyền. Quyền đọc không đồng nghĩa quyền sửa, duyệt hoặc xuất. Người gửi hồ sơ CTĐT không tự duyệt hồ sơ của mình; người tạo đề tài không tự duyệt/nghiệm thu. Bản ban hành/lưu trữ không cho sửa cấu trúc; trạng thái nghiệp vụ vẫn được kiểm tra dù tài khoản có quyền ghi.

## Phạm vi theo SQL

- GLOBAL: xem dữ liệu thuộc chức năng được cấp trên toàn hệ thống.
- ORG_UNIT: đúng đơn vị và đơn vị con theo `organizational_unit_closure`.
- MAJOR/PROGRAM: có hiệu lực đối với CTĐT. View học phần/học viên hiện chỉ hỗ trợ GLOBAL/ORG_UNIT; không tự suy rộng quyền ngành/CTĐT sang toàn bộ học phần hoặc danh tính học viên.
- Không có phạm vi quản lý: danh sách quản lý rỗng, không tự lấy đơn vị công tác làm quyền.
- Đơn vị công tác khác với phạm vi. `users.organizational_unit_id` không tự quyết định quyền xem dữ liệu.
- Học viên dùng `students.user_id` của phiên đăng nhập và phân công ACTIVE đúng `program_version_track_id`. Không tự đoán theo tên đăng nhập/email, không dùng ID học viên do trình duyệt truyền, không tự đổi sang phiên bản CTĐT mới nhất.

Các tài khoản được quan sát khi rà soát:

| Tài khoản | Vai trò / phạm vi đáng chú ý |
| --- | --- |
| admin | ADMIN, GLOBAL; vẫn bị giới hạn theo quyền chức năng ở bảng trên |
| officer.fit, test.ctdt.01 | Cán bộ đào tạo, ORG_UNIT FIT |
| officer.fbe | Cán bộ đào tạo, ORG_UNIT FBE |
| approver.fit, thuan | Người duyệt, ORG_UNIT FIT |
| dat | LECTURER, **GLOBAL**: chỉ có CATALOG_READ nhưng xem ngân hàng học phần toàn hệ thống; không được sửa điểm/CTĐT hoặc vào Admin |
| sv001 / sv002 / sv003 | STUDENT, đã có hồ sơ và phân công ACTIVE |
| hv2026001 | STUDENT, đã có hồ sơ/phân công, còn bắt buộc đổi mật khẩu lần đầu tại thời điểm kiểm tra |
| huy | STUDENT nhưng chưa có hồ sơ `students.user_id` liên kết; trang cá nhân phải báo chưa liên kết, không hiện CTĐT của người khác |

Không tự đổi phạm vi `dat` hoặc đoán hồ sơ cho `huy`. Nếu `dat` chỉ được xem khoa/bộ môn thì Admin sửa phạm vi bằng **Nhân sự & Phân quyền**, chọn đúng đơn vị và phạm vi đơn vị. Tài khoản `huy` cần xác minh hồ sơ học viên đúng người để liên kết; chức năng nhập Excel không ghi đè tài khoản có sẵn. Đã bổ sung nút **Liên kết tài khoản** tại **Lớp & Tài khoản học viên**: chọn hồ sơ SQL hoặc tạo hồ sơ mới cho tài khoản chưa có hồ sơ, xác minh đúng người rồi gắn lớp/CTĐT trong transaction. Xem Student Accounts README. Tài khoản thật `huy` chưa tự gắn hồ sơ vì chưa được cung cấp danh tính/mã học viên và lớp tương ứng.

## Chỗ sai đã sửa trong đợt rà soát

Trước đó xuất khung CTĐT kiểm tra PROGRAM_EXPORT, nhưng xuất báo cáo và xuất so sánh chỉ kiểm tra quyền đọc/so sánh. Đã bổ sung kiểm tra PROGRAM_EXPORT cho hai API tải Excel và khóa nút frontend khi không có quyền. Không sửa role_permissions thật, không cấp thêm quyền Admin.

- `/bao-cao/xuat-excel`: PROGRAM_READ + PROGRAM_EXPORT, đúng phạm vi SQL.
- `/so-sanh/export`: PROGRAM_COMPARE + PROGRAM_EXPORT, đúng phạm vi của cả hai phiên bản/hướng.
- In báo cáo trên trình duyệt vẫn là thao tác xem dữ liệu theo PROGRAM_READ, không phải tải file Excel.

## Quyền có trong SQL nhưng chưa có chức năng tương ứng

1. LECTURER hiện chỉ CATALOG_READ. Chưa có chức năng giảng viên xem lớp được phân công hoặc nhập điểm theo giảng viên; không tự cấp GRADE_MANAGE rộng cho giảng viên.
2. STUDENT có RESULT_READ_OWN, OUTLINE_READ_OWN nhưng chưa có trang/API riêng xem điểm/đề cương cá nhân. CTĐT cá nhân đã có; quyền còn lại không có nghĩa là tính năng đã hoàn thành.
3. APPROVER có AUDIT_READ_SCOPE nhưng chưa có giao diện/API nhật ký theo phạm vi. Trang nhật ký Admin dùng AUDIT_READ_ALL và chặn người duyệt là đúng; không mở nhật ký toàn hệ thống thay thế.
4. COURSE_REGISTER, REGISTRATION_MANAGE còn trong SQL để giữ cấu trúc cũ, nhưng giao diện đăng ký học phần đã bỏ theo phạm vi đồ án. Không tự bật lại từ quyền này.
5. Các quyền IMPORT_MANAGE, OUTLINE_MANAGE, STUDENT_MANAGE, API_CLIENT_MANAGE không đồng nghĩa đã có đầy đủ màn hình quản trị độc lập cho mọi nghiệp vụ. Nhập Excel ngành và tài khoản học viên hiện đã có luồng/quyền riêng được mô tả trong README từng module.
6. Xét tốt nghiệp hiện đối chiếu điều kiện; không phải quyết định công nhận/cấp bằng chính thức. Nhận thông tin tuyển sinh chỉ lưu liên hệ, không xét tuyển/trúng tuyển.

Các phần trên là giới hạn triển khai, không khắc phục bằng cách cấp toàn quyền hoặc mở menu không có backend. Với phạm vi quản lý CTĐT, ưu tiên luồng danh mục → CTĐT → gửi/xét duyệt → so sánh/xuất → học viên xem đúng CTĐT; các chức năng cá nhân khác có thể làm sau nếu yêu cầu đồ án cần.

## Test lại bằng giao diện

Dùng cửa sổ riêng hoặc đăng xuất trước khi đổi tài khoản. Không cần biết mật khẩu tài khoản của người khác; dùng tài khoản nhóm đã bàn giao hoặc tài khoản test Admin tạo.

1. Admin: thấy nhóm quản trị; mở danh mục học phần/CTĐT chỉ xem. Không có thao tác tạo CTĐT/duyệt; nút xuất báo cáo bị khóa vì SQL chưa cấp PROGRAM_EXPORT.
2. Cán bộ FIT: thấy nghiệp vụ đào tạo, không thấy menu Admin; chỉ thấy CTĐT FIT. Truy cập trực tiếp `/dashboard/admin/nguoi-dung` phải báo không có quyền. Sửa nghiệp vụ chỉ trong phạm vi được cấp và đúng trạng thái.
3. Cán bộ FBE: dữ liệu theo FBE. Dán ID CTĐT FIT vào API/trang chi tiết không được đọc dữ liệu FIT.
4. Người duyệt: có menu xét duyệt, không có nút tạo/sửa CTĐT hoặc nhập điểm. Xét duyệt hồ sơ đúng phạm vi và không tự duyệt hồ sơ do mình gửi.
5. Giảng viên: dashboard và danh mục học phần theo phạm vi SQL; không thấy nút quản lý học phần hoặc các menu CTĐT/điểm/Admin.
6. Học viên: đăng nhập về trang chủ; nếu bắt buộc đổi mật khẩu thì chuyển đến `/doi-mat-khau`. Sau đó mở `/ctdt-cua-toi`. Dán đường dẫn dashboard phải chuyển về CTĐT cá nhân; API Admin/đào tạo trả 403.
7. Thu hồi quyền/đổi vai trò trong SQL có hiệu lực ở lần gọi API tiếp theo; không tin vai trò cũ trong JWT. Vô hiệu tài khoản, hết hạn/thu hồi phiên trả 401. Menu lấy hồ sơ SQL lại khi chuyển trang/tải lại.

## Kiểm tra tự động

Backend: `npm test -- --runInBand`, `npm run lint`. Frontend: ESLint các trang thay đổi và production build trên bản sao.

`test:access-matrix-integration` và `test:access-matrix-browser` chỉ chạy trên SQL clone `ctdt_major_review_<chuso>`, cần `MAJOR_TEST_ALLOW_WRITES=1`. Backend/Next của môi trường thử phải cùng database clone và JWT_SECRET. `MAJOR_TEST_URL` mặc định http://localhost:3101; backend test http://127.0.0.1:3102. Bài integration tạo tài khoản/phiên riêng trên clone; JWT cố tình có claim ADMIN để chứng minh backend vẫn dùng quyền thật trong SQL. Chỉ kiểm tra lệnh ghi bị từ chối, không tạo điểm/kết quả/nghiệp vụ giả trên dữ liệu thật.

Browser chạy sau integration, đọc `access.json` trong thư mục chứa `MAJOR_BROWSER_FIXTURE` (mặc định `/tmp`), dùng Playwright/Chromium và `PLAYWRIGHT_MODULE_PATH` nếu cài ngoài repo. Xóa database clone, fixture chứa token và quyền truy cập clone sau khi xong.
