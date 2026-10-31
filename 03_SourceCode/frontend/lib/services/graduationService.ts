export interface GraduationActor {
  id: string;
  username: string;
  permissions: string[];
  ip: string;
}
export interface GraduationPolicy {
  trackId: string;
  revision: number;
  requireGpa: boolean;
  minimumGpa: number | null;
  requireLanguage: boolean;
  languageRule: string | null;
  requireDefense: boolean;
  otherRequirements: string | null;
  reference: string;
  updatedBy: string;
  updatedAt: string;
}
export interface GraduationEvidence {
  assignmentId: string;
  revision: number;
  policyRevision: number;
  gpa: number | null;
  gpaReference: string | null;
  languageState: "UNKNOWN" | "MET" | "NOT_MET";
  languageReference: string | null;
  languageValidUntil: string | null;
  languageNoExpiry: boolean;
  otherState: "UNKNOWN" | "MET" | "NOT_MET";
  otherReference: string | null;
  verifiedBy: string;
  verifiedAt: string;
}
export interface GraduationGroup {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  minimum: number;
  maximum: number | null;
}
export interface GraduationCourse {
  id: string;
  courseId: string;
  courseVersionId: string;
  code: string;
  name: string;
  credits: number;
  groupId: string;
  required: boolean;
}
export interface GraduationInput {
  assignmentId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentStatus: string;
  assignmentStatus: string;
  trackId: string;
  trackCode: string;
  trackName: string;
  requiredCredits: number;
  versionId: string;
  versionCode: string;
  versionStatus: string;
  programId: string;
  programCode: string;
  programName: string;
  unitId: string;
  unitName: string;
  levelId: string;
  levelName: string;
  groups: GraduationGroup[];
  courses: GraduationCourse[];
  results: {
    id: string;
    courseId: string;
    courseVersionId: string;
    status: string;
    grade: string | null;
    passedAt: string | null;
  }[];
  defenses: {
    id: string;
    status: string;
    date: string;
    score: number | null;
  }[];
  policy: GraduationPolicy | null;
  evidence: GraduationEvidence | null;
}
export type GraduationStatus =
  "DU_DIEN_KIEN" | "CHUA_DU_DIEN_KIEN" | "THIEU_THONG_TIN";
export interface GraduationCriterion {
  code: string;
  label: string;
  state: "MET" | "NOT_MET" | "UNKNOWN" | "NOT_REQUIRED";
  message: string;
}
export interface GraduationEvaluation {
  status: GraduationStatus;
  earnedCredits: number;
  rawCredits: number;
  requiredCredits: number;
  officialGpa: number | null;
  criteria: GraduationCriterion[];
  courses: (GraduationCourse & {
    passed: boolean;
    otherVersionPassed: boolean;
  })[];
  groups: (GraduationGroup & { earned: number; raw: number })[];
}
export interface GraduationQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  educationLevelId?: string;
  status?: string;
  assignmentStatus?: string;
}
export interface GraduationPermissions {
  canCheck: boolean;
  canEvidence: boolean;
  canPolicy: boolean;
}
export interface GraduationDetail {
  input: GraduationInput;
  evaluation: GraduationEvaluation;
  fingerprint: string;
  checkedAt: string | null;
  changedSinceCheck: boolean;
  permissions: GraduationPermissions;
}
export interface GraduationRow extends Omit<
  GraduationInput,
  "groups" | "courses" | "results" | "defenses" | "policy" | "evidence"
> {
  status: GraduationStatus;
  earnedCredits: number;
  rawCredits: number;
  officialGpa: number | null;
  languageState: string;
  defenseState: string;
  missingInformation: number;
  checkedAt: string | null;
  changedSinceCheck: boolean;
}
export interface GraduationPage {
  data: GraduationRow[];
  summary: Record<GraduationStatus, number>;
  meta: { page: number; limit: number; total: number; totalPages: number };
  permissions: GraduationPermissions;
}
export interface GraduationOptions {
  levels: { id: string; name: string }[];
  tracks: {
    id: string;
    code: string;
    name: string;
    programCode: string;
    versionCode: string;
    unitName: string;
  }[];
  permissions: GraduationPermissions;
}
export interface PolicyResponse {
  track: {
    trackId: string;
    code: string;
    name: string;
    programCode: string;
    versionCode: string;
  };
  policy: GraduationPolicy | null;
  permissions: GraduationPermissions;
}
export interface GraduationHistory {
  data: {
    id: string;
    eventType: string;
    actorName: string;
    createdAt: string;
    data: unknown;
  }[];
  meta: { page: number; totalPages: number; total: number };
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/xet-tot-nghiep" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join("\n")
        : body?.message || "Không thể tải dữ liệu.",
    );
  }
  return response.json();
}
export const graduationService = {
  list: (params: Record<string, string>, signal?: AbortSignal) =>
    request<GraduationPage>("?" + new URLSearchParams(params), { signal }),
  options: () => request<GraduationOptions>("/options"),
  detail: (id: string, signal?: AbortSignal) =>
    request<GraduationDetail>("/" + id, { signal }),
  policy: (id: string, signal?: AbortSignal) =>
    request<PolicyResponse>("/quy-dinh/" + id, { signal }),
  savePolicy: (id: string, input: unknown) =>
    request<PolicyResponse>("/quy-dinh/" + id, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  evidence: (id: string, input: unknown) =>
    request<GraduationDetail>("/" + id + "/minh-chung", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  check: (id: string) =>
    request<GraduationDetail>("/" + id + "/kiem-tra", {
      method: "POST",
      body: "{}",
    }),
  batch: (input: {
    educationLevelId: string;
    afterId?: string;
    limit: number;
  }) =>
    request<{ checked: number; hasMore: boolean; nextAfterId: string | null }>(
      "/kiem-tra",
      { method: "POST", body: JSON.stringify(input) },
    ),
  history: (id: string, page: number) =>
    request<GraduationHistory>("/" + id + "/lich-su?page=" + page),
};
