# Danh mục CTĐT từ AGU

Nguồn: https://pgd.agu.edu.vn/trainings/majors, đọc ngày 05/11/2026. Bản lưu văn bản nằm ở `artifacts/agu-source`: danh sách 18 mục ngành, 38 trang chương trình và các PDF đính kèm đọc được. Bao gồm ngành do AGU đào tạo, chương trình liên thông và danh mục trường liên kết; 6 mục trường liên kết chưa có phiên bản trên trang nguồn. Trang này công bố đào tạo thạc sĩ, không có căn cứ để tạo CTĐT tiến sĩ.

## Dữ liệu và nguồn

Migration `AguProgramCatalog1794100000000` bổ sung dấu xóa danh mục và bảng nguồn. `program_catalog_sources` ghi ngành/trường/mã gốc; `program_version_sources` ghi URL, tài liệu, thời điểm đọc, hash và nội dung trích xuất. Mã `AGU-<id>` là mã định danh nội bộ của bản nhập, không phải mã phiên bản do trường công bố. Giao diện hiển thị mã ngành gốc.

Mỗi bản nguồn bắt đầu ở DRAFT theo trigger hiện có; không giả lập gửi duyệt/phê duyệt. Bản nguồn chỉ đọc, có nhãn Công bố trên AGU và đường dẫn gốc. Cán bộ có quyền và phạm vi đúng chương trình có thể chọn “Tạo phiên bản nội bộ” để khai báo cấu trúc bằng Excel và đi qua quy trình gửi/duyệt nội bộ; bản nguồn không bị ghi đè. Bản nháp nội bộ không dùng ngoại lệ công khai của phiên bản nguồn để vượt phạm vi đọc. Các bản công khai AGU có thể đọc ở danh mục dashboard/cổng thông tin; ngoại lệ đọc này không áp dụng cho khóa ghi hoặc tạo phiên bản. Ghi dữ liệu nội bộ tiếp tục yêu cầu phạm vi SQL của tài khoản. Bộ lọc bậc đào tạo áp dụng phía SQL cho dữ liệu, tổng số và phân trang của cả danh sách phiên bản và danh sách chưa có phiên bản; DOCTOR nhận cả mã DOCTOR/PHD.

Tín chỉ/thời gian/niên khóa chỉ lấy khi có thông tin nguồn rõ ràng. Chưa đọc được số tín chỉ hoặc tài liệu scan thì để NULL và liên kết về tài liệu gốc. Bản trích trên dashboard giới hạn 200.000 ký tự; tài liệu gốc có toàn bộ nội dung. Không tự chia học phần thành A–D hay đoán loại bắt buộc/tự chọn từ bảng bị mất định dạng. Các cấu trúc học phần có thể xem trong nguồn gốc nhưng chưa được chuyển thành các hàng curriculum_courses.

## Đồng bộ và bỏ dữ liệu cũ

Chạy trong thư mục backend:

```bash
node scripts/agu/manifest.cjs
node scripts/sync-agu-programs.cjs --replace-old
node scripts/sync-agu-programs.cjs --replace-old --apply
```

Mặc định chỉ xem trước. `--apply` sao lưu các bảng CTĐT/hồ sơ liên quan vào `artifacts/backups` (bị gitignore, quyền file 0600), sau đó nhập toàn bộ trong một transaction. Nội dung nguồn thay đổi hash thì dừng để xét bản nhập mới; không ghi đè âm thầm. Chạy lại cùng nguồn không tạo thêm phiên bản. Việc đọc nguồn qua dịch vụ chuyển trang công khai sang văn bản không yêu cầu tài khoản/mật khẩu AGU.

Lần nhập AGU ban đầu đánh dấu xóa MIT, TEST_MIT_01, ENG999, sp và sp1 để bảo toàn khóa ngoại. Sau đó người dùng đã xác nhận xóa cả lớp, học viên và điểm minh họa MIT. Script bảo trì `scripts/maintenance/cleanup-legacy-data.cjs` đã sao lưu riêng và dọn các chương trình cũ cùng phụ thuộc; tài khoản học viên liên quan được vô hiệu hóa và thu hồi phiên. Không chuyển môn, điểm hoặc phân công MIT sang AGU. Audit được giữ; các trigger bảo vệ lịch sử được khôi phục đầy đủ và khóa ngoại không bị tắt.

