export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export type ResultStatus = "PASSED" | "FAILED" | "INCOMPLETE" | "EXEMPTED";
export type GradeState = "LEGACY" | "DRAFT" | "FINALIZED" | "VOIDED";
export interface Offering {
  id: string;
  classCode: string;
  status: string;
  courseVersionId: string;
  courseCode: string;
  courseName: string;
  courseVersionNo: number;
  unitId: string;
  unitName: string;
  academicYear: string;
  semester: string;
}
export interface Registration {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  offeringId: string;
  classCode: string;
  classStatus: string;
  courseId: string;
  courseVersionId: string;
  courseCode: string;
  courseName: string;
  courseVersionNo: number;
  unitName: string;
}
export interface GradePolicy {
  id: string;
  offeringId: string;
  attendanceWeight: number;
  midtermWeight: number;
  examWeight: number;
  passingScore: number;
  decimalPlaces: number;
  rounding: "HALF_UP" | "TRUNCATE";
  reference: string;
  revision: number;
}
export interface PolicyResponse {
  offering: Offering;
  policy: GradePolicy | null;
  configuredPassingScore: number | null;
  frozen: boolean;
  permissions: { canManage: boolean };
}
export interface GradeItem {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  courseId: string;
  courseVersionId: string;
  courseCode: string;
  courseName: string;
  courseVersionNo: number;
  unitId: string;
  unitName: string;
  offeringId: string | null;
  classCode: string | null;
  classStatus: string | null;
  academicYear: string | null;
  semester: string | null;
  resultStatus: ResultStatus;
  grade: string | null;
  revision: number;
  passedAt: string | null;
  passedDate: string | null;
  createdAt: string;
  registrationId: string | null;
  state: GradeState;
  attendanceScore: number | null;
  midtermScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  finalizedAt: string | null;
  policyId: string | null;
  attendanceWeight: number | null;
  midtermWeight: number | null;
  examWeight: number | null;
  passingScore: number | null;
  decimalPlaces: number | null;
  rounding: string | null;
  policyReference: string | null;
}
export interface GradeList extends Page<GradeItem> {
  permissions: { canManage: boolean };
}
export interface GradeDetail extends GradeItem {
  permissions: { canManage: boolean };
  history: {
    revision: number;
    action: string;
    actorName: string;
    note: string;
    reference: string;
    createdAt: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}
export interface Reason {
  note: string;
  reference: string;
}
export interface Scores {
  attendanceScore: number | null;
  midtermScore: number | null;
  examScore: number | null;
}
export interface LegacyInput extends Reason {
  revision: number;
  grade: string | null;
  resultStatus: ResultStatus;
  passedDate: string | null;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch("/api/quan-ly-diem" + path, {
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
const qs = (q: Record<string, string | number>) =>
  "?" +
  new URLSearchParams(
    Object.entries(q)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
export const gradeService = {
  list: (
    searchTerm: string,
    resultStatus: string,
    state: string,
    page: number,
    signal?: AbortSignal,
  ) =>
    request<GradeList>(
      qs({ searchTerm, resultStatus, state, page, limit: 20 }),
      { signal },
    ),
  classes: (searchTerm: string, page: number, signal?: AbortSignal) =>
    request<Page<Offering>>("/lop-hoc" + qs({ searchTerm, page, limit: 20 }), {
      signal,
    }),
  registrations: (searchTerm: string, page: number, signal?: AbortSignal) =>
    request<Page<Registration>>(
      "/dang-ky" + qs({ searchTerm, page, limit: 20 }),
      { signal },
    ),
  policy: (id: string, signal?: AbortSignal) =>
    request<PolicyResponse>("/lop-hoc/" + encodeURIComponent(id) + "/quy-tac", {
      signal,
    }),
  savePolicy: (id: string, b: Omit<GradePolicy, "id" | "offeringId">) =>
    post<PolicyResponse>("/lop-hoc/" + encodeURIComponent(id) + "/quy-tac", b),
  detail: (id: string) => request<GradeDetail>("/" + encodeURIComponent(id)),
  create: (b: Scores & Reason & { registrationId: string }) =>
    post<GradeDetail>("", b),
  update: (id: string, b: Scores & Reason & { revision: number }) =>
    post<GradeDetail>("/" + encodeURIComponent(id) + "/cap-nhat", b),
  action: (
    id: string,
    action: "chot" | "huy" | "mo-lai",
    b: Reason & { revision: number },
  ) => post<GradeDetail>("/" + encodeURIComponent(id) + "/" + action, b),
  legacy: (id: string, b: LegacyInput) =>
    post<GradeDetail>("/" + encodeURIComponent(id) + "/dieu-chinh", b),
};
