# Hướng Dẫn Quy Trình Làm Việc (Git Workflow)
Tài liệu này quy định cách các thành viên trong dự án nộp code và tương tác với Github để đảm bảo code luôn sạch sẽ, không bị xung đột (conflict) và không làm sập hệ thống.

---

## 1️⃣ Luật Thép: Tuyệt đối không Push trực tiếp lên `main`
Nhánh `main` là nơi chứa code đã được kiểm tra và duyệt. Admin cần bật bảo vệ nhánh theo [CI và bảo vệ main](ci-guide.md) để bắt buộc PR và status check `CI`; file workflow không tự khóa nhánh trên GitHub.
Mọi tính năng mới, hoặc sửa lỗi đều phải được làm trên một nhánh riêng (Branch).

## 2️⃣ Quy Trình Code Tính Năng Mới (Mỗi ngày)

### Bước 1: Luôn cập nhật code mới nhất trước khi code
Mỗi sáng mở máy tính, hãy tải code mới nhất từ mạng về để tránh bị conflict với code của người khác làm hôm qua.
```bash
git checkout main
git pull origin main
```

### Bước 2: Tạo nhánh riêng cho công việc của bạn
Đặt tên nhánh rõ ràng: `feature/ten-tinh-nang` (Nếu làm tính năng) hoặc `fix/ten-loi` (Nếu sửa lỗi).
Ví dụ:
```bash
git checkout -b feature/login-page
```

### Bước 3: Code và Đóng gói (Commit)
Bạn cứ code bình thường trên VS Code. Sau khi làm xong và tự test thấy ổn, hãy commit lại:
```bash
git add .
git commit -m "feat: hoàn thành giao diện trang đăng nhập"
```

### Bước 4: Đẩy nhánh của bạn lên Github
```bash
git push origin feature/login-page
```

---

## 3️⃣ Quy Trình Ghép Code (Pull Request)

Sau khi đẩy code lên (Bước 4), code của bạn vẫn chỉ nằm ở nhánh phụ, chưa lọt vào `main`. Bạn phải nộp đơn xin gộp code.

1. Lên trang chủ Github của dự án.
2. Bấm nút màu xanh **"Compare & pull request"**.
3. Điền tiêu đề và mô tả ngắn gọn về những gì bạn vừa code.
4. Bấm **Create pull request**.

### Bot Tự Động Kiểm Tra (CI)
GitHub Actions chạy workflow `ci.yml` và tổng hợp kết quả vào check `CI`. Phạm vi kiểm tra frontend/backend hiện tại được ghi rõ trong [hướng dẫn CI](ci-guide.md).
- ❌ **Màu đỏ (Failed):** Code có lỗi. Nút Merge bị khóa. Bạn phải mở VS Code lên sửa lỗi, gõ `git add`, `git commit` và `git push` lại. Bot sẽ tự động test lại.
- ✅ **Màu xanh (Passed):** Các bước kiểm tra đã cấu hình đều thành công. Báo cho Leader vào duyệt code; CI không thay thế review và kiểm thử nghiệp vụ.

### Duyệt Code (Review & Merge)
Bất kỳ thành viên nào trong nhóm cũng có thể vào xem code của bạn. Nếu mọi thứ đúng chuẩn, Leader sẽ bấm nút **Merge pull request** để gộp code của bạn vào `main`.
Chúc mừng! Bạn đã hoàn thành xuất sắc một chu trình phát triển phần mềm chuẩn quốc tế.
