export const STATUS_LABELS = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ duyệt",
  REVIEWING: "Đang thẩm định",
  RETURNED: "Yêu cầu sửa",
  PUBLISHED: "Đã ban hành",
  ARCHIVED: "Đã lưu trữ",
  RETIRED: "Ngừng sử dụng",
};
export interface ProgramActor {
  canCreateProgram?: boolean;
  id: string;
  username: string;
  permissions: string[];
  ip: string;
}
export interface ProgramQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  selectedStatus?: string;
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
export interface CurriculumInput {
  revision: number;
  tracks: {
    id: string;
    groups: { id: string; minimumCredits: number }[];
    courses: {
      courseVersionId: string;
      groupId: string;
      requirementType: "REQUIRED" | "ELECTIVE";
      semester: number | null;
    }[];
  }[];
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
export interface DocumentInput {
  storageKey: string;
  name: string;
  mime: string;
  size: number;
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
  courses: {
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
  }[];
}
export interface ProgramItem extends ProgramInput {
  id: string;
  programId: string;
  status: string;
  statusLabel: string;
  levelName: string;
  unitName: string;
  majorName: string;
  updatedAt: string;
  tracks: ProgramTrack[];
  documents: { id: string; name: string; size: number }[];
  review: ReviewInput | null;
  requestedBy: string | null;
  revision: number;
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
export abstract class ProgramRepository {
  abstract list(
    query: ProgramQuery,
    actor: ProgramActor,
  ): Promise<{
    data: unknown[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>;
  abstract unversioned(
    query: ProgramQuery,
    actor: ProgramActor,
  ): Promise<unknown>;
  abstract baseProgram(id: string, actor: ProgramActor): Promise<ProgramInput>;
  abstract options(actor: ProgramActor): Promise<unknown>;
  abstract catalog(query: ProgramQuery, actor: ProgramActor): Promise<unknown>;
  abstract detail(id: string, actor: ProgramActor): Promise<ProgramItem>;
  abstract create(
    input: ProgramInput,
    actor: ProgramActor,
    existingProgramId?: string,
  ): Promise<ProgramItem>;
  abstract update(
    id: string,
    input: ProgramInput,
    actor: ProgramActor,
  ): Promise<ProgramItem>;
  abstract structure(
    id: string,
    input: CurriculumInput,
    actor: ProgramActor,
  ): Promise<ProgramItem>;
  abstract validate(id: string, actor: ProgramActor): Promise<string[]>;
  abstract submit(
    id: string,
    revision: number,
    actor: ProgramActor,
  ): Promise<ProgramItem>;
  abstract review(
    id: string,
    input: ReviewInput,
    revision: number,
    actor: ProgramActor,
  ): Promise<ProgramItem>;
  abstract addDocument(
    id: string,
    input: DocumentInput,
    actor: ProgramActor,
  ): Promise<{ id: string; name: string; size: number }>;
  abstract document(
    id: string,
    documentId: string,
    actor: ProgramActor,
  ): Promise<DocumentInput>;
}
