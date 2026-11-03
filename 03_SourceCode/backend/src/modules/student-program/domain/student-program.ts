export interface StudentProfile {
  id: string;
  studentCode: string;
  fullName: string;
  admissionYear: number;
  status: string;
  unitName: string | null;
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
  courses: {
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
  }[];
}
export interface OwnProgramResult {
  state: "UNLINKED" | "UNASSIGNED" | "UNAVAILABLE" | "READY";
  message: string;
  student: StudentProfile | null;
  curriculum: OwnCurriculum | null;
}
export abstract class StudentProgramRepository {
  abstract own(userId: string): Promise<OwnProgramResult>;
}
