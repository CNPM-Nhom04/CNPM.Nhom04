# Quản lý khoa và hai chức năng xuất Excel

## Quản lý Khoa

- Đăng nhập Admin có quyền `MASTERDATA_MANAGE` → **Quản lý Khoa**, hoặc `/dashboard/admin/khoa`.
- Tìm mã/tên, lọc trạng thái, phân trang; thêm, sửa tên/mã/mô tả/trạng thái.
- Dữ liệu dùng bảng **organizational_units**, chỉ những dòng `unit_type=FACULTY`. Không tạo bảng khoa riêng. Bộ môn/đơn vị khác vẫn có trong **Danh mục dùng chung**; khoa thêm ở màn hình này cũng xuất hiện tại đó và trong lựa chọn đơn vị đang hoạt động của ngành/tài khoản.
- Tạo khoa không tự tạo ngành, CTĐT hoặc tự cấp phạm vi cho tài khoản. Muốn cán bộ làm khoa mới: Admin tạo ngành thuộc khoa, gán đúng đơn vị/phạm vi cho tài khoản; cán bộ đó tạo CTĐT theo quyền SQL.
- Không đổi `parent_id` trong form; trigger SQL hiện cấm chuyển cây đơn vị. Khi thêm, trigger tạo dòng self trong **organizational_unit_closure** để phân quyền theo đơn vị hoạt động đúng.
- Không xóa khoa còn ngành, chương trình, tài khoản, phạm vi, môn, học viên, GVHD, nhật ký có tham chiếu hoặc đơn vị con. Có thể ngừng hoạt động để giữ lịch sử. Việc ngừng khoa không tự chuyển/xóa dữ liệu và không tự thu hồi các phạm vi tài khoản đang có.
- Mỗi sửa/xóa gửi `expectedUpdatedAt` để tránh ghi đè dữ liệu người khác sửa; nhật ký và dữ liệu lưu chung giao dịch. Xóa khoa trống dọn self/ancestor closure; nếu FK chặn thì toàn bộ thao tác được hoàn tác.

API JWT + Admin + `MASTERDATA_MANAGE`:

| API | Chức năng |
|---|---|
| GET `/admin/khoa?searchTerm=&status=ALL&page=1&limit=20` | Danh sách khoa từ SQL |
| POST `/admin/khoa` | Thêm khoa |
| PUT `/admin/khoa/:id` | Sửa khoa, có `expectedUpdatedAt` |
| DELETE `/admin/khoa/:id?expectedUpdatedAt=...` | Xóa khoa chưa sử dụng |

Body thêm: `code`, `name`, `description`, `status` (`ACTIVE`/`INACTIVE`). Sửa thêm `expectedUpdatedAt` nhận từ danh sách. Frontend proxy tương ứng `/api/admin/khoa...`.

Test nhanh: thêm `TEST_KHOA_01`, tên `Khoa kiểm thử`, sửa tên, ngừng hoạt động rồi lọc, mở lại và xóa khi chưa dùng. Trong DBeaver mở đúng database của backend → **Tables → organizational_units → View Data → All Rows → Refresh**; xem `unit_code`, `unit_name`, `unit_type`, `status`. Xem **organizational_unit_closure** để đối chiếu `ancestor_id=descendant_id=id khoa`, `depth=0`. Khoa `FIT` có dữ liệu thì nút xóa phải bị chặn; không xóa dữ liệu thật để thử.

## Xuất Excel danh mục học phần

- Đăng nhập tài khoản có `CATALOG_READ`, vào `/dashboard/danh-muc-hoc-phan`.
- Chọn từ khóa, trạng thái và đơn vị; bấm **Xuất Excel danh mục**.
- API **GET `/danh-muc-hoc-phan/xuat-excel?search=&status=ALL&unitId=...`**; frontend qua `/api/danh-muc-hoc-phan/xuat-excel`.
- Xuất **tất cả** học phần khớp bộ lọc, không chỉ trang đang xem. Query dùng chung với danh sách và kiểm tra **vw_user_course_access** bằng ID người đăng nhập. Chọn `unitId` khoa khác không mở rộng quyền.
- Sheet **Bo loc** ghi điều kiện; **Danh muc hoc phan** có mã môn, bản mới nhất (kể cả DRAFT), tín chỉ/giờ/hiệu lực, đơn vị, trạng thái và các cột bản ACTIVE riêng. Không gộp nhầm bản nháp mới với bản đang dùng. Không có kết quả vẫn tải file có tiêu đề.
- Test: lọc một mã rồi xuất; lọc trạng thái đã khóa rồi xuất; xóa bộ lọc và xuất khi có nhiều trang; đăng nhập cán bộ khoa khác để đối chiếu phạm vi. DBeaver xem **courses** (`course_code`, `owning_unit_id`, `status`), **course_versions** (`course_id`, `version_no`, `status`, `credits`) và **organizational_units** (`id`, `unit_code`).

