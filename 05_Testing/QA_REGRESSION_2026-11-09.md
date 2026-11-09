# Đối chiếu danh sách lỗi QA — 09/11/2026

Nguồn đầu vào: PDF “Danh sách lỗi cần sửa.pdf” do nhóm QA bàn giao, 3 trang, 7 mục. Một số mục mô tả nghi vấn/giới hạn kiểm chứng, không phải bằng chứng khai thác hay yêu cầu vô hiệu hóa kiểm tra quyền. Bản sửa giữ nguyên dữ liệu đào tạo thật và không áp dụng migration mới lên DB người dùng.

| Mục | Thay đổi | Kiểm chứng / giới hạn |
|---|---|---|
| BUG-001 | Tách ACCESS_SCOPE (thuộc tính ngành/đơn vị) khỏi điều kiện SCOPE có deleted_at; tạo CTĐT mới không tham chiếu deleted_at trên bảng suy dẫn. Các truy vấn bản ghi đã tồn tại vẫn loại bản đã xóa. | Unit hồi quy; HTTP thật tạo mới 201, trùng mã 409, tạo ngoài đơn vị 403 và đọc chéo 404 trên MariaDB riêng. |
| BUG-002 | Next.js và eslint-config-next đồng bộ 16.4.5; cập nhật dependency có bản vá trong khoảng tương thích. | Frontend build/typecheck/lint/tests đạt; audit 0 Critical, 0 High. Còn 8 gói Moderate trong nhánh TypeScript ESLint/minimatch, không gọi là audit sạch hoàn toàn. |
| BUG-003 | Nest common/core/platform-express/testing 11.2.8; config 4.0.4 CommonJS, Swagger/JWT/Passport/TypeORM adapter và tooling tương thích; override Multer ^2.5.0 cùng major để vá upload. Không chạy audit fix --force hoặc hạ Next/Jest theo gợi ý không tương thích. | Backend build/lint và 456 tests đạt; upload Excel HTTP thật đạt. Audit từ 42 gói (17 High) xuống 19 (0 Critical, 0 High; 11 Moderate, 8 Low). Các nhánh glob/minimatch/uuid/deepmerge và tooling còn lại cần tiếp tục theo dõi, gồm cả dependency runtime; chưa khẳng định chúng không có rủi ro. |
| BUG-004 | Dùng hàm kiểm tra Origin thống nhất cho 13 API proxy. APP_ORIGIN/TRUSTED_ORIGINS là danh sách chính xác khi có proxy; local hỗ trợ đúng Host/port loopback khi Next chuẩn hóa hostname. Không tin forwarded host/protocol do người gọi tự cung cấp. | Unit: loopback, khác port, proxy, missing/null/giả mạo Origin. HTTP standalone với URL nội bộ HTTP và Origin công khai HTTPS: body rỗng hợp lệ trả 400, Origin lạ/thiếu trả 403, login và API có quyền thành công. |
| BUG-005 | Viết Dockerfile nhiều stage backend/frontend, Compose dev/staging/prod có DB healthcheck, init migration, mạng nội bộ và volume DB/tài liệu. Bootstrap chỉ schema rỗng, không nhập MIT mẫu và không ghi đè database đã có. | Cả 3 Compose config hợp lệ; image tag Node/MariaDB tồn tại; bootstrap + 17 migrations, init chạy lại không ghi đè, production CLI migration và Next standalone được chạy thật ngoài container. **Chưa build/up container: Docker Engine chưa được tích hợp trong WSL của môi trường này.** |
| BUG-006 | CI thêm frontend tests, backend coverage, audit cả hai cây dependency với ngưỡng High, job MariaDB riêng và test HTTP tích hợp. Upload coverage và integration logs/results. CI tổng yêu cầu cả 4 job. | Workflow parse hợp lệ; các lệnh unit/build/test/audit và integration tương ứng được kiểm tra local. **Chưa có kết quả GitHub Actions của commit này; chưa thay đổi branch protection/required checks trên GitHub.** |
| BUG-007 | Bổ sung các nhóm 01_Requirements, 02_Design, 05_Testing, 06_Documentation với nội dung/chỉ mục liên kết đúng code, hạ tầng, tài liệu và testing hiện có. Cập nhật README và hướng dẫn cũ còn nhắc MIT/8 migrations/Docker trống. | Không di chuyển source hoặc dữ liệu nguồn AGU để tránh hỏng đường dẫn. PDF không kèm SRS/quy định bố cục gốc nên nội dung yêu cầu là tổng hợp chức năng hiện có, không giả lập tài liệu phê duyệt. |

## Kết quả chạy

- Backend: 60 suites / 456 tests qua; coverage được thu thập: statements 43.14%, branches 38.02%, functions 31.42%, lines 42.42%. Coverage còn khoảng trống, không phải mọi nghiệp vụ đã được bao phủ.
- Frontend: hai file test selection/origin qua; lint/typecheck qua; production build Webpack qua.
- Integration: 16 kiểm tra HTTP qua backend production + Next standalone trên MariaDB 11.8.6 tạm, port DB 33317, backend 43102, frontend 43100. Không dùng DB ctdt_management của người dùng.
- Init: tạo schema tham chiếu và admin yêu cầu đổi mật khẩu, chạy đủ 17 migrations; gọi --if-empty với schema đã có thì bỏ qua; migration production báo không có migration còn thiếu.
- Compose: dev/staging/prod parse và kiểm tra các đường dẫn build, service frontend→backend và port nội bộ đạt. Chưa chạy container thật như ghi ở bảng.
- Security: gate Critical/High đạt trên cả frontend/backend; Moderate/Low còn tồn tại, không ẩn kết quả bằng audit-level=critical hay loại devDependencies khỏi kiểm tra.

## QA kiểm tra lại

1. Cài lại dependency bằng npm ci trong backend và frontend; generate lại Prisma client. Node theo .nvmrc.
2. Tạo CTĐT hoàn toàn mới bằng cán bộ có phạm vi đơn vị; mong đợi bản nháp có hai hướng A–D, không lỗi p.deleted_at. Thử ngoài phạm vi phải bị từ chối.
3. Chạy npm audit --audit-level=high cho cả hai thư mục; đối chiếu số lượng mới theo advisory tại thời điểm chạy, không dùng số đếm cũ làm chuẩn cứng.
4. Nếu có reverse proxy, đặt APP_ORIGIN đúng URL HTTPS công khai trong môi trường frontend. Thử login hợp lệ, thiếu dữ liệu 400 và Origin ngoài danh sách 403. Không thêm mọi domain để né lỗi.
5. Trên máy có Docker Engine: chạy Compose config rồi build/up dev; test admin lần đầu, restart giữ dữ liệu/volume. Kiểm tra staging/prod sau reverse proxy HTTPS trong môi trường riêng.
6. Push nhánh/PR để GitHub chạy đủ Frontend, Backend, Dependency security, MariaDB integration và CI tổng; quản trị viên repo cấu hình required checks nếu cần.

Advisory chính thức đối chiếu: [Next.js security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r). Phiên bản trong lockfile thuộc dải advisory là kết luận dependency; không tự suy ra hệ thống đã bị khai thác.
