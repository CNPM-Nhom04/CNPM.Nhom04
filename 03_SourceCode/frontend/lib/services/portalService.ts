export interface PublicOptions {
  levels: { id: string; code: string; name: string }[];
  majors: { id: string; code: string; name: string; unitName: string }[];
}
export interface PublicCatalogView {
  mode: "PUBLIC" | "FACULTY" | "ADMIN_ALL" | "UNASSIGNED";
  facultyId: string | null;
  facultyName: string | null;
}
export interface PublicPage<T> {
  view?: PublicCatalogView;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface PublicProgram {
  sourceUrl?: string | null;
  sourceDocumentUrl?: string | null;
  sourceTotalCredits?: number | null;
  sourceMajorCode?: string | null;
  id: string;
  code: string;
  versionCode: string;
  name: string;
  cohortYear: number;
  levelName: string;
  levelCode: string;
  levelId: string;
  majorName: string;
  unitName: string;
  studyForm: string | null;
  duration: string | null;
  description: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  decisionNumber: string | null;
  decisionDate: string | null;
}
export interface PublicProgramDetail extends PublicProgram {
  tracks: {
    id: string;
    code: string;
    name: string;
    credits: number;
    groups: {
      id: string;
      code: string;
      name: string;
      minimumCredits: string;
      maximumCredits: string | null;
    }[];
    courses: {
      id: string;
      code: string;
      name: string;
      versionNo: number;
      credits: string;
      theoryHours: number;
      practiceHours: number;
      groupCode: string;
      requirementType: string;
      semester: number | null;
      prerequisites: string | null;
    }[];
  }[];
}
export interface PublicDocument {
  id: string;
  title: string;
  category: string;
  summary: string;
  documentUrl: string;
  referenceNumber: string | null;
  issuedOn: string | null;
  status: string;
  revision: number;
}
export async function portalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/public/" + path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join("; ")
        : data?.message || "Chưa thể kết nối dịch vụ. Vui lòng thử lại.",
    );
  return data as T;
}
