# Nhập và sửa dữ liệu qua Excel

## Phạm vi đã chuyển đổi

| Màn hình | Dữ liệu nhập/sửa |
| --- | --- |
| Quản lý điểm | Khoa → lớp học viên → học kỳ; nhập và điều chỉnh điểm theo từng ô từ Excel; quy tắc điểm và căn cứ chốt/hủy/mở lại qua Excel |
| CTĐT | Thông tin chung qua Excel; chi tiết học phần và định mức nhóm trong mẫu Excel, thông tin nguồn kế thừa từ phiên bản trước |
| Danh mục học phần | Thêm học phần, chỉnh sửa/tạo phiên bản bằng Excel |
| Khoa, ngành, danh mục | Tạo và sửa qua Excel; mẫu điền sẵn bản ghi thật, nhập ngành hàng loạt hỗ trợ cả thêm và sửa |
| Lớp học viên | Tạo/sửa lớp, liên kết tài khoản qua Excel; mẫu nhập tài khoản hàng loạt điền sẵn học viên hiện có trong sheet nhập, không xuất mật khẩu cũ |
| Tài khoản | Tạo/sửa thông tin, vai trò, phạm vi qua Excel, giữ kiểm tra quyền của API quản trị |
| Cấu hình hệ thống | Mẫu điền sẵn cấu hình hiện tại, sửa ô tương ứng trong bảng ngang và xem khác biệt |
| Cổng thông tin | Thêm/sửa metadata văn bản qua Excel; nút công bố/thu hồi và tải tệp đính kèm vẫn theo quyền hiện có |
| Đề tài/GVHD | Dữ liệu đề tài, hồ sơ hướng dẫn, căn cứ xử lý qua Excel |
| Bảo vệ luận văn | Lịch, kết quả và lý do hủy qua Excel |
| Xét duyệt | Biên bản và kết luận qua Excel; kiểm tra quyền/người duyệt và xác nhận của nghiệp vụ cũ vẫn áp dụng |
| Xét tốt nghiệp | Quy định và hồ sơ minh chứng qua Excel; chọn phạm vi chạy xét là thao tác lọc, giữ giao diện chọn |

Đăng nhập/đổi mật khẩu và đăng ký nhận thông tin công khai là các luồng tự phục vụ, không phải form nhập dữ liệu nội bộ. Tìm kiếm, lọc, chọn phạm vi, xem, in, tải tệp và các lệnh nghiệp vụ vẫn dùng các nút tương ứng. Không tạo dữ liệu mẫu giả trong CSDL.

## Form Excel dùng chung

`ExcelOnlyForm` giữ các bộ xử lý nghiệp vụ và trạng thái React hiện có, dùng Excel làm bề mặt sửa dữ liệu. Các ô nhập gốc và nút lưu thủ công của form được ẩn. Tải mẫu từ các giá trị đã nạp; khi thêm một phiên bản CTĐT của chương trình đã có, API lấy metadata của phiên bản gần nhất và liên kết `source_program_version_id` để mẫu chi tiết kế thừa học phần/định mức.

File mới gồm sheet `Du lieu`: một cột cho tên bản ghi, các cột tiếp theo là thông tin, dòng 2 điền sẵn dữ liệu hiện tại. Bản gốc và mã trường nằm trong sheet hệ thống ẩn. Sheet `Danh sach chon` cung cấp mã và tên hiển thị hợp lệ. Không xuất mật khẩu cũ. Upload bị từ chối khi sai màn hình/bản ghi, bản gốc trên form đã thay đổi, sửa trường chỉ đọc, mã lựa chọn sai hoặc chứa công thức.

Chỉ các giá trị khác biệt được đưa vào trạng thái form trước khi gọi bộ xử lý lưu hiện có; các trường còn lại giữ nguyên. Kiểm tra bắt buộc/định dạng của form và kiểm tra quyền/nghiệp vụ tại API vẫn chạy. Những chức năng chưa có revision ở API giữ cơ chế đồng thời hiện có; cơ chế hợp nhất từng ô có kiểm tra xung đột phía máy chủ áp dụng cho bảng điểm, danh mục và các danh sách qua `/excel-records`.

Nếu đổi khoa, ngành, học viên hoặc loại yêu cầu làm phát sinh danh sách/trường phụ thuộc, chọn **Áp dụng để bổ sung trường phụ thuộc**, đợi danh sách tải xong, tải lại mẫu và điền tiếp. Không lưu khi còn trường mới chưa có trong file.

## Nhập điểm theo lớp và môn

