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
export abstract class ComparisonRepository {
  abstract options(
    actorId: string,
    query: { page: number; limit: number; searchTerm?: string },
  ): Promise<{
    data: ComparisonOption[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>;
  abstract snapshots(
    actorId: string,
    versionA: string,
    trackA: string,
    versionB: string,
    trackB: string,
  ): Promise<[ComparisonSnapshot, ComparisonSnapshot]>;
}
