import type { ProgramRecord, ReviewInput } from "./programService";
export interface ApprovalQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  status?: "ALL" | "PENDING" | "APPROVED" | "RETURNED" | "CANCELLED";
  versionId?: string;
  reviewState?: "ALL" | "NOT_STARTED" | "STARTED" | "MINE";
}
export interface ApprovalRow {
  id: string;
  versionId: string;
  requestNo: string;
  status: string;
  revision: number;
  programCode: string;
  programName: string;
  versionCode: string;
  programStatus: string;
  unitName: string;
  levelName: string;
  cohortYear: number;
  programRevision: number;
  requesterId: string;
  requesterName: string;
  requestedAt: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewStartedAt: string | null;
  completedAt: string | null;
  latestComment: string | null;
  nextReminderAt: string | null;
  lastRemindedAt: string | null;
  reminderCount: number;
}
export interface ApprovalData extends ApprovalRow {
  actions: {
    id: string;
    action: string;
    actorId: string;
    actorName: string;
    fromStatus: string | null;
    toStatus: string;
    comment: string | null;
    createdAt: string;
  }[];
  minutes: {
    hoiDongThamDinh: string;
    chuTichHoidong: string;
    thuKhao: string;
    ngayHop: string;
    ketLuan: string;
    yKienDongGop: string;
    soBienBan: string;
    recordedBy: string;
    recordedAt: string;
  } | null;
  documents: {
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
    uploaderName: string;
    requestId: string | null;
  }[];
}
export interface ApprovalDetail extends ApprovalData {
  program: Omit<ProgramRecord, "permissions">;
  permissions: { canStart: boolean; canDecide: boolean; canUpload: boolean };
}
export interface ApprovalListResult {
  data: ApprovalRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: Record<string, number>;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/xet-duyet" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(
      Array.isArray(result?.message)
        ? result.message.join("\n")
        : result?.message || "Không thể thực hiện yêu cầu.",
    );
  }
  return response.json();
}
export const approvalService = {
  list: (params: Record<string, string>, signal?: AbortSignal) =>
    request<ApprovalListResult>("?" + new URLSearchParams(params), { signal }),
  detail: (id: string, signal?: AbortSignal) =>
    request<ApprovalDetail>("/" + id, { signal }),
  start: (item: ApprovalDetail) =>
    request<ApprovalDetail>("/" + item.id + "/bat-dau", {
      method: "POST",
      body: JSON.stringify({ requestRevision: item.revision }),
    }),
  decide: (item: ApprovalDetail, input: ReviewInput) =>
    request<ApprovalDetail>("/" + item.id + "/ket-luan", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        revision: item.program.revision,
        requestRevision: item.revision,
      }),
    }),
  upload: (id: string, file: File) => {
    const body = new FormData();
    body.set("file", file);
    return request<{ id: string; name: string; size: number }>(
      "/" + id + "/tai-lieu",
      { method: "POST", body },
    );
  },
};