Cán bộ chọn **Đơn vị/Khoa → Lớp → Học kỳ → Môn học**. Môn lấy từ đúng phiên bản/hướng CTĐT của lớp và phạm vi tài khoản. Bấm **Tải Excel học viên và điểm hiện có** để hệ thống tự chuẩn bị liên kết môn–học kỳ và danh sách học từ học viên hoạt động, có phân công CTĐT khớp lớp. Không cần tạo lớp học phần hay nhập file danh sách học riêng.

`POST excel/mo-bang-diem` thực hiện trong một transaction, kiểm tra lại tài khoản/quyền/phạm vi, khóa lớp/học viên/học kỳ và tái sử dụng liên kết có sẵn. Tải lại không tạo trùng và không tạo/sửa điểm. Nếu chưa có liên kết, hệ thống tạo hồ sơ học kỳ CLOSED để không mở đăng ký tự phục vụ. Đăng ký đã hủy/rút không được tự mở lại. Không tự hợp nhất trường hợp môn có nhiều lớp giảng dạy đã có dữ liệu.

Nếu chưa có quy tắc, lần bấm tải đầu sẽ mở cửa sổ cấu hình tỷ lệ theo hồ sơ bằng Excel. Lưu quy tắc rồi bấm tải lại để nhận mẫu điểm mới nhất. Dùng **Quy tắc tính điểm môn đã chọn** để xem quy tắc đã lưu. Mẫu điểm chứa danh sách học viên và điểm cũ của riêng môn đã chọn. Nhập Excel, xem trước các ô khác biệt rồi xác nhận lưu. Quy tắc không được tự đoán hoặc gán mặc định.

API `GET excel/mon-hoc?classId=...&termId=...` trả môn đúng CTĐT. `POST excel/mo-bang-diem` nhận `classId`, `termId`, `courseVersionId`. Các API danh sách học cũ còn giữ tương thích, không nằm trong giao diện nhập điểm chính.

## Bảng điểm và xung đột

API `quan-ly-diem/excel`:

- `GET options`: khoa/lớp và học kỳ đã cấu hình trong phạm vi tài khoản, kể cả lớp chưa có điểm.
- `GET rows?classId=...&termId=...`: đăng ký/kết quả theo lớp học viên và học kỳ, chỉ trả học viên và học phần có quyền đọc.
- `GET mau?classId=...&termId=...&courseVersionId=...`: chỉ cán bộ đào tạo có GRADE_READ + GRADE_MANAGE được tải file chỉnh sửa.
- `POST kiem-tra` và `POST luu`: multipart `file`, XLSX tối đa 5MB/5000 dòng. Cùng file được đọc và xác thực lại khi lưu; không tin dữ liệu preview do trình duyệt gửi.

Mẫu chứa điểm hiện có và bản gốc được ký HMAC theo tài khoản/lớp/học kỳ/môn. Mã đăng ký, học viên, môn, lớp học phần và trạng thái không được sửa. Dòng thay đổi cần lý do tối thiểu 10 ký tự và số hồ sơ.

So sánh ba phía: gốc trong mẫu → giá trị mới trong Excel → giá trị hiện tại trong SQL. Chỉ sửa những ô được thay đổi trong file. Nếu người khác sửa một ô khác thì giữ lại thay đổi đó; nếu cùng ô đã thay đổi hoặc phiên bản kết quả/quy tắc/trạng thái đã thay đổi thì từ chối toàn bộ file. Dòng không đổi không tạo lịch sử hay tăng revision. Bỏ dòng khỏi file không xóa kết quả. Ô trống khác điểm 0; xóa nội dung một điểm có sẵn là yêu cầu đưa điểm đó về NULL.

Kiểm tra tất cả các dòng trước khi ghi. Khóa học viên theo thứ tự, kiểm tra lại quyền SQL và áp dụng tất cả thay đổi trong một transaction, gồm lịch sử/audit. Các thao tác tạo/sửa nội bộ dùng chung transaction này; không ghi thành công một phần.

Điểm đã chốt dùng lại quy tắc đã lưu, yêu cầu lớp COMPLETED và đủ thành phần. Điểm LEGACY không bị quy đổi thành điểm thành phần; giữ khu vực xem/in riêng và chức năng điều chỉnh hồ sơ bằng Excel. Dòng VOIDED phải mở lại trước khi nhập.

## Quyền và triển khai

Migration `1794000000000-LecturerGradeRead` cấp GRADE_READ và bỏ GRADE_MANAGE ở vai trò LECTURER. GradeGuard và transaction ghi còn yêu cầu vai trò TRAINING_OFFICER, nên gán nhầm quyền GRADE_MANAGE cho giảng viên không đủ để ghi điểm. Các API nhập/sửa từng dòng điểm thủ công đã bỏ; lệnh chốt/hủy/mở lại vẫn kiểm tra quyền và revision. Trang giảng viên không có công cụ nhập Excel hay chỉnh sửa, chỉ xem/chi tiết/in.

