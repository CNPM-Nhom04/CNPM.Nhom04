import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  TopicActor,
  TopicRepository,
  TopicQuery,
  TopicInput,
  TopicChange,
  SupervisorInput,
} from "../domain/thesis-topic";
const SCOPE =
  "EXISTS(SELECT 1 FROM vw_user_program_access pa WHERE pa.user_id=? AND pa.program_id=p.id) AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id)";
const UNIT_SCOPE =
  "EXISTS(SELECT 1 FROM user_scopes us WHERE us.user_id=? AND (us.scope_type='GLOBAL' OR (us.scope_type='ORG_UNIT' AND EXISTS(SELECT 1 FROM organizational_unit_closure oc WHERE oc.ancestor_id=us.organizational_unit_id AND oc.descendant_id=u.id))))";
const ASSIGN_FROM = ` FROM student_program_assignments a JOIN students s ON s.id=a.student_id
 JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id
 JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id
 JOIN majors m ON m.id=p.major_id JOIN organizational_units u ON u.id=p.managing_unit_id`;
const ELIGIBLE =
  " a.assignment_status='ACTIVE' AND s.status='ACTIVE' AND t.status='ACTIVE' AND p.status='ACTIVE' AND e.status='ACTIVE' AND u.status='ACTIVE' AND v.status IN ('PUBLISHED','ARCHIVED') AND EXISTS(SELECT 1 FROM thesis_defense_levels l WHERE l.education_level_id=e.id)";
const STUDENT_SELECT = `SELECT CAST(a.id AS CHAR) assignmentId,CAST(s.id AS CHAR) studentId,
 CAST(t.id AS CHAR) programVersionTrackId,CAST(p.managing_unit_id AS CHAR) unitId,
 s.student_code studentCode,s.full_name studentName,v.program_name_snapshot programName,
 p.program_code programCode,m.major_name majorName,u.unit_name unitName,e.level_name levelName`;
const TOPIC_FROM = ` FROM thesis_topics x JOIN student_program_assignments a ON a.id=x.assignment_id
 JOIN students s ON s.id=a.student_id JOIN program_version_tracks t ON t.id=a.program_version_track_id
 JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id
 JOIN education_levels e ON e.id=p.education_level_id JOIN majors m ON m.id=p.major_id
 JOIN organizational_units u ON u.id=p.managing_unit_id JOIN thesis_supervisors h ON h.id=x.supervisor_id`;
const SELECT =
  `SELECT CAST(x.id AS CHAR) id,CAST(a.id AS CHAR) assignmentId,CAST(s.id AS CHAR) studentId,
 CAST(x.supervisor_id AS CHAR) supervisorId,CAST(p.managing_unit_id AS CHAR) unitId,
 s.student_code studentCode,x.student_name_snapshot studentName,x.program_name_snapshot programName,
 m.major_name majorName,u.unit_name unitName,e.level_name levelName,x.title,x.description,x.status,x.revision,
 x.supervisor_name_snapshot supervisorName,h.supervisor_code supervisorCode,h.status supervisorStatus,
 CAST(x.created_by AS CHAR) createdBy,CAST(x.reviewed_by AS CHAR) reviewedBy,x.review_note reviewNote,x.decision_reference decisionReference,
 x.completion_reference completionReference,x.completion_note completionNote,x.cancellation_reason cancellationReason,
 x.created_at createdAt,x.reviewed_at reviewedAt,x.completed_at completedAt,x.cancelled_at cancelledAt` +
  TOPIC_FROM;
const SUPERVISOR_SELECT = `SELECT CAST(h.id AS CHAR) id,CAST(h.owning_unit_id AS CHAR) unitId,u.unit_name unitName,
 h.supervisor_code code,h.full_name fullName,h.institution,h.qualification,h.email,h.status
 FROM thesis_supervisors h JOIN organizational_units u ON u.id=h.owning_unit_id`;
