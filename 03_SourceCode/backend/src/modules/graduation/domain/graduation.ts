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
export abstract class GraduationRepository {
  abstract list(
    query: GraduationQuery,
    actor: GraduationActor,
  ): Promise<unknown>;
  abstract detail(id: string, actor: GraduationActor): Promise<unknown>;
  abstract options(actor: GraduationActor): Promise<unknown>;
  abstract policy(trackId: string, actor: GraduationActor): Promise<unknown>;
  abstract savePolicy(
    trackId: string,
    input: unknown,
    actor: GraduationActor,
  ): Promise<unknown>;
  abstract saveEvidence(
    id: string,
    input: unknown,
    actor: GraduationActor,
  ): Promise<unknown>;
  abstract check(id: string, actor: GraduationActor): Promise<unknown>;
  abstract batch(
    input: { educationLevelId: string; afterId?: string; limit: number },
    actor: GraduationActor,
  ): Promise<unknown>;
  abstract history(
    id: string,
    page: number,
    actor: GraduationActor,
  ): Promise<unknown>;
}
