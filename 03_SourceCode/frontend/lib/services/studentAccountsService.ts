import { adminRequest, type PageResult } from "./adminService";
import { downloadExcel } from "./excelDownload";
export interface StudentClass {
  id: string;
  code: string;
  name: string;
  trackId: string;
  trackCode: string;
  trackName: string;
  versionCode: string;
  programName: string;
  unitId: string;
  unitName: string;
  admissionYear: number;
  status: string;
  revision: number;
  memberCount: number;
}
export interface LinkAccountOption {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  unitId: string | null;
  studentId: string | null;
  studentCode: string | null;
  studentName: string | null;
}
export interface LinkProfileOption {
  id: string;
  studentCode: string;
  fullName: string;
  admissionYear: number;
}
export interface LinkAccountInput {
  userId: string;
  studentId?: string;
  studentCode?: string;
  revision: number;
  reason: string;
  confirmed: boolean;
}
export interface ClassTrack {
  id: string;
  trackCode: string;
  trackName: string;
  versionCode: string;
  programName: string;
  versionStatus: string;
  cohortYear: number;
  unitId: string;
  unitName: string;
}
export interface AccountOptions {
  tracks: ClassTrack[];
  limits: { maxFileBytes: number; maxRows: number; passwordMinLength: number };
}
export interface ClassMember {
  studentId: string;
  studentCode: string;
  fullName: string;
  username: string | null;
  email: string | null;
  accountStatus: string | null;
  mustChangePassword: boolean;
  studentStatus: string;
  versionCode: string | null;
  trackName: string | null;
  assignmentMatchesClass: boolean;
}
export interface AccountPreview {
  class: StudentClass;
  previewHash: string;
  classRevision: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  canImport: boolean;
  rows: {
    rowNumber: number;
    studentCode: string;
    fullName: string;
    email: string;
    username: string;
    errors: string[];
    mode: "CREATE_PROFILE" | "LINK_PROFILE";
  }[];
}
async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join("\n")
        : data?.message || "Không thể nhập tài khoản học viên.",
    );
  return data as T;
}
export const studentAccountsService = {
  linkAccounts: (id: string, q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<LinkAccountOption>>(
      "lop-hoc-vien/" + id + "/lien-ket/tai-khoan?" + q,
      { signal },
    ),
  linkProfiles: (id: string, q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<LinkProfileOption>>(
      "lop-hoc-vien/" + id + "/lien-ket/ho-so?" + q,
      { signal },
    ),
  link: (id: string, body: LinkAccountInput) =>
    adminRequest<{ message: string; studentId: string }>(
      "lop-hoc-vien/" + id + "/lien-ket",
      { method: "POST", body: JSON.stringify(body) },
    ),
  options: (signal?: AbortSignal) =>
    adminRequest<AccountOptions>("lop-hoc-vien/options", { signal }),
  list: (q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<StudentClass>>("lop-hoc-vien?" + q, { signal }),
  create: (body: {
    code: string;
    name: string;
    trackId: string;
    admissionYear: number;
  }) =>
    adminRequest<StudentClass>("lop-hoc-vien", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (item: StudentClass, body: { name: string; status: string }) =>
    adminRequest<StudentClass>("lop-hoc-vien/" + item.id, {
      method: "PUT",
      body: JSON.stringify({ ...body, revision: item.revision }),
    }),
  remove: (item: StudentClass) =>
    adminRequest<{ message: string }>(
      "lop-hoc-vien/" + item.id + "?revision=" + item.revision,
      { method: "DELETE" },
    ),
  members: (id: string, q: URLSearchParams, signal?: AbortSignal) =>
    adminRequest<PageResult<ClassMember> & { class: StudentClass }>(
      "lop-hoc-vien/" + id + "/hoc-vien?" + q,
      { signal },
    ),
  template: (item: StudentClass) =>
    downloadExcel(
      "/api/admin/lop-hoc-vien/" + item.id + "/import/mau-excel",
      "Mau_Hoc_Vien_" + item.code + ".xlsx",
    ),
  async preview(item: StudentClass, file: File) {
    const form = new FormData();
    form.append("file", file);
    return parse<AccountPreview>(
      await fetch("/api/admin/lop-hoc-vien/" + item.id + "/import/kiem-tra", {
        method: "POST",
        body: form,
      }),
    );
  },
  async commit(item: StudentClass, file: File, preview: AccountPreview) {
    const form = new FormData();
    form.append("file", file);
    form.append("previewHash", preview.previewHash);
    form.append("classRevision", String(preview.classRevision));
    const response = await fetch(
      "/api/admin/lop-hoc-vien/" + item.id + "/import/luu",
      { method: "POST", body: form },
    );
    if (!response.ok) await parse<never>(response);
    const created = Number(response.headers.get("X-Imported-Count"));
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = "Ban_Giao_Tai_Khoan_" + item.code + ".xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { created };
  },
};
