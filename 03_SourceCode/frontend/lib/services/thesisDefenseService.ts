export type DefenseStatus = "CHO_BAO_VE" | "DA_DAT" | "CHUA_DAT";
export interface StudentOption {
  maHocVien: string;
  hoTen: string;
  chuyenNganh: string;
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
export interface DefenseInput {
  maHocVien: string;
  tenDeTai: string;
  ngayBaoVe: string;
  diaDiem: string;
  chuTichHoidong: string;
  phanBien: string;
  thuKy: string;
}
export interface PageResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface DefenseList extends PageResult<DefenseItem> {
  permissions: { canSchedule: boolean; canRecord: boolean };
}
export class DefenseApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/bao-ve-luan-van" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new DefenseApiError(
      Array.isArray(body?.message)
        ? body.message.join("; ")
        : body?.message || "Không thể thực hiện yêu cầu.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export const thesisDefenseService = {
  list(
    searchTerm: string,
    selectedStatus: string,
    page: number,
    signal?: AbortSignal,
  ) {
    return request<DefenseList>(
      "?" +
        new URLSearchParams({
          searchTerm,
          selectedStatus,
          page: String(page),
          limit: "20",
        }),
      { signal },
    );
  },
  students(searchTerm: string, signal?: AbortSignal) {
    return request<PageResult<StudentOption>>(
      "/hoc-vien?" +
        new URLSearchParams({ searchTerm, page: "1", limit: "50" }),
      { signal },
    );
  },
  detail(id: string) {
    return request<DefenseItem>("/" + encodeURIComponent(id));
  },
  create(input: DefenseInput) {
    return request<DefenseItem>("", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  result(id: string, diemTrungBinh: number) {
    return request<DefenseItem>("/" + encodeURIComponent(id) + "/ket-qua", {
      method: "POST",
      body: JSON.stringify({ diemTrungBinh }),
    });
  },
};
