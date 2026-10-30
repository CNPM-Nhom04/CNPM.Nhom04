export interface CourseVersion {
  id: string;
  versionNo: number;
  courseName: string;
  englishName: string | null;
  credits: number;
  theoryHours: number;
  practiceHours: number;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  effectiveFrom: string;
  effectiveTo: string | null;
  usageCount: number;
}
export interface CourseItem {
  id: string;
  courseCode: string;
  status: "ACTIVE" | "INACTIVE" | "RETIRED";
  unitId: string;
  unitName: string;
  unitCode: string;
  latestVersionId: string | null;
  versionNo: number | null;
  courseName: string | null;
  englishName: string | null;
  credits: number | null;
  theoryHours: number | null;
  practiceHours: number | null;
  description: string | null;
  versionStatus: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  activeVersionId: string | null;
  activeVersionNo: number | null;
  activeCourseName: string | null;
  activeCredits: number | null;
}
export interface CourseDetail extends CourseItem {
  versions: CourseVersion[];
  permissions: { canManage: boolean };
  today: string;
}
export interface CourseList {
  data: CourseItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  permissions: { canManage: boolean };
}
export interface CourseUnit {
  id: string;
  code: string;
  name: string;
  status: string;
}
export interface CourseInput {
  courseName: string;
  englishName?: string;
  credits: number;
  theoryHours: number;
  practiceHours: number;
  description?: string;
  effectiveFrom: string;
  effectiveTo?: string;
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/danh-muc-hoc-phan" + path, {
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
        ? body.message.join("; ")
        : body?.message || "Không thể thực hiện yêu cầu.",
    );
  }
  return response.json() as Promise<T>;
}
const post = <T>(path: string, body: unknown = {}) =>
  request<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const courseService = {
  list(
    search: string,
    status: string,
    unitId: string,
    page: number,
    signal?: AbortSignal,
  ) {
    return request<CourseList>(
      "?" +
        new URLSearchParams({
          search,
          status,
          page: String(page),
          limit: "20",
          ...(unitId ? { unitId } : {}),
        }),
      { signal },
    );
  },
  units: (signal?: AbortSignal) => request<CourseUnit[]>("/don-vi", { signal }),
  detail: (id: string) => request<CourseDetail>("/" + encodeURIComponent(id)),
  create: (body: CourseInput & { courseCode: string; unitId: string }) =>
    post<CourseDetail>("", body),
  revise: (
    id: string,
    body: CourseInput & { expectedLatestVersionId: string },
  ) => post<CourseDetail>("/" + encodeURIComponent(id) + "/phien-ban", body),
  activate: (id: string, versionId: string) =>
    post<CourseDetail>(
      "/" +
        encodeURIComponent(id) +
        "/phien-ban/" +
        encodeURIComponent(versionId) +
        "/kich-hoat",
    ),
  status: (id: string, status: string, expectedStatus: string) =>
    post<CourseDetail>("/" + encodeURIComponent(id) + "/trang-thai", {
      status,
      expectedStatus,
    }),
};
