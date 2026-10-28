export const USER_ROLES = [
  "QUAN_TRI",
  "CAN_BO_DAO_TAO",
  "HOI_DONG",
  "GIANG_VIEN",
  "HOC_VIEN",
] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLE_CODES: Record<UserRole, string> = {
  QUAN_TRI: "ADMIN",
  CAN_BO_DAO_TAO: "TRAINING_OFFICER",
  HOI_DONG: "APPROVER",
  GIANG_VIEN: "LECTURER",
  HOC_VIEN: "STUDENT",
};
export const CATEGORY_TYPES = [
  "KHOA_QUAN_LY",
  "BAC_DAO_TAO",
  "KHOI_KIEN_THUC",
] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
export interface Actor {
  id: string;
  username: string;
  ip: string;
}
export interface ListQuery {
  searchTerm?: string;
  page: number;
  limit: number;
  selectedRole?: string;
  selectedType?: string;
  selectedAction?: string;
}
export interface PageResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface UserInput {
  hoTen: string;
  email: string;
  donViId: string;
  vaiTro: UserRole;
  trangThai: boolean;
}
export interface UserItem extends UserInput {
  id: string;
  username: string;
  donVi: string;
  accountStatus: string;
}
export interface CategoryInput {
  maDanhMuc: string;
  tenDanhMuc: string;
  loaiDanhMuc: CategoryType;
  moTa: string;
  trangThai: boolean;
}
export interface CategoryItem extends CategoryInput {
  id: string;
}
export const SETTING_DEFAULTS = {
  maxTinChiHocKy: "18",
  minTinChiTotNghiepThacSi: "60",
  minTinChiTotNghiepTienSi: "90",
  diemDatHocPhan: "5.5",
  thoiHanDangKyToiDa: "14",
  ngoaiNguBatBuocThacSi: "VSTEP B2 / IELTS 6.0",
  ngoaiNguBatBuocTienSi: "IELTS 6.5",
};
export type Settings = typeof SETTING_DEFAULTS;
export interface AuditItem {
  id: string;
  thoiGian: string;
  nguoiThucHien: string;
  vaiTro: string;
  hanhDong: string;
  moTa: string;
  diaChiIP: string;
}
export abstract class AdminRepository {
  abstract listUsers(query: ListQuery): Promise<PageResult<UserItem>>;
  abstract userOptions(): Promise<{ units: { id: string; name: string }[] }>;
  abstract createUser(
    input: UserInput,
    username: string,
    passwordHash: string,
    actor: Actor,
  ): Promise<UserItem>;
  abstract updateUser(
    id: string,
    input: UserInput,
    actor: Actor,
  ): Promise<UserItem>;
  abstract deleteUser(id: string, actor: Actor): Promise<void>;
  abstract listCategories(query: ListQuery): Promise<PageResult<CategoryItem>>;
  abstract saveCategory(
    id: string | null,
    input: CategoryInput,
    actor: Actor,
  ): Promise<CategoryItem>;
  abstract deleteCategory(id: string, actor: Actor): Promise<void>;
  abstract getSettings(): Promise<Settings>;
  abstract saveSettings(settings: Settings, actor: Actor): Promise<Settings>;
  abstract listAudit(
    query: ListQuery,
    all?: boolean,
  ): Promise<PageResult<AuditItem>>;
}