function paged(data, total: number, q: TopicQuery) {
  return {
    data,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  };
}
@Injectable()
export class MysqlTopicRepository extends TopicRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private permissions(a: TopicActor, item?) {
    const can = (p: string) => a.permissions.includes(p);
    return {
      canManage: can("TOPIC_MANAGE"),
      canApprove: can("TOPIC_APPROVE") && (!item || item.createdBy !== a.id),
      canComplete: can("TOPIC_COMPLETE") && (!item || item.createdBy !== a.id),
    };
  }
  private map(row) {
    return {
      ...row,
      ...Object.fromEntries(
        ["createdAt", "reviewedAt", "completedAt", "cancelledAt"]
          .filter((k) => k in row)
          .map((k) => [
            k,
            row[k] instanceof Date ? row[k].toISOString() : (row[k] ?? null),
          ]),
      ),
    };
  }
  async list(q: TopicQuery, a: TopicActor) {
    const search = q.searchTerm || "",
      status = q.selectedStatus || "ALL";
    const where =
      " WHERE " +
      SCOPE +
      " AND (?='ALL' OR x.status=?) AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,x.student_name_snapshot)>0 OR LOCATE(?,x.title)>0 OR LOCATE(?,x.supervisor_name_snapshot)>0)";
    const args = [
      a.id,
      a.id,
      status,
      status,
      search,
      search,
      search,
      search,
      search,
    ];
    const rows = await this.db.query(
      SELECT + where + " ORDER BY x.id DESC LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + TOPIC_FROM + where,
      args,
    );
    return {
      ...paged(
        rows.map((row) => this.map(row)),
        Number(count.total),
        q,
      ),
      permissions: this.permissions(a),
    };
  }
  async students(q: TopicQuery, a: TopicActor) {
    const search = q.searchTerm || "";
    const where =
      " WHERE " +
      SCOPE +
      " AND " +
      ELIGIBLE +
      ` AND NOT EXISTS(SELECT 1 FROM thesis_topics x WHERE x.assignment_id=a.id AND x.status<>'DA_HUY')
   AND NOT EXISTS(SELECT 1 FROM thesis_defenses d WHERE d.assignment_id=a.id AND d.status IN ('CHO_BAO_VE','DA_DAT'))
   AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0)`;
    const args = [a.id, a.id, search, search, search];
    const rows = await this.db.query(
      STUDENT_SELECT +
        ASSIGN_FROM +
        where +
        " ORDER BY s.student_code LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + ASSIGN_FROM + where,
      args,
    );
    return paged(rows, Number(count.total), q);
  }
  async supervisors(q: TopicQuery, a: TopicActor) {
    const search = q.searchTerm || "",
      unit = q.unitId || "",
      status = q.status || "ALL";
    const where =
      " WHERE " +
      UNIT_SCOPE +
      " AND (?='' OR h.owning_unit_id=?) AND (?='ALL' OR h.status=?) AND (?='' OR LOCATE(?,h.full_name)>0 OR LOCATE(?,h.supervisor_code)>0)";
    const args = [a.id, unit, unit, status, status, search, search, search];
    const rows = await this.db.query(
      SUPERVISOR_SELECT + where + " ORDER BY h.full_name,h.id LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total FROM thesis_supervisors h JOIN organizational_units u ON u.id=h.owning_unit_id" +
        where,
      args,
    );
    return paged(rows, Number(count.total), q);
  }
  units(a: TopicActor) {
    return this.db.query(
      "SELECT CAST(u.id AS CHAR) id,u.unit_name name,u.status FROM organizational_units u WHERE " +
        UNIT_SCOPE +
        " ORDER BY u.unit_name",
      [a.id],
    );
  }
  private async get(m: EntityManager, id: string, a: TopicActor, lock = false) {
    const [row] = await m.query(
      SELECT + " WHERE x.id=? AND " + SCOPE + (lock ? " FOR UPDATE" : ""),
      [id, a.id, a.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy đề tài trong phạm vi được cấp.",
      );
    return this.map(row);
  }
  private async details(m: EntityManager, id: string, a: TopicActor) {
    const item = await this.get(m, id, a);
    const history = await m.query(
      "SELECT action,actor_username actorName,reason,created_at createdAt FROM audit_logs WHERE entity_type='thesis_topic' AND entity_id=? ORDER BY id",
      [id],
    );
    const defenses = await m.query(
      "SELECT CAST(id AS CHAR) id,status,average_score score,DATE_FORMAT(defense_date,'%Y-%m-%d') defenseDate FROM thesis_defenses WHERE topic_id=? ORDER BY id DESC",
      [id],
    );
    return {
      ...item,
      history: history.map((h) => this.map(h)),
      defenses: defenses.map((d) => ({
        ...d,
        score: d.score == null ? null : Number(d.score),
      })),
      permissions: this.permissions(a, item),
    };
  }
  detail(id: string, a: TopicActor) {
    return this.details(this.db.manager, id, a);
  }
  private async write<T>(
    a: TopicActor,
    permission: string,
    fn: (m: EntityManager) => Promise<T>,
  ) {
    try {
      return await this.db.transaction("READ COMMITTED", async (m) => {
        const [user] = await m.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
   AND 2=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN ('TOPIC_READ',?)) FOR UPDATE`,
          [a.id, permission],
        );
        if (!user)
          throw new ForbiddenException(
            "Tài khoản không còn quyền thao tác đề tài.",
          );
        return fn(m);
      });
    } catch (error) {
      if (
        [
          "ER_DUP_ENTRY",
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_SIGNAL_EXCEPTION",
        ].includes(error.driverError?.code || error.code)
      )
        throw new ConflictException(
          "Hồ sơ đã tồn tại hoặc vừa thay đổi. Hãy tải lại.",
        );
      throw error;
    }
  }
  private async audit(
    m: EntityManager,
    a: TopicActor,
    action: string,
    item,
    old,
    reason: string | null = null,
    entity = "thesis_topic",
  ) {
    await m.query(
      "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,scope_unit_id,old_value,new_value,reason,ip_address) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        a.id,
        a.username,
        action,
        entity,
        item.id,
        item.unitId,
        old ? JSON.stringify(old) : null,
        JSON.stringify(item),
        reason,
        a.ip || null,
      ],
    );
  }
  private async assignment(m: EntityManager, id: string, a: TopicActor) {
    const [row] = await m.query(
      STUDENT_SELECT +
        ASSIGN_FROM +
        " WHERE a.id=? AND " +
        SCOPE +
        " AND " +
        ELIGIBLE +
        " FOR UPDATE",
      [id, a.id, a.id],
    );
    if (!row)
      throw new NotFoundException(
        "Phân CTĐT của học viên không còn phù hợp hoặc ngoài phạm vi.",
      );
    return row;
  }
  private async supervisor(
    m: EntityManager,
    id: string,
    unitId: string,
    a: TopicActor,
  ) {
    const [row] = await m.query(
      SUPERVISOR_SELECT +
        " WHERE h.id=? AND h.owning_unit_id=? AND h.status='ACTIVE' AND u.status='ACTIVE' AND " +
        UNIT_SCOPE +
        " FOR UPDATE",
      [id, unitId, a.id],
    );
    if (!row)
      throw new NotFoundException(
        "GVHD không hoạt động hoặc không thuộc đơn vị quản lý CTĐT trong phạm vi.",
      );
    return row;
  }
  private async lockStudent(m: EntityManager, assignmentId: string) {
    await m.query(
      "SELECT s.id FROM students s JOIN student_program_assignments a ON a.student_id=s.id WHERE a.id=? FOR UPDATE",
      [assignmentId],
    );
  }
  create(input: TopicInput, a: TopicActor) {
    return this.write(a, "TOPIC_MANAGE", async (m) => {
      await this.lockStudent(m, input.assignmentId);
      const student = await this.assignment(m, input.assignmentId, a);
      const supervisor = await this.supervisor(
        m,
        input.supervisorId,
        student.unitId,
        a,
      );
      const [defense] = await m.query(
        "SELECT id FROM thesis_defenses WHERE assignment_id=? AND status IN ('CHO_BAO_VE','DA_DAT') LIMIT 1",
        [input.assignmentId],
      );
      if (defense)
        throw new ConflictException(
          "Học viên đã có lịch chờ hoặc đã đạt bảo vệ cho phân CTĐT này.",
        );
      await m.query(
        `INSERT INTO thesis_topics(assignment_id,supervisor_id,student_name_snapshot,program_name_snapshot,supervisor_name_snapshot,title,description,created_by)
    VALUES(?,?,?,?,?,?,?,?)`,
        [
          input.assignmentId,
          input.supervisorId,
          student.studentName,
          student.programName,
          supervisor.fullName,
          input.title,
          input.description || null,
          a.id,
        ],
      );
      const [{ id }] = await m.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) id",
      );
      const item = await this.get(m, id, a);
      await this.audit(m, a, "TOPIC_CREATE", item, null);
      return this.details(m, id, a);
    });
  }
  change(id: string, action: string, input: TopicChange, a: TopicActor) {
    const permission = {
      edit: "TOPIC_MANAGE",
      cancel: "TOPIC_MANAGE",
      approve: "TOPIC_APPROVE",
      reject: "TOPIC_APPROVE",
      complete: "TOPIC_COMPLETE",
    }[action];
    if (!permission) throw new ConflictException("Thao tác không hợp lệ.");
    return this.write(a, permission, async (m) => {
      const found = await this.get(m, id, a);
      await this.lockStudent(m, found.assignmentId);
      const old = await this.get(m, id, a, true);
      if (old.revision !== input.revision)
        throw new ConflictException("Đề tài vừa thay đổi. Hãy tải lại.");
      if (["HOAN_THANH", "DA_HUY"].includes(old.status))
        throw new ConflictException("Hồ sơ đã chốt, không thể sửa.");
      if (
        ["approve", "reject", "complete"].includes(action) &&
        old.createdBy === a.id
      )
        throw new ForbiddenException(
          "Không được tự phê duyệt/nghiệm thu đề tài do mình tạo.",
        );
      if (action === "edit") {
        if (!["CHO_DUYET", "TU_CHOI"].includes(old.status))
          throw new ConflictException(
            "Chỉ sửa và gửi lại đề tài chờ duyệt hoặc bị từ chối.",
          );
        const student = await this.assignment(m, old.assignmentId, a);
        const supervisor = await this.supervisor(
          m,
          input.supervisorId,
          student.unitId,
          a,
        );
        await m.query(
          `UPDATE thesis_topics SET supervisor_id=?,supervisor_name_snapshot=?,title=?,description=?,status='CHO_DUYET',
     reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,decision_reference=NULL,revision=revision+1 WHERE id=?`,
          [
            input.supervisorId,
            supervisor.fullName,
            input.title,
            input.description || null,
            id,
          ],
        );
      } else if (action === "approve" || action === "reject") {
        if (old.status !== "CHO_DUYET")
          throw new ConflictException("Chỉ xét duyệt đề tài đang chờ.");
        if (action === "approve") {
          await this.assignment(m, old.assignmentId, a);
          await this.supervisor(m, old.supervisorId, old.unitId, a);
        }
        await m.query(
          "UPDATE thesis_topics SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP(6),review_note=?,decision_reference=?,revision=revision+1 WHERE id=?",
          [
            action === "approve" ? "DANG_THUC_HIEN" : "TU_CHOI",
            a.id,
            input.note,
            input.reference || null,
            id,
          ],
        );
      } else if (action === "cancel") {
        const [defense] = await m.query(
          "SELECT id FROM thesis_defenses WHERE topic_id=? AND status IN ('CHO_BAO_VE','DA_DAT') LIMIT 1",
          [id],
        );
        if (defense)
          throw new ConflictException(
            "Đề tài đang có lịch chờ hoặc đã đạt bảo vệ; không được hủy.",
          );
        await m.query(
          "UPDATE thesis_topics SET status='DA_HUY',cancelled_by=?,cancelled_at=UTC_TIMESTAMP(6),cancellation_reason=?,revision=revision+1 WHERE id=?",
          [a.id, input.note, id],
        );
      } else {
        if (old.status !== "DANG_THUC_HIEN")
          throw new ConflictException("Chỉ nghiệm thu đề tài đã được duyệt.");
        const [passed] = await m.query(
          "SELECT id FROM thesis_defenses WHERE topic_id=? AND assignment_id=? AND status='DA_DAT' LIMIT 1",
          [id, old.assignmentId],
        );
        if (!passed)
          throw new ConflictException(
            "Chưa có kết quả bảo vệ đạt được liên kết với đề tài này.",
          );
        await m.query(
          "UPDATE thesis_topics SET status='HOAN_THANH',completed_by=?,completed_at=UTC_TIMESTAMP(6),completion_reference=?,completion_note=?,revision=revision+1 WHERE id=?",
          [a.id, input.reference, input.note, id],
        );
      }
      const item = await this.get(m, id, a);
      await this.audit(
        m,
        a,
        "TOPIC_" + action.toUpperCase(),
        item,
        old,
        input.note || null,
      );
      return this.details(m, id, a);
    });
  }
  createSupervisor(input: SupervisorInput, a: TopicActor) {
    return this.write(a, "TOPIC_MANAGE", async (m) => {
      const [unit] = await m.query(
        "SELECT u.id FROM organizational_units u WHERE u.id=? AND u.status='ACTIVE' AND " +
          UNIT_SCOPE +
          " FOR UPDATE",
        [input.unitId, a.id],
      );
      if (!unit)
        throw new ForbiddenException(
          "Đơn vị không hoạt động hoặc ngoài phạm vi.",
        );
      await m.query(
        "INSERT INTO thesis_supervisors(owning_unit_id,supervisor_code,full_name,institution,qualification,email,created_by) VALUES(?,?,?,?,?,?,?)",
        [
          input.unitId,
          input.code,
          input.fullName,
          input.institution || null,
          input.qualification || null,
          input.email || null,
          a.id,
        ],
      );
      const [{ id }] = await m.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) id",
      );
      const [item] = await m.query(SUPERVISOR_SELECT + " WHERE h.id=?", [id]);
      await this.audit(
        m,
        a,
        "SUPERVISOR_CREATE",
        item,
        null,
        null,
        "thesis_supervisor",
      );
      return item;
    });
  }
  supervisorStatus(
    id: string,
    status: string,
    expectedStatus: string,
    a: TopicActor,
  ) {
    return this.write(a, "TOPIC_MANAGE", async (m) => {
      const [old] = await m.query(
        SUPERVISOR_SELECT + " WHERE h.id=? AND " + UNIT_SCOPE + " FOR UPDATE",
        [id, a.id],
      );
      if (!old)
        throw new NotFoundException("Không tìm thấy GVHD trong phạm vi.");
      if (old.status !== expectedStatus || old.status === status)
        throw new ConflictException("Trạng thái vừa thay đổi. Hãy tải lại.");
      if (status === "ACTIVE") {
        const [unit] = await m.query(
          "SELECT status FROM organizational_units WHERE id=?",
          [old.unitId],
        );
        if (unit?.status !== "ACTIVE")
          throw new ConflictException("Đơn vị quản lý chưa hoạt động.");
      }
      await m.query("UPDATE thesis_supervisors SET status=? WHERE id=?", [
        status,
        id,
      ]);
      const item = { ...old, status };
      await this.audit(
        m,
        a,
        "SUPERVISOR_STATUS",
        item,
        old,
        null,
        "thesis_supervisor",
      );
      return item;
    });
  }
}