## Xuất Excel khung CTĐT chi tiết

- Đăng nhập tài khoản có **PROGRAM_READ + PROGRAM_EXPORT**. Theo SQL hiện tại, cán bộ đào tạo và người duyệt có quyền xuất; Admin không tự có `PROGRAM_EXPORT`. Không tự thêm quyền mới vào SQL.
- Vào **Chương trình đào tạo → Xây dựng / Chi tiết** hoặc **Xem đầy đủ** của đúng phiên bản. Chọn **Hướng nghiên cứu / Hướng ứng dụng**, bấm **Xuất Excel hướng đang xem**.
- Có thay đổi chưa lưu thì nút xuất bị khóa, cần lưu trước; file luôn là dữ liệu đã lưu trong SQL.
- API **GET `/chuong-trinh-dao-tao/:versionId/xuat-excel?trackId=:trackId`**; bỏ `trackId` để xuất mọi hướng của phiên bản đó. Hướng không thuộc phiên bản trả `404`; ngoài phạm vi cũng `404`; thiếu quyền `403`.
- Backend đọc toàn bộ khung trong một snapshot giao dịch, không thay môn bằng phiên bản ACTIVE mới nhất. File có các sheet:

  | Sheet | Nguồn / nội dung |
  |---|---|
  | Thong tin CTDT | Phiên bản, tên, ngành, khoa, niên khóa, quyết định và thông tin chung |
  | Huong dao tao | Hướng được chọn, định mức, số môn, tổng TC danh sách |
  | Nhom kien thuc | Nhóm/nhóm cha, TC tối thiểu/tối đa |
  | Khung hoc phan | Đúng course_version_id, môn, tín chỉ, LT/TH, bắt buộc/tự chọn, học kỳ và tiên quyết |
  | Tien quyet | Mỗi liên kết tiên quyết một dòng, ID dòng khung và điểm tối thiểu nếu có |

- Định mức chung chỉ xuất giá trị thực sự lưu trong **program_ui_details.required_total_credits**. Chưa có thì để trống. Định mức hướng lấy **program_version_tracks.required_total_credits**. Tổng TC danh sách bao gồm tất cả lựa chọn tự chọn nên có thể lớn hơn định mức; không hiểu đó là số tín chỉ học viên đã tích lũy.
- DBeaver đối chiếu **program_versions** (id, version_code), **program_version_tracks** (program_version_id, id), **curriculum_groups** (program_version_track_id), **curriculum_courses** (program_version_track_id, course_version_id, requirement_type), **course_versions** (id, credits) và **curriculum_prerequisites** (curriculum_course_id, prerequisite_curriculum_course_id, minimum_grade).
- Test bằng cùng phiên bản nhưng lần lượt hai hướng: tên hướng, số môn và tính chất một số môn có thể khác nhau theo SQL. Thử sửa `trackId` sang hướng của phiên bản khác thì phải bị chặn.

## Kiểm tra tự động

```bash
cd 03_SourceCode/backend
npm test -- --runInBand
npm run lint
npm run test:faculty-export-integration
npm run test:faculty-export-browser
```

Hai script cuối chỉ chạy trên bản sao **ctdt_major_review_<timestamp>**, có `MAJOR_TEST_ALLOW_WRITES=1`, backend/frontend và JWT_SECRET riêng trỏ đúng bản sao, fixture `MAJOR_BROWSER_FIXTURE` từ `test:major-integration`. Integration tạo `exports.json` cạnh fixture để browser dùng; cần Playwright/Chromium hoặc `PLAYWRIGHT_MODULE_PATH`. Script từ chối database thật. Đã kiểm tra scope/bộ lọc/nhiều trang, snapshot phiên bản/hướng/tiên quyết, phân quyền, CRUD khoa, CAS, closure và rollback. Không cần migration hay dependency mới cho ba chức năng này.
