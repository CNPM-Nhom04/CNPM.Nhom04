import { adminRequest, type PageResult } from "./adminService";
export interface MajorInput {
  majorCode: string;
  majorName: string;
  unitId: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface MajorItem extends MajorInput {
  id: string;
  unitCode: string;
  unitName: string;
  unitStatus: string;
  programCount: number;
  userScopeCount: number;
  registrationScopeCount: number;
  identityLocked: boolean;
  updatedAt: string;
}
export interface MajorUnit {
  id: string;
  code: string;
  name: string;
}
export const majorService = {
  list: (params: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<MajorItem>>("nganh-dao-tao?" + params, { signal }),
  options: (signal?: AbortSignal) =>
    adminRequest<{ units: MajorUnit[] }>("nganh-dao-tao/options", { signal }),
  save: (item: MajorItem | null, input: MajorInput) =>
    adminRequest<MajorItem>(
      item ? "nganh-dao-tao/" + item.id : "nganh-dao-tao",
      {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...input,
          ...(item ? { expectedUpdatedAt: item.updatedAt } : {}),
        }),
      },
    ),
  remove: (item: MajorItem) =>
    adminRequest<{ message: string }>(
      "nganh-dao-tao/" +
        item.id +
        "?" +
        new URLSearchParams({ expectedUpdatedAt: item.updatedAt }),
      { method: "DELETE" },
    ),
};

export interface MajorImportPreview {
  fileHash: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  canImport: boolean;
  rows: {
    rowNumber: number;
    majorCode: string;
    majorName: string;
    unitCode: string;
    unitName?: string;
    status: string;
    errors: string[];
  }[];
}
async function importResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(payload?.message)
        ? payload.message.join("\n")
        : payload?.message || "Không thể thực hiện nhập Excel.",
    );
  return payload as T;
}
export const majorImportService = {
  limits: () =>
    adminRequest<{ maxRows: number; maxFileBytes: number }>(
      "nganh-dao-tao/import/options",
    ),
  async template() {
    const response = await fetch("/api/admin/nganh-dao-tao/import/mau-excel", {
      cache: "no-store",
    });
    if (!response.ok) await importResponse<never>(response);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "Mau_Nganh_Dao_Tao.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async preview(file: File) {
    const data = new FormData();
    data.append("file", file);
    return importResponse<MajorImportPreview>(
      await fetch("/api/admin/nganh-dao-tao/import/kiem-tra", {
        method: "POST",
        body: data,
      }),
    );
  },
  async commit(file: File, previewHash: string) {
    const data = new FormData();
    data.append("file", file);
    data.append("previewHash", previewHash);
    return importResponse<{ created: number }>(
      await fetch("/api/admin/nganh-dao-tao/import/luu", {
        method: "POST",
        body: data,
      }),
    );
  },
};
