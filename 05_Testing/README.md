# Kiểm thử và quality gate

Frontend, tại `03_SourceCode/frontend`:

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
```

Backend, tại `03_SourceCode/backend`:

```bash
npm ci
npm run lint
npm run test:cov -- --runInBand
npm run build
npm audit --audit-level=high
```

CI chạy thêm MariaDB 11.8 riêng, tạo schema/reference bằng `db:bootstrap`, chạy 17 migrations rồi gọi `npm run test:qa-integration` với frontend/backend thật. Bộ này kiểm tra Origin hợp lệ/trái phép, đăng nhập, upload Excel multipart, validation, tạo CTĐT mới (hồi quy BUG-001), tạo trùng, cách ly phạm vi và danh sách nguồn công khai. Không dùng SQL riêng hoặc tài khoản thật trong CI.

Muốn chạy integration local: dùng database tên `ctdt_ci` hoặc `ctdt_qa_*` riêng; cấu hình DB_* cho cả backend và script, `DATABASE_URL` frontend cùng DB, `FRONTEND_URL` và `APP_ORIGIN` là URL trình duyệt test, `BACKEND_API_URL` là backend test, và `QA_TEST_ALLOW_WRITES=1`. Chạy hai server rồi `npm run test:qa-integration`. Script cố ý từ chối database đào tạo thật. Các fixture/audit được giữ trong DB dùng một lần để điều tra; không tự xóa lịch sử bất biến. Xóa môi trường test sau khi lưu evidence cần thiết.

Workflow upload coverage và log/kết quả integration. Gate bảo mật chặn Critical/High trên cả cây dependency; Moderate/Low vẫn được báo và phải theo dõi, không được gọi là audit sạch hoàn toàn. CI tổng yêu cầu frontend, backend, security và integration đều thành công. Branch protection/required checks phải được quản trị viên GitHub cấu hình riêng; file workflow không tự bật chính sách đó.

[Đối chiếu 7 lỗi QA](QA_REGRESSION_2026-11-09.md). Các bộ integration/browser khác trong backend/test là hồi quy nghiệp vụ bổ sung; đọc điều kiện và dùng DB riêng trước khi chạy.
