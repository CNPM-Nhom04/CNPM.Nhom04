# API báo cáo

Module NestJS cho `frontend/app/dashboard/bao-cao/page.tsx`.
Tách domain (kiểu dữ liệu, repository interface), application (DTO, service),
infrastructure (MySQL repository) và presentation (controller).
Đã đăng ký trong AppModule. Dùng database MySQL hiện có từ `core/database/CSDL.sql`;
không tạo bảng mới hoặc thay đổi dữ liệu.

## Endpoint

Tất cả request cần `Authorization: Bearer <access_token>` từ API đăng nhập.
Các endpoint hiện dùng JwtAuthGuard giống module Identity; chưa áp dụng phân quyền
theo vai trò/phạm vi khoa. Cần bổ sung chính sách đó nếu triển khai giới hạn báo cáo theo người dùng.

| Method | URL                  | Kết quả                                 |
| ------ | -------------------- | --------------------------------------- |
| GET    | /bao-cao             | Bảng phân trang, metadata và summary    |
| GET    | /bao-cao/thong-ke    | 4 chỉ số thống kê                       |
| GET    | /bao-cao/bac-dao-tao | Các lựa chọn bậc đào tạo trong database |
| GET    | /bao-cao/xuat-excel  | File XLSX, tất cả dòng khớp bộ lọc      |

Bộ lọc dùng chung: `searchTerm` (tối đa 255 ký tự, tìm chuỗi con theo mã/tên,
không phân biệt hoa thường), `selectedDegree` (ALL hoặc mã/tên bậc trong database,
ví dụ MASTER hoặc Thạc sĩ). Bậc không tồn tại trả danh sách rỗng.
Không hardcode Tiến sĩ: bậc này sẽ xuất hiện khi có trong education_levels.

Danh sách nhận thêm `page` (mặc định 1, tối đa 1000000),
`limit` (mặc định 20, tối đa 100). Giá trị sai trả HTTP 400.
Xuất Excel nhận bộ lọc, bỏ qua phân trang.
Swagger hiện có tại `/api`.

Ví dụ: `GET /bao-cao?searchTerm=KHMT&selectedDegree=MASTER&page=1&limit=20`

```json
{
  "data": [
    {
      "id": "1",
      "maCTDT": "MS-KHMT-2026",
      "tenCTDT": "Thạc sĩ Khoa học Máy tính",
      "bacDaoTao": "Thạc sĩ",
      "khoaQuanLy": "Khoa Công nghệ Thông tin",
      "tongTinChi": 60,
      "soHocVien": 45,
      "trangThai": "Đã ban hành",
      "status": "PUBLISHED",
      "programVersionId": "2"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
  "summary": {
    "tongChuongTrinh": 1,
    "tongHocVien": 45,
    "tongHocPhan": 24,
    "tyLeHoanThanh": 100
  }
}
```

## Quy ước tính dữ liệu

- Một dòng cho mỗi training_programs, gồm cả CTĐT chưa có phiên bản.
- Phiên bản mới nhất theo cohort_year DESC, created_at DESC, id DESC.
  Tên lấy program_name_snapshot của phiên bản đó, nếu chưa có thì lấy program_name.
  Trạng thái lấy từ phiên bản và chuyển thành nhãn tiếng Việt.
- tongTinChi: MAX(required_total_credits) của các hướng ACTIVE trong phiên bản
  mới nhất. Các hướng là lựa chọn thay thế, không cộng tín chỉ giữa các hướng.
  Chưa có hướng/phiên bản trả 0.
- soHocVien: COUNT DISTINCT student_id có assignment_status ACTIVE vào CTĐT,
  trên tất cả phiên bản/hướng, kể cả khi phiên bản mới nhất còn đang soạn.
- tongChuongTrinh, tongHocVien: tính trên toàn bộ CTĐT khớp bộ lọc, không chỉ trang hiện tại.
- tongHocPhan: số courses ACTIVE trong ngân hàng toàn hệ thống, độc lập bộ lọc CTĐT.
- tyLeHoanThanh: tạm định nghĩa là 100 × số CTĐT có phiên bản mới nhất PUBLISHED /
  tổng CTĐT khớp bộ lọc; làm tròn 1 chữ số, không có dữ liệu trả 0.
  Đây là tỷ lệ ban hành CTĐT, không phải tỷ lệ học viên tốt nghiệp.
- ID BIGINT trả dạng string, DECIMAL/count trả number.

## Gọi từ frontend

```ts
const params = new URLSearchParams({
  searchTerm,
  selectedDegree,
  page: "1",
  limit: "20",
});
const response = await fetch(`${API_BASE_URL}/bao-cao?${params}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (!response.ok) throw new Error("Không thể tải báo cáo");
const { data, meta, summary } = await response.json();
// data thay MOCK_BAO_CAO_DATA; dùng meta cho phân trang.
// summary thay các số cố định trong 4 thẻ thống kê.
```

Xuất Excel: gọi `/bao-cao/xuat-excel` với cùng searchTerm và selectedDegree,
cùng Authorization; kiểm tra response.ok, lấy response.blob(), tạo object URL
và tải tên `Bao_Cao_Tong_Hop_CTDT_SDH.xlsx`. Sau khi tải gọi URL.revokeObjectURL.

Frontend đã tích hợp API qua các Route Handler Next.js và cookie JWT HttpOnly.
Trang /dang-nhap thực hiện đăng nhập; /dashboard/bao-cao dùng API để tải dữ liệu,
lọc, phân trang, thống kê, xuất Excel và tải đủ các trang trước khi in.
Xem frontend/README.md để cấu hình BACKEND_API_URL và cổng ứng dụng.
Luồng qua Next.js không cần bật CORS tại NestJS.
