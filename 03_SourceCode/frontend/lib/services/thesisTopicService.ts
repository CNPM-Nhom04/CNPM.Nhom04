export type TopicStatus =
  "CHO_DUYET" | "DANG_THUC_HIEN" | "TU_CHOI" | "HOAN_THANH" | "DA_HUY";
export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface StudentOption {
  assignmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  programName: string;
  programCode: string;
  unitId: string;
  unitName: string;
  majorName: string;
  levelName: string;
}
export interface Supervisor {
  id: string;
  unitId: string;
  unitName: string;
  code: string;
  fullName: string;
  institution: string | null;
  qualification: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
}
export interface Topic {
  id: string;
  assignmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  programName: string;
  majorName: string;
  levelName: string;
  unitId: string;
  unitName: string;
  supervisorId: string;
  supervisorName: string;
  supervisorCode: string;
  supervisorStatus: string;
  title: string;
  description: string | null;
  status: TopicStatus;
  revision: number;
  createdBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  decisionReference: string | null;
  completionReference: string | null;
  completionNote: string | null;
  cancellationReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}
export interface TopicPermissions {
  canManage: boolean;
  canApprove: boolean;
  canComplete: boolean;
}
export interface TopicDetail extends Topic {
  permissions: TopicPermissions;
  history: {
    action: string;
    actorName: string;
    reason: string | null;
    createdAt: string;
  }[];
  defenses: {
    id: string;
    status: string;
    score: number | null;
    defenseDate: string;
  }[];
}
export interface TopicList extends Page<Topic> {
  permissions: TopicPermissions;
}
export interface TopicInput {
  assignmentId: string;
  supervisorId: string;
  title: string;
  description?: string;
}
export interface SupervisorInput {
  unitId: string;
  code: string;
  fullName: string;
  institution?: string;
  qualification?: string;
  email?: string;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch("/api/de-tai-luan-van" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(
      Array.isArray(b?.message)
        ? b.message.join("; ")
        : b?.message || "Không thể thực hiện yêu cầu.",
    );
  }
  return r.json() as Promise<T>;
}
const query = (values: Record<string, string | number>) =>
  "?" +
  new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const thesisTopicService = {
  list: (
    searchTerm: string,
    selectedStatus: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    request<TopicList>(query({ searchTerm, selectedStatus, page, limit: 20 }), {
      signal,
    }),
  students: (searchTerm: string, page: number, signal?: AbortSignal) =>
    request<Page<StudentOption>>(
      "/hoc-vien" + query({ searchTerm, page, limit: 20 }),
      { signal },
    ),
  supervisors: (
    searchTerm: string,
    status: string,
    unitId: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    request<Page<Supervisor>>(
      "/giang-vien" + query({ searchTerm, status, unitId, page, limit: 20 }),
      { signal },
    ),
  units: (signal?: AbortSignal) =>
    request<{ id: string; name: string; status: string }[]>("/don-vi", {
      signal,
    }),
  detail: (id: string) => request<TopicDetail>("/" + encodeURIComponent(id)),
  create: (input: TopicInput) => post<TopicDetail>("", input),
  edit: (
    id: string,
    input: Omit<TopicInput, "assignmentId"> & { revision: number },
  ) => post<TopicDetail>("/" + encodeURIComponent(id) + "/cap-nhat", input),
  action: (
    id: string,
    action: "duyet" | "tu-choi" | "huy" | "nghiem-thu",
    input: { revision: number; note: string; reference?: string },
  ) => post<TopicDetail>("/" + encodeURIComponent(id) + "/" + action, input),
  createSupervisor: (input: SupervisorInput) =>
    post<Supervisor>("/giang-vien", input),
  supervisorStatus: (item: Supervisor) =>
    post<Supervisor>(
      "/giang-vien/" + encodeURIComponent(item.id) + "/trang-thai",
      {
        expectedStatus: item.status,
        status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      },
    ),
};
