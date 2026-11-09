# Chỉ mục tài liệu bàn giao

- [Cài đặt local và khôi phục dữ liệu](../docs/LOCAL_TEST_SETUP.md).
- [Chạy Ubuntu/WSL](../docs/WSL_TEST_SETUP.md).
- [Docker dev/staging/production](../04_Infrastructure/docker/README.md).
- [Yêu cầu/phạm vi chức năng](../01_Requirements/README.md).
- [Thiết kế và dữ liệu](../02_Design/README.md).
- [Kiểm thử, coverage, audit, integration](../05_Testing/README.md).
- [Đối chiếu lỗi QA 09/11/2026](../05_Testing/QA_REGRESSION_2026-11-09.md).
- [Nguồn chương trình AGU](../03_SourceCode/docs/AGU_PROGRAM_CATALOG.md).
- [Các luồng Excel](../03_SourceCode/docs/EXCEL_ONLY_WORKFLOWS.md).

Giữ đường dẫn `docs/` và `artifacts/agu-source/` để không làm hỏng liên kết/mã nhập nguồn hiện có. Sáu nhóm đánh số là nơi điều hướng phần yêu cầu, thiết kế, source, hạ tầng, testing và bàn giao. Nguồn AGU là bằng chứng/dữ liệu đầu vào, không phải log test tạm.

CSDL và tài liệu upload được bàn giao riêng qua kênh nội bộ; không commit password, .env thật, sessions/reset tokens hoặc dump chứa dữ liệu tài khoản. Người nhận tự sinh JWT secret và cấu hình SMTP phù hợp.