Migration này đã áp dụng trên DB local trong phiên triển khai. Máy khác chạy `npm run migration:run` rồi khởi động lại backend nếu không dùng chế độ watch. Không thay đổi bảng điểm khi migration chạy.

## Kiểm tra

- Backend: `npm run build`; `npm test -- --runInBand`.
- Frontend: `npm run typecheck`; `npm run build`; `node test/program-selection.test.mjs`.
- CSDL thật chỉ đọc: `node test/grade-excel-parity.cjs`, kiểm tra quyền/truy vấn phạm vi và hash kết quả trước/sau.
- Kiểm tra trình duyệt chưa thực hiện được trong môi trường hiện tại: Chromium có sẵn thiếu `libnspr4.so`. Cần kiểm tra trực quan, thao tác nhập file/những danh sách phụ thuộc và in trên trình duyệt có đủ thư viện. Không ghi điểm thử vào DB đang dùng.

Các bài integration/browser cũ gọi API tạo/sửa từng dòng điểm không còn đại diện cho luồng mới; không dùng các script đó như bằng chứng kiểm thử Excel. Bộ unit mới kiểm tra chữ ký file, bảo toàn 0/NULL, xung đột từng ô, ghi nguyên tử, quyền giảng viên và bản dữ liệu cũ trong mẫu.

## Sheet ví dụ ở cuối các file mẫu

Tất cả mẫu nhập/sửa có tab **Ví dụ điền đúng** đặt cuối file, màu vàng cam. Sheet chứa ví dụ đã điền theo các cột của sheet nhập, ghi chú các trường bắt buộc và cách chọn mã. Các danh sách học/điểm/CTĐT dùng định danh hiện có trong phạm vi; ngành và tài khoản mới dùng dữ liệu minh họa được ghi rõ. Mẫu form chung có ví dụ cho từng giá trị, số, ngày, email, mật khẩu mới, mã lựa chọn, lý do và số hồ sơ. Không xuất mật khẩu cũ.

Chỉ nhập dữ liệu thực tế vào sheet chính. Các số hồ sơ bắt đầu bằng `VD-`, tên/email/mã minh họa phải thay bằng dữ liệu thật. Sheet ví dụ hoàn toàn bị bỏ qua khi import; không tạo học viên/ngành, đăng ký hay điểm từ ví dụ. File đã tải từ trước không tự thay đổi; tải lại mẫu mới để có tab này. File báo cáo chỉ để xem/in và file bàn giao tài khoản không phải mẫu nhập nên không thêm dữ liệu giả.

## Chi tiết và lịch sử điểm

Cửa sổ chi tiết hiển thị học viên, môn, lớp học phần, trạng thái điểm/lớp và các điểm thành phần/tổng. Lịch sử dùng tên tiếng Việt: Tạo điểm nháp, Cập nhật điểm nháp, Chốt điểm, Hủy hiệu lực điểm, Mở lại điểm nháp, Điều chỉnh điểm đã chốt/kết quả lịch sử.

Backend trả `availableActions` theo quyền, trạng thái kết quả, đăng ký, trạng thái lớp và điểm tổng. Giao diện khóa các lệnh chưa đủ điều kiện và hiện lý do; mọi lệnh ghi vẫn kiểm tra lại trong transaction. Chỉ chốt DRAFT có đăng ký REGISTERED, lớp COMPLETED, quy tắc và đủ điểm có trọng số. Điểm tổng 0 vẫn là điểm hợp lệ. Không tự chuyển lớp từ OPEN sang COMPLETED khi nhập điểm.

Khi chọn lệnh đủ điều kiện, khung Excel mang tên Hồ sơ chốt điểm / Hồ sơ hủy hiệu lực điểm / Hồ sơ mở lại điểm, kèm nút tải và xác nhận đúng lệnh. File chỉ cần lý do và số hồ sơ, có ví dụ ở tab cuối. Nút bổ sung trường phụ thuộc không xuất hiện trong các hồ sơ này. Mở lại đưa điểm về nháp và làm trống các điểm thành phần; hủy hiệu lực vẫn giữ lịch sử. Phần quy tắc điểm luôn hiển thị trọng số, ngưỡng đạt, cách làm tròn và hồ sơ hiện tại, kể cả khi đã khóa sửa do có bảng điểm.

## Danh mục dùng chung: file có các dòng thật

