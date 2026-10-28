export type ProgramStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWING"
  | "RETURNED"
  | "PUBLISHED"
  | "ARCHIVED"
  | "RETIRED";
export interface ProgramPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
}
export interface ProgramInput {
  maCTDT: string;
  maPhienBan?: string;
  tenCTDT: string;
  tenTiengAnh: string;
  educationLevelId: string;
  managingUnitId: string;
  majorId: string;
  hinhThucDaoTao: string;
  thoiGianDaoTao: string;
  khoaTuyenSinh: string;
  tongTinChiYeuCau: number;
  chuanDauRaTiengAnh: string;
  chuanDauRaTinHoc: string;
  soQuyetDinhBanHanh: string;
  ngayBanHanh?: string;
  moTa: string;
  revision?: number;
}
export interface ProgramCourse {
  id: string;
  courseId: string;
  courseVersionId: string;
  code: string;
  name: string;
  credits: number;
  groupId: string;
  requirementType: "REQUIRED" | "ELECTIVE";
  semester: number | null;
  englishName?: string | null;
  theoryHours?: number;
  practiceHours?: number;
  description?: string | null;
  versionNumber?: number;
  notes?: string | null;
  prerequisites?: {
    id: string;
    courseEntryId: string;
    code: string;
    name: string;
    minimumGrade: string | null;
  }[];
  ploMappings?: {
    ploId: string;
    code: string;
    description: string;
    contributionLevel: string | null;
  }[];
}
export interface ProgramTrack {
  status?: string;
  id: string;
  code: string;
  name: string;
  requiredCredits: number;
  groups: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    minimumCredits: number;
    maximumCredits?: number | null;
  }[];
  courses: ProgramCourse[];
}
export interface ReviewInput {
  hoiDongThamDinh: string;
  chuTichHoidong: string;
  thuKhao: string;
  ngayHop: string;
  ketLuan: "DAT_DIEU_KIEN" | "YEU_CAU_SUA_DOI" | "KHONG_DAT";
  yKienDongGop: string;
  soBienBan: string;
}
export interface ProgramRecord extends ProgramInput {
  id: string;
  programId: string;
  status: ProgramStatus;
  statusLabel: string;
  levelName: string;
  unitName: string;
  majorName: string;
  updatedAt: string;
  revision: number;
  tracks: ProgramTrack[];
  documents: { id: string; name: string; size: number }[];
  review: ReviewInput | null;
  requestedBy: string | null;
  permissions: ProgramPermissions;
  cohortYear?: number;
  sourceVersionId?: string | null;
  sourceVersionCode?: string | null;
  hasExtendedInfo?: boolean;
  statusReason?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  retiredAt?: string | null;
  lockedAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  learningOutcomes?: {
    id: string;
    code: string;
    description: string;
    status: string;
    displayOrder: number;
  }[];
  approvalHistory?: {
    id: string;
    requestNo: string;
    status: string;
    requestedBy: string;
    requesterName: string;
    requestedAt: string | null;
    completedAt: string | null;
    latestComment: string | null;
    minutes: ReviewInput | null;
    actions: {
      id: string;
      action: string;
      actorName: string;
      comment: string | null;
      createdAt: string | null;
    }[];
  }[];
  rules: {
    minCredits: number | null;
    maxCredits: number | null;
    minElective: number | null;
    maxElective: number | null;
  };
}
export interface PageResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface ProgramOptions {
  levels: {
    id: string;
    name: string;
    code: string;
    minCredits: string | null;
    maxCredits: string | null;
  }[];
  units: { id: string; name: string }[];
  majors: { id: string; name: string; unitIds: string[] }[];
}
export interface CatalogCourse {
  id: string;
  courseId: string;
  code: string;
  name: string;
  credits: number;
  theoryHours: number;
  practiceHours: number;
}
export class ProgramApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function programRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/chuong-trinh-dao-tao" + path, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ProgramApiError(
      Array.isArray(body?.message)
        ? body.message.join("\n")
        : body?.message || "Không thể thực hiện yêu cầu.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export const programService = {
  detail: (id: string, signal?: AbortSignal) =>
    programRequest<ProgramRecord>("/" + id, { signal }),
  create: (input: ProgramInput) =>
    programRequest<ProgramRecord>("", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: ProgramInput) =>
    programRequest<ProgramRecord>("/" + id, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  structure: (program: ProgramRecord) =>
    programRequest<ProgramRecord>("/" + program.id + "/cau-truc", {
      method: "PUT",
      body: JSON.stringify({
        revision: program.revision,
        tracks: program.tracks
          .filter((track) => track.status !== "INACTIVE")
          .map((track) => ({
            id: track.id,
            groups: track.groups.map((group) => ({
              id: group.id,
              minimumCredits: group.minimumCredits,
            })),
            courses: track.courses.map((course) => ({
              courseVersionId: course.courseVersionId,
              groupId: course.groupId,
              requirementType: course.requirementType,
              semester: course.semester,
            })),
          })),
      }),
    }),
  validate: (id: string) =>
    programRequest<{ valid: boolean; issues: string[] }>(
      "/" + id + "/kiem-tra",
    ),
  submit: (program: ProgramRecord) =>
    programRequest<ProgramRecord>("/" + program.id + "/gui-duyet", {
      method: "POST",
      body: JSON.stringify({ revision: program.revision }),
    }),
  review: (program: ProgramRecord, review: ReviewInput) =>
    programRequest<ProgramRecord>("/" + program.id + "/xet-duyet", {
      method: "POST",
      body: JSON.stringify({ ...review, revision: program.revision }),
    }),
  upload: async (id: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return programRequest<{ id: string; name: string; size: number }>(
      "/" + id + "/tai-lieu",
      { method: "POST", body: data },
    );
  },
};