Các danh sách xét duyệt, hướng tạo lớp và so sánh dùng cùng điều kiện loại chương trình đã xóa. Dữ liệu nguồn AGU không bị sửa trong lần dọn. Các môn/hướng chưa số hóa cần nhập theo hồ sơ nguồn trước khi lập lớp và tiếp nhận học viên; không tự ban hành CTĐT nguồn dưới danh nghĩa người duyệt nội bộ.

Đã áp dụng migration và nhập trên DB local. Đối chiếu thực tế: dashboard ALL=38, MASTER=38, DOCTOR=0; 6 danh mục chưa có phiên bản; cổng thông tin công khai có 38 bản. 5 CTĐT cũ không còn trong danh mục. CTĐT Công nghệ thông tin 2025–2027 có 60 tín chỉ theo nguồn.

## Kiểm tra

- `node --test test/agu-source.test.cjs`: tính đầy đủ, định danh nguồn, số tín chỉ và dữ liệu chưa xác định.
- `npm test -- --runInBand`: gồm lọc SQL, phân trang, phạm vi đọc/ghi, DTO.
- Typecheck backend/frontend và production build frontend.
- Kiểm tra CSDL chỉ đọc qua repository thật cho danh sách, chi tiết, bộ lọc và cổng thông tin; không ghi điểm thử.

## Xuất báo cáo Excel

Trang Tra cứu & Báo cáo dùng cùng danh mục AGU hiện tại, loại các CTĐT có deleted_at và vẫn kiểm tra phạm vi cho dữ liệu nội bộ. Mỗi CTĐT một dòng, lấy bản nguồn có ID công bố mới nhất; báo cáo hiện có 18 dòng, khác danh sách 38 phiên bản. Tín chỉ chưa xác định để trống trong Excel, không đổi thành 0; thêm cột URL nguồn. File không có kết quả vẫn xuất tiêu đề.

Migration AdminReportExport1794200000000 bổ sung PROGRAM_EXPORT cho ADMIN, giữ nguyên vai trò khác. Đã áp dụng trên DB local. Giao diện báo rõ khi tài khoản thiếu quyền, đồng thời bỏ điều kiện khóa xuất chỉ vì kết quả rỗng. Kiểm tra 21 tests báo cáo, typecheck backend, production build frontend và tạo file thật trong bộ nhớ từ repository SQL (18 dòng).

## Phân công quản lý AGU

Theo lựa chọn đã xác nhận, officer.fit và approver.fit được chuyển đơn vị/phạm vi ORG_UNIT sang Trường Đại học An Giang bằng nghiệp vụ cập nhật tài khoản của Admin, có audit. Giữ nguyên vai trò, mật khẩu và danh sách quyền chức năng; không cấp GLOBAL hoặc quyền quản lý trường liên kết. Đối chiếu hiện tại: mỗi tài khoản quản lý 12 mục ngành/chương trình của AGU; officer.fit có thể tạo bản làm việc cho 38 phiên bản nguồn trong phạm vi. approver.fit giữ vai trò thẩm định, không có quyền tạo/sửa chương trình.

Trên môi trường mới, sau nhập nguồn, Admin phân công lại trong Nhân sự & Phân quyền: chọn đơn vị Trường Đại học An Giang, phạm vi Theo đơn vị, giữ vai trò Cán bộ đào tạo/Hội đồng khoa học tương ứng. Không tự áp đặt phân công này cho tài khoản tên khác hoặc các khoa/trường khác.

## Lọc danh sách dashboard theo phạm vi

Danh sách CTĐT mặc định dùng `selectedCatalog=MANAGED`: chỉ các chương trình thuộc phạm vi SQL của tài khoản, bao gồm bản nguồn của đơn vị đó và phiên bản nội bộ. Nguồn `PUBLIC` chỉ liệt kê các phiên bản có `program_version_sources` hoặc danh mục chưa có phiên bản có `program_catalog_sources`, phục vụ tham khảo; không đưa phiên bản nội bộ vào chế độ này. Bộ lọc áp dụng đồng nhất cho dữ liệu, tổng số, phân trang và danh mục chưa có phiên bản. Ngoại lệ đọc chi tiết nguồn công khai và kiểm tra quyền/phạm vi tạo/sửa/duyệt không thay đổi. Giao diện đặt tên hai lựa chọn là “CTĐT thuộc phạm vi tài khoản” và “CTĐT công khai tham khảo (AGU)”. Không thay đổi dữ liệu hay quyền trong CSDL.