Trang master-data dùng mẫu riêng `Danh_muc_hien_co.xlsx`, sheet `Danh muc` điền sẵn toàn bộ dữ liệu CSDL, mỗi danh mục một dòng: mã, tên, loại, mô tả và trạng thái. Ví dụ dữ liệu thực tế hiện có: DOCTOR — Tiến sĩ, MASTER — Thạc sĩ, FBE — Khoa Kinh tế - Quản trị, FIT — Khoa Công nghệ Thông tin, FIT-IS — Bộ môn Hệ thống thông tin. Không dùng mẫu dọc Mã trường / Thông tin cho danh mục nữa.

Tải mẫu tại `GET /api/admin/master-data/import/mau-excel`. Sửa dòng hiện có; thêm mới bằng cách điền dòng trống bên dưới, hệ thống tự cấp ID. Không sao chép cả dòng cũ vì ID của dòng cũ được ẩn. Loại danh mục và trạng thái có danh sách chọn bằng tiếng Việt. Không đổi loại của dòng đã có. Xóa dòng khỏi file không xóa danh mục. Khi bấm sửa trên một dòng trong giao diện, file vẫn chứa toàn bộ danh sách và đánh dấu dòng đó màu xanh.

Upload `POST import/kiem-tra` để xem khác biệt rồi `POST import/luu` để xác nhận. Bản gốc được ký theo tài khoản. Chỉ sửa ô thay đổi, giữ thay đổi đồng thời ở ô khác, báo xung đột nếu cùng ô đã đổi. Toàn bộ file lưu trong một transaction, dùng lại quy tắc/audit và quyền ADMIN + MASTERDATA_MANAGE của chức năng cũ. Dữ liệu thật không thay đổi khi chỉ tải mẫu hoặc xem trước.


## Mẫu theo dòng cho các màn hình còn lại

Các mẫu mới của khoa, ngành, tài khoản, lớp học viên, học phần, CTĐT, đề tài, GVHD, lịch/kết quả bảo vệ và văn bản cổng thông tin dùng `GET /excel-records/:resource/template`. Sheet `Du lieu` có dữ liệu thật trong phạm vi tài khoản, mỗi bản ghi một dòng; ID ẩn giữ nguyên, các cột hiển thị mã/tên và thuộc tính. Sheet `Danh sach chon` chứa tên hiển thị, có danh sách thả xuống; `Ví dụ điền đúng` nằm cuối. Dòng trống dưới danh sách dùng để thêm mới, không sao chép ID ẩn. Các chức năng riêng của điểm/chi tiết CTĐT/danh mục vẫn dùng mẫu chuyên dụng.

`POST .../preview` chỉ đọc và kiểm tra; `POST .../apply` đọc lại file, tải lại quyền/phạm vi và dữ liệu mới nhất. Bản gốc HMAC gắn với tài khoản và loại dữ liệu. So sánh từng ô giữa gốc, file sửa và SQL; giữ thay đổi đồng thời ở ô khác, từ chối khi cùng ô xung đột. Bỏ dòng khỏi file không xóa dữ liệu. Dòng không đổi không gọi hàm lưu. Mỗi file tối đa 5000 bản ghi, tối đa 500 dòng thay đổi (100 cho tài khoản), dung lượng 5MB.

Mọi dòng ghi đi qua dịch vụ/repository nghiệp vụ gốc. DataSource dùng riêng cho batch gắn với một EntityManager; các transaction của repository tham gia transaction ngoài, không thay đổi DataSource toàn cục. Một dòng lỗi sẽ rollback cả file, gồm audit. Trường nền xám giữ nguyên theo quyền/trạng thái: học phần sửa tạo bản nháp mới; CTĐT chỉ sửa DRAFT/RETURNED; đề tài chỉ sửa trạng thái cho phép; GVHD đã có chỉ đổi trạng thái; lịch đã lập không đổi thông tin hội đồng/ngày/địa điểm bằng luồng ghi kết quả.

Cấu hình, quy tắc tính điểm, quy định tốt nghiệp, hồ sơ minh chứng, biên bản xét duyệt và các hồ sơ chốt/hủy dùng bảng ngang một dòng, có sẵn dữ liệu hiện tại và tên đối tượng. Không còn xuất mẫu dọc Mã trường/Thông tin/Giá trị mới. Bộ đọc vẫn nhận mẫu dọc cũ để tương thích; các mẫu tải mới dùng định dạng ngang. Các form phụ thuộc dùng bước áp dụng để bổ sung trường; riêng liên kết tài khoản đã đưa lựa chọn ra màn hình.

