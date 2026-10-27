export const DEFENSE_STATUSES = ["CHO_BAO_VE", "DA_DAT", "CHUA_DAT"] as const;
export type DefenseStatus = (typeof DEFENSE_STATUSES)[number];
export interface DefenseActor {
  id: string;
  username: string;
  isAdmin: boolean;
  canSchedule: boolean;
  canRecord: boolean;
  ip: string;
}
export interface DefenseQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  selectedStatus?: string;
}
export interface StudentOption {
  maHocVien: string;
  hoTen: string;
  chuyenNganh: string;
}
export interface CreateDefenseInput {
  maHocVien: string;
  tenDeTai: string;
  ngayBaoVe: string;
  diaDiem: string;
  chuTichHoidong: string;
  phanBien?: string;
  thuKy?: string;
}
export interface DefenseItem extends StudentOption {
  id: string;
  tenDeTai: string;
  ngayBaoVe: string;
  diaDiem: string;
  chuTichHoidong: string;
  phanBien: string;
  thuKy: string;
  diemTrungBinh: number | null;
  diemDat: number;
  trangThai: DefenseStatus;
  gradedAt: string | null;
}
export interface DefensePage<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export abstract class DefenseRepository {
  abstract list(
    query: DefenseQuery,
    actor: DefenseActor,
  ): Promise<DefensePage<DefenseItem>>;
  abstract students(
    query: DefenseQuery,
    actor: DefenseActor,
  ): Promise<DefensePage<StudentOption>>;
  abstract findById(id: string, actor: DefenseActor): Promise<DefenseItem>;
  abstract create(
    input: CreateDefenseInput,
    actor: DefenseActor,
  ): Promise<DefenseItem>;
  abstract recordResult(
    id: string,
    score: number,
    today: string,
    actor: DefenseActor,
  ): Promise<DefenseItem>;
}
