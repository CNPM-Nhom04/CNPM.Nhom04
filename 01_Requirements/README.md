# Phạm vi và yêu cầu hệ thống

Tài liệu này tổng hợp chức năng hiện có trong mã nguồn và luồng đã được nhóm kiểm thử; không thay thế một SRS được phê duyệt riêng. PDF QA ngày 09/11/2026 không kèm bản SRS gốc hay quy định bắt buộc sáu nhóm thư mục.

- Quản trị danh mục, đơn vị, ngành, tài khoản/vai trò/phạm vi, tham số và nhật ký.
- CTĐT: đọc nguồn AGU, tạo bản nội bộ, cấu trúc học phần/tín chỉ, gửi duyệt và ban hành. Nguồn công khai chỉ đọc; ghi dữ liệu theo quyền và phạm vi.
- Lớp và hồ sơ học viên gắn với đúng phiên bản/hướng CTĐT.
- Điểm: chọn đơn vị → lớp → học kỳ → môn, thêm/sửa bằng Excel, xem trước khác biệt, lưu lịch sử, hoàn tất giảng dạy, chốt và in. Giảng viên chỉ xem/in.
- Đề tài/GVHD, xét duyệt, lịch và kết quả bảo vệ, nghiệm thu.
- Xét **điều kiện** tốt nghiệp theo CTĐT, môn bắt buộc, nhóm tín chỉ, quy định và minh chứng; không phải công nhận tốt nghiệp/cấp bằng.
- Cổng thông tin, văn bản, liên hệ tuyển sinh và báo cáo Excel.

Học viên không tự đăng ký học phần. Các bảng liên kết môn/học kỳ được dùng nội bộ cho quản lý điểm. Một tài khoản có quyền chức năng chưa đồng nghĩa có quyền với dữ liệu ngoài phạm vi. Người tạo không tự duyệt CTĐT.

Tiêu chí nghiệm thu kỹ thuật và cách chạy: [05_Testing](../05_Testing/README.md). Thiết kế: [02_Design](../02_Design/README.md).
