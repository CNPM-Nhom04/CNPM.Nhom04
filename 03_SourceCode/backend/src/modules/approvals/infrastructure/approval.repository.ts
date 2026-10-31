import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  ApprovalDetail,
  ApprovalQuery,
  ApprovalRepository,
  ApprovalRow,
} from "../domain/approval";
const FROM = ` FROM approval_requests r JOIN program_versions v ON v.id=r.program_version_id
 JOIN training_programs p ON p.id=v.program_id JOIN organizational_units u ON u.id=p.managing_unit_id
 JOIN education_levels e ON e.id=p.education_level_id JOIN users requester ON requester.id=r.requested_by
 LEFT JOIN users reviewer ON reviewer.id=r.reviewing_by LEFT JOIN program_ui_details d ON d.program_version_id=v.id`;
const ACCESS = `EXISTS(SELECT 1 FROM vw_user_program_access access WHERE access.user_id=? AND access.program_id=p.id)`;
const SELECT =
  `SELECT CAST(r.id AS CHAR) id,CAST(v.id AS CHAR) versionId,r.request_no requestNo,r.current_status status,
 r.revision,COALESCE(d.revision,0) programRevision,p.program_code programCode,v.program_name_snapshot programName,
 v.version_code versionCode,v.status programStatus,u.unit_name unitName,e.level_name levelName,v.cohort_year cohortYear,
 CAST(r.requested_by AS CHAR) requesterId,requester.full_name requesterName,r.requested_at requestedAt,
 CAST(r.reviewing_by AS CHAR) reviewerId,reviewer.full_name reviewerName,r.review_started_at reviewStartedAt,
 r.completed_at completedAt,r.latest_comment latestComment,r.next_reminder_at nextReminderAt,
 r.last_reminded_at lastRemindedAt,r.reminder_count reminderCount` + FROM;
const date = (value: unknown) =>
  value instanceof Date ? value.toISOString() : (value ?? null);
function map(row): ApprovalRow {
  return {
    ...row,
    revision: Number(row.revision),
    programRevision: Number(row.programRevision),
    cohortYear: Number(row.cohortYear),
    reminderCount: Number(row.reminderCount),
    ...Object.fromEntries(
      [
        "requestedAt",
        "reviewStartedAt",
        "completedAt",
        "nextReminderAt",
        "lastRemindedAt",
      ].map((key) => [key, date(row[key])]),
    ),
  };
}
@Injectable()
export class MysqlApprovalRepository extends ApprovalRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  async list(query: ApprovalQuery, actorId: string) {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const search = query.searchTerm || "",
        version = query.versionId || "",
        status = query.status || "PENDING",
        state = query.reviewState || "ALL";
      const where = ` WHERE ${ACCESS} AND (?='' OR v.id=?) AND (?='' OR LOCATE(?,r.request_no)>0 OR LOCATE(?,p.program_code)>0 OR LOCATE(?,v.program_name_snapshot)>0 OR LOCATE(?,v.version_code)>0 OR LOCATE(?,requester.full_name)>0)`;
      const params = [
        actorId,
        version,
        version,
        search,
        search,
        search,
        search,
        search,
        search,
      ];
      const stateFilter = ` AND (?='ALL' OR (?='NOT_STARTED' AND r.current_status='PENDING' AND r.review_started_at IS NULL)
    OR (?='STARTED' AND r.current_status='PENDING' AND r.review_started_at IS NOT NULL)
    OR (?='MINE' AND r.current_status='PENDING' AND r.reviewing_by=?)) AND (?='ALL' OR r.current_status=?)`;
      const values = [
        ...params,
        state,
        state,
        state,
        state,
        actorId,
        status,
        status,
      ];
      const data = await manager.query(
        SELECT +
          where +
          stateFilter +
          " ORDER BY r.requested_at DESC,r.id DESC LIMIT ? OFFSET ?",
        [...values, query.limit, (query.page - 1) * query.limit],
      );
      const [count] = await manager.query(
        "SELECT COUNT(*) total" + FROM + where + stateFilter,
        values,
      );
      const summaryRows = await manager.query(
        "SELECT r.current_status status,COUNT(*) total" +
          FROM +
          where +
          " GROUP BY r.current_status",
        params,
      );
      const summary = { PENDING: 0, APPROVED: 0, RETURNED: 0, CANCELLED: 0 };
      for (const row of summaryRows) summary[row.status] = Number(row.total);
      const total = Number(count.total);
      return {
        data: data.map(map),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
        summary,
      };
    });
  }
  async detail(id: string, actorId: string): Promise<ApprovalDetail> {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const [row] = await manager.query(
        SELECT + ` WHERE r.id=? AND ${ACCESS}`,
        [id, actorId],
      );
      if (!row)
        throw new NotFoundException(
          "Không tìm thấy hồ sơ trong phạm vi được phân quyền.",
        );
      const actions = await manager.query(
        `SELECT CAST(a.id AS CHAR) id,a.action_type action,CAST(a.actor_id AS CHAR) actorId,
    u.full_name actorName,a.from_status fromStatus,a.to_status toStatus,a.comment_text comment,a.created_at createdAt
    FROM approval_actions a JOIN users u ON u.id=a.actor_id WHERE a.approval_request_id=? ORDER BY a.created_at,a.id`,
        [id],
      );
      const [minutes] = await manager.query(
        `SELECT council_name hoiDongThamDinh,chair_name chuTichHoidong,secretary_name thuKhao,
    DATE_FORMAT(meeting_date,'%Y-%m-%d') ngayHop,conclusion ketLuan,comments yKienDongGop,minutes_number soBienBan,
    CAST(recorded_by AS CHAR) recordedBy,created_at recordedAt FROM program_review_minutes WHERE approval_request_id=?`,
        [id],
      );
      const documents = await manager.query(
        `SELECT CAST(d.id AS CHAR) id,d.original_name name,d.file_size size,d.created_at uploadedAt,
    u.full_name uploaderName,CAST(d.approval_request_id AS CHAR) requestId FROM program_review_documents d
    JOIN users u ON u.id=d.uploaded_by WHERE d.approval_request_id=? OR(d.program_version_id=? AND d.approval_request_id IS NULL) ORDER BY d.id`,
        [id, row.versionId],
      );
      return {
        ...map(row),
        actions: actions.map((a) => ({ ...a, createdAt: date(a.createdAt) })),
        minutes: minutes
          ? { ...minutes, recordedAt: date(minutes.recordedAt) }
          : null,
        documents: documents.map((d) => ({
          ...d,
          size: Number(d.size),
          uploadedAt: date(d.uploadedAt),
        })),
      };
    });
  }
}
