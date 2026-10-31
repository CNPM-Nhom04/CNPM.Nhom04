export interface ComparisonOption {
  versionId: string;
  programCode: string;
  programName: string;
  versionCode: string;
  status: string;
  cohortYear: number;
  unitName: string;
  tracks: { id: string; code: string; name: string; status: string }[];
}
export interface ComparisonCourse {
  courseId: string;
  code: string;
  courseVersionId: string;
  versionNumber: number;
  name: string;
  englishName: string | null;
  credits: number;
  theoryHours: number;
  practiceHours: number;
  description: string | null;
  groupCode: string;
  requirementType: string;
  semester: number | null;
  notes: string | null;
  prerequisites: {
    courseId: string;
    code: string;
    minimumGrade: string | null;
  }[];
  ploMappings: {
    code: string;
    description: string;
    status: string;
    contributionLevel: string | null;
  }[];
}
export interface ComparisonGroup {
  code: string;
  name: string;
  parentCode: string | null;
  minimumCredits: number;
  maximumCredits: number | null;
}
export interface ComparisonOutcome {
  code: string;
  description: string;
  status: string;
}
export interface ComparisonSnapshot {
  versionId: string;
  programCode: string;
  programName: string;
  versionCode: string;
  status: string;
  cohortYear: number;
  unitName: string;
  levelName: string;
  majorName: string;
  studyForm: string | null;
  duration: string | null;
  cohortLabel: string | null;
  languageRequirement: string | null;
  itRequirement: string | null;
  versionRequiredCredits: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  trackId: string;
  trackCode: string;
  trackName: string;
  trackStatus: string;
  requiredCredits: number;
  groups: ComparisonGroup[];
  courses: ComparisonCourse[];
  outcomes: ComparisonOutcome[];
}
export type DifferenceStatus = "ONLY_A" | "ONLY_B" | "CHANGED" | "SAME";
export interface Difference<T> {
  key: string;
  a: T | null;
  b: T | null;
  status: DifferenceStatus;
  changedFields: string[];
}
export interface ComparisonResult {
  a: ComparisonSnapshot;
  b: ComparisonSnapshot;
  courses: Difference<ComparisonCourse>[];
  groups: Difference<ComparisonGroup>[];
  outcomes: Difference<ComparisonOutcome>[];
  summary: {
    onlyA: number;
    onlyB: number;
    changed: number;
    same: number;
    listedCreditsA: number;
    listedCreditsB: number;
  };
}
export interface ComparisonQuery {
  versionA: string;
  trackA: string;
  versionB: string;
  trackB: string;
}
async function request(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  const response = await fetch(
    "/api/so-sanh" + path + "?" + new URLSearchParams(params),
    { cache: "no-store", signal },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(
      Array.isArray(result?.message)
        ? result.message.join(", ")
        : result?.message || "Không thể tải dữ liệu.",
    );
  }
  return response;
}
export async function comparisonOptions(
  searchTerm: string,
  page: number,
  signal?: AbortSignal,
): Promise<{
  data: ComparisonOption[];
  meta: { total: number; page: number; totalPages: number };
}> {
  return (
    await request(
      "/options",
      { searchTerm, page: String(page), limit: "30" },
      signal,
    )
  ).json();
}
export async function comparePrograms(
  query: ComparisonQuery,
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  return (await request("", { ...query }, signal)).json();
}
export async function exportComparison(query: ComparisonQuery) {
  const response = await request("/export", { ...query });
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "so-sanh-ctdt.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