Mẫu học viên của lớp điền sẵn mã, họ tên, email và tên đăng nhập ngay ở sheet `Hoc vien`. Dòng đã có tài khoản và không đổi được bỏ qua, không cấp lại mật khẩu; chỉnh sửa tài khoản hiện có dùng mẫu Người dùng. Thêm mới vẫn giữ kiểm tra trùng, liên kết hồ sơ SQL, cấp mật khẩu ngẫu nhiên và tải file bàn giao một lần. Chỉ tính học viên mới vào giới hạn mỗi lần nhập.

Kiểm tra cập nhật: toàn bộ 54 suites/411 tests backend và production build frontend đã thành công. Đối chiếu chỉ đọc mẫu thật và preview file không đổi cho các tài nguyên có dữ liệu; văn bản cổng thông tin hiện chưa có bản ghi nên mẫu có dòng tiêu đề, danh sách chọn và ví dụ. Chưa kiểm tra thao tác trình duyệt do Chromium thiếu thư viện hệ thống như đã ghi phía trên.


## Cấu hình và danh sách chọn

Cấu hình đang sử dụng gồm điểm đạt học phần và danh sách chuẩn ngoại ngữ Thạc sĩ/Tiến sĩ. Hai tham số đăng ký học phần đã bỏ khỏi giao diện/API và CSDL bằng migration TrainingSettingsScope1794300000000. Định mức tín chỉ của CTĐT và hướng học vẫn là nguồn dùng để kiểm tra cấu trúc và xét tốt nghiệp; không thay bằng tham số mặc định toàn hệ thống.

Mẫu Excel một hồ sơ sửa dòng 2; mẫu danh sách sửa các dòng có ID ẩn và thêm bản ghi ở dòng trống. Danh sách chọn tham chiếu sheet tra cứu bằng defined names để Excel hiển thị menu thả xuống. File cũ trước khi đổi cấu trúc phải tải lại.

Liên kết tài khoản: chọn tài khoản STUDENT và hồ sơ bằng các dropdown ngay trên màn hình. Nếu chưa có hồ sơ, chọn tạo mới và điền mã trong Excel. File chỉ gồm căn cứ xác minh, xác nhận đúng người và mã hồ sơ mới nếu cần; không cần tải nhiều mẫu chỉ để đổi lựa chọn tài khoản. Không đổi mật khẩu/email/vai trò, không chuyển phân công CTĐT cũ.

## Hoàn tất giảng dạy và chốt điểm

Sau khi nhập điểm, mở **Xác nhận môn đã giảng dạy xong**, tải mẫu Excel điền lý do/số hồ sơ rồi xác nhận. API `POST excel/hoan-tat-mon` chỉ cho cán bộ, kiểm tra môn trong CTĐT, lớp/học kỳ/phạm vi, trạng thái học kỳ và ghi audit. Thao tác này chỉ xác nhận hoàn tất giảng dạy; chốt từng kết quả vẫn yêu cầu đủ điểm và kiểm tra revision như trước. Không tự mở lại môn đã hoàn tất.

`registration_periods`, `course_offerings`, `course_registrations` chỉ giữ liên kết nội bộ học viên–môn–học kỳ; không có chức năng học viên tự đăng ký học phần. Các lớp/điểm/lịch sử đang có được giữ nguyên.

## Dữ liệu sau dọn minh họa

Theo lựa chọn đã xác nhận, dữ liệu MIT/TEST_MIT_01/ENG999/sp/sp1 và các lớp, hồ sơ, điểm, đề tài, bảo vệ, xét duyệt phụ thuộc đã được dọn; tài khoản liên quan được vô hiệu hóa, thu hồi phiên. Giữ audit và bản sao lưu riêng trong artifacts/backups. Không chuyển điểm/môn của MIT sang AGU.

Nguồn AGU vẫn gồm 18 mục ngành và 38 phiên bản; chưa có môn/hướng được số hóa trong curriculum_courses. Không suy diễn cấu trúc, công bố nội bộ hoặc hồ sơ học viên từ tên ngành. Các trang lớp/điểm/xét duyệt trống khi chưa có dữ liệu nghiệp vụ mới là đúng. Bộ lọc hiện thống nhất việc loại CTĐT đã xóa; nguồn công khai có thể xem/so sánh metadata theo quyền đọc nhưng không tự có quyền ghi.

Script scripts/maintenance/cleanup-legacy-data.cjs chỉ dùng cho việc dọn dữ liệu mẫu đã duyệt, dry-run mặc định. Trước apply có bản sao đầy đủ, không tắt khóa ngoại và luôn khôi phục trigger bảo vệ. Không chạy lại để xóa dữ liệu đào tạo thật. Không commit artifacts/backups, .env, mật khẩu hoặc file bàn giao tài khoản.
