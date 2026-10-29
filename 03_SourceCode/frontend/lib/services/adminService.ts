export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}
export type UserRole =
  "QUAN_TRI" | "CAN_BO_DAO_TAO" | "HOI_DONG" | "GIANG_VIEN" | "HOC_VIEN";
export interface AdminUser {
  id: string;
  username: string;
  hoTen: string;
  email: string;
  donViId: string;
  donVi: string;
  vaiTro: UserRole;
  trangThai: boolean;
  accountStatus: string;
  scopeSummary?: string;
}
export type CategoryType = "KHOA_QUAN_LY" | "BAC_DAO_TAO" | "KHOI_KIEN_THUC";
export interface MasterItem {
  id: string;
  maDanhMuc: string;
  tenDanhMuc: string;
  loaiDanhMuc: CategoryType;
  moTa: string;
  trangThai: boolean;
}
export interface AuditItem {
  id: string;
  thoiGian: string;
  nguoiThucHien: string;
  vaiTro: string;
  hanhDong: string;
  moTa: string;
  diaChiIP: string;
}
export interface AdminSettings {
  maxTinChiHocKy: string;
  minTinChiTotNghiepThacSi: string;
  minTinChiTotNghiepTienSi: string;
  diemDatHocPhan: string;
  thoiHanDangKyToiDa: string;
  ngoaiNguBatBuocThacSi: string;
  ngoaiNguBatBuocTienSi: string;
}
export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/admin/" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message)
      ? payload.message.join("; ")
      : payload?.message;
    throw new AdminApiError(
      message || "Không thể thực hiện yêu cầu.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export async function exportAudit(params: URLSearchParams) {
  const response = await fetch("/api/admin/audit-log/xuat-excel?" + params, {
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new AdminApiError(
      payload?.message || "Không thể xuất nhật ký.",
      response.status,
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "Nhat_Ky_He_Thong.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
 
