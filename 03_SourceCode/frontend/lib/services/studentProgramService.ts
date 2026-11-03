export interface OwnStudent {
  id: string;
  studentCode: string;
  fullName: string;
  admissionYear: number;
  status: string;
  unitName: string | null;
}
export interface OwnCourse {
  id: string;
  courseVersionId: string;
  code: string;
  name: string;
  versionNo: number;
  credits: number;
  theoryHours: number;
  practiceHours: number;
  groupId: string;
  requirementType: string;
  semester: number | null;
  notes: string | null;
  prerequisites: {
    courseEntryId: string;
    code: string;
    name: string;
    versionNo: number;
    minimumGrade: string | null;
  }[];
}
export interface OwnCurriculum {
  assignmentId: string;
  assignedAt: string;
  versionId: string;
  versionCode: string;
  programCode: string;
  programName: string;
  versionStatus: string;
  cohortYear: number;
  levelName: string;
  majorName: string;
  unitName: string;
  trackId: string;
  trackCode: string;
  trackName: string;
  trackStatus: string;
  requiredCredits: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  decisionNumber: string | null;
  decisionDate: string | null;
  groups: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    minimumCredits: number;
    maximumCredits: number | null;
  }[];
  courses: OwnCourse[];
}
export interface OwnProgramResult {
  state: "UNLINKED" | "UNASSIGNED" | "UNAVAILABLE" | "READY";
  message: string;
  student: OwnStudent | null;
  curriculum: OwnCurriculum | null;
}
export class StudentProgramError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function getMyProgram(
  signal?: AbortSignal,
): Promise<OwnProgramResult> {
  const response = await fetch("/api/sinh-vien/chuong-trinh-dao-tao", {
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new StudentProgramError(
      Array.isArray(data?.message)
        ? data.message.join("; ")
        : data?.message || "Không thể tải CTĐT cá nhân.",
      response.status,
    );
  return data as OwnProgramResult;
}
