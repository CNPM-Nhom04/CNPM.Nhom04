export interface ApprovalQuery {
  page: number;
  limit: number;
  searchTerm?: string;
  status?: "ALL" | "PENDING" | "APPROVED" | "RETURNED" | "CANCELLED";
  versionId?: string;
  reviewState?: "ALL" | "NOT_STARTED" | "STARTED" | "MINE";
}
export interface ApprovalRow {
  id: string;
  versionId: string;
  requestNo: string;
  status: string;
  revision: number;
  programCode: string;
  programName: string;
  versionCode: string;
  programStatus: string;
  unitName: string;
  levelName: string;
  cohortYear: number;
  programRevision: number;
  requesterId: string;
  requesterName: string;
  requestedAt: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewStartedAt: string | null;
  completedAt: string | null;
  latestComment: string | null;
  nextReminderAt: string | null;
  lastRemindedAt: string | null;
  reminderCount: number;
}
export interface ApprovalDetail extends ApprovalRow {
  actions: {
    id: string;
    action: string;
    actorId: string;
    actorName: string;
    fromStatus: string | null;
    toStatus: string;
    comment: string | null;
    createdAt: string;
  }[];
  minutes: {
    hoiDongThamDinh: string;
    chuTichHoidong: string;
    thuKhao: string;
    ngayHop: string;
    ketLuan: string;
    yKienDongGop: string;
    soBienBan: string;
    recordedBy: string;
    recordedAt: string;
  } | null;
  documents: {
    id: string;
    name: string;
    size: number;
    uploadedAt: string;
    uploaderName: string;
    requestId: string | null;
  }[];
}
export abstract class ApprovalRepository {
  abstract list(
    query: ApprovalQuery,
    actorId: string,
  ): Promise<{
    data: ApprovalRow[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    summary: Record<string, number>;
  }>;
  abstract detail(id: string, actorId: string): Promise<ApprovalDetail>;
}
