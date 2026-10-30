import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  CreateDefenseInput,
  DefenseActor,
  DefenseItem,
  DefensePage,
  DefenseQuery,
  DefenseRepository,
  StudentOption,
} from "../domain/thesis-defense";

// Both scopes are required: program access is not a blanket grant to student identities.
const SCOPE = `EXISTS(SELECT 1 FROM vw_user_program_access pa WHERE pa.user_id=? AND pa.program_id=p.id)
 AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id)`;
const DEFENSE_FROM = ` FROM thesis_defenses d JOIN students s ON s.id=d.student_id
 JOIN program_version_tracks t ON t.id=d.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id
 JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id
 JOIN organizational_units u ON u.id=p.managing_unit_id JOIN majors m ON m.id=p.major_id`;
const DEFENSE_SELECT =
  `SELECT CAST(d.id AS CHAR) id,CAST(d.topic_id AS CHAR) topicId,CAST(d.assignment_id AS CHAR) assignmentId,
 CAST(d.program_version_track_id AS CHAR) programVersionTrackId,s.student_code maHocVien,
 d.student_name_snapshot hoTen,d.program_name_snapshot chuyenNganh,p.program_code programCode,
 e.level_name levelName,u.unit_name unitName,m.major_name majorName,
 d.thesis_title tenDeTai,DATE_FORMAT(d.defense_date,'%Y-%m-%d') ngayBaoVe,
 d.location diaDiem,d.council_chair chuTichHoidong,d.reviewer phanBien,d.secretary thuKy,
 d.average_score diemTrungBinh,d.passing_score diemDat,d.status trangThai,d.graded_at gradedAt,
 d.eligibility_note eligibilityNote,d.created_at createdAt,d.cancelled_at cancelledAt,d.cancellation_reason cancellationReason` +
  DEFENSE_FROM;
const STUDENT_FROM = ` FROM students s JOIN student_program_assignments a ON a.student_id=s.id AND a.assignment_status='ACTIVE'
 JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id
 JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id
 JOIN thesis_defense_levels eligible ON eligible.education_level_id=e.id
 JOIN organizational_units u ON u.id=p.managing_unit_id JOIN majors m ON m.id=p.major_id
 WHERE s.status='ACTIVE' AND t.status='ACTIVE' AND e.status='ACTIVE' AND p.status='ACTIVE'
 AND v.status IN ('PUBLISHED','ARCHIVED') AND ${SCOPE}`;
function page<T>(
  data: T[],
  total: number,
  query: DefenseQuery,
): DefensePage<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
@Injectable()
export class MysqlDefenseRepository extends DefenseRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private scope(actor: DefenseActor) {
    return [actor.id, actor.id];
  }
  private map(row): DefenseItem {
    return {
      ...row,
      id: String(row.id),
      diemTrungBinh:
        row.diemTrungBinh == null ? null : Number(row.diemTrungBinh),
      diemDat: Number(row.diemDat),
      ...Object.fromEntries(
        ["gradedAt", "createdAt", "cancelledAt"].map((key) => [
          key,
          row[key] instanceof Date
            ? row[key].toISOString()
            : (row[key] ?? null),
        ]),
      ),
    };
  }
  private async threshold(manager: EntityManager): Promise<number | null> {
    const [row] = await manager.query(
      "SELECT setting_value FROM system_settings WHERE setting_key='defense.passing_score'",
    );
    if (!row || !String(row.setting_value).trim()) return null;
    const text = String(row.setting_value).trim(),
      value = Number(text);
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(text) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 10
    )
      throw new ServiceUnavailableException(
        "Ngưỡng đạt bảo vệ trong cấu hình không hợp lệ.",
      );
    return value;
  }
  async policy() {
    return { passingScore: await this.threshold(this.db.manager) };
  }
  async list(query: DefenseQuery, actor: DefenseActor) {
    const search = query.searchTerm || "",
      status = query.selectedStatus || "ALL";
    const where = ` WHERE ${SCOPE} AND (?='ALL' OR d.status=?) AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,d.student_name_snapshot)>0 OR LOCATE(?,d.thesis_title)>0)`;
    const params = [
      ...this.scope(actor),
      status,
      status,
      search,
      search,
      search,
      search,
    ];
    const rows = await this.db.query(
      DEFENSE_SELECT +
        where +
        " ORDER BY d.defense_date DESC,d.id DESC LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + DEFENSE_FROM + where,
      params,
    );
    return page<DefenseItem>(
      rows.map((row) => this.map(row)),
      Number(count.total),
      query,
    );
  }
  async students(query: DefenseQuery, actor: DefenseActor) {
    const search = query.searchTerm || "";
    const where = ` AND EXISTS(SELECT 1 FROM thesis_topics topic WHERE topic.assignment_id=a.id AND topic.status='DANG_THUC_HIEN') AND NOT EXISTS(SELECT 1 FROM thesis_defenses d WHERE d.student_id=s.id AND d.status='CHO_BAO_VE')
   AND NOT EXISTS(SELECT 1 FROM thesis_defenses d WHERE d.assignment_id=a.id AND d.status='DA_DAT')
   AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0)`;
    const params = [...this.scope(actor), search, search, search];
    const rows = await this.db.query(
      `SELECT CAST(a.id AS CHAR) assignmentId,CAST(t.id AS CHAR) programVersionTrackId,
   s.student_code maHocVien,s.full_name hoTen,v.program_name_snapshot chuyenNganh,p.program_code programCode,
   e.level_name levelName,u.unit_name unitName,m.major_name majorName,(SELECT topic.title FROM thesis_topics topic WHERE topic.assignment_id=a.id AND topic.status='DANG_THUC_HIEN') topicTitle` +
        STUDENT_FROM +
        where +
        " ORDER BY s.student_code LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + STUDENT_FROM + where,
      params,
    );
    return page<StudentOption>(rows, Number(count.total), query);
  }
  private async getOne(
    manager: EntityManager,
    id: string,
    actor: DefenseActor,
    lock = false,
  ): Promise<DefenseItem> {
    const [row] = await manager.query(
      DEFENSE_SELECT +
        ` WHERE d.id=? AND ${SCOPE}` +
        (lock ? " FOR UPDATE" : ""),
      [id, ...this.scope(actor)],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy lịch bảo vệ trong phạm vi được cấp.",
      );
    return this.map(row);
  }
  findById(id: string, actor: DefenseActor) {
    return this.getOne(this.db.manager, id, actor);
  }
  private async lockDefense(
    manager: EntityManager,
    id: string,
    actor: DefenseActor,
  ) {
    await this.getOne(manager, id, actor);
    await manager.query(
      "SELECT s.id FROM students s JOIN thesis_defenses d ON d.student_id=s.id WHERE d.id=? FOR UPDATE",
      [id],
    );
    return this.getOne(manager, id, actor, true);
  }
  private async write<T>(
    actor: DefenseActor,
    permission: string,
    callback: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction("READ COMMITTED", async (manager) => {
        await manager.query("SET time_zone='+00:00'");
        const [user] = await manager.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
     AND 2=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id
      JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN ('DEFENSE_READ',?)) FOR UPDATE`,
          [actor.id, permission],
        );
        if (!user)
          throw new ForbiddenException(
            "Tài khoản không còn quyền thao tác bảo vệ.",
          );
        return callback(manager);
      });
    } catch (error) {
      const code = error.driverError?.code || error.code;
      if (
        [
          "ER_DUP_ENTRY",
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_CHECKREAD",
          "ER_SIGNAL_EXCEPTION",
        ].includes(code)
      )
        throw new ConflictException(
          "Lịch đã tồn tại hoặc dữ liệu vừa thay đổi. Hãy tải lại trước khi thao tác.",
        );
      throw error;
    }
  }
  private async audit(
    manager: EntityManager,
    actor: DefenseActor,
    action: string,
    item: DefenseItem,
    old: DefenseItem | null,
  ) {
    await manager.query(
      `INSERT INTO audit_logs(actor_id,actor_username,actor_role,action,entity_type,entity_id,old_value,new_value,reason,ip_address)
   VALUES(?,?,(SELECT LEFT(GROUP_CONCAT(r.role_name ORDER BY r.id SEPARATOR ', '),150) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.status='ACTIVE'),?,'thesis_defense',?,?,?,?,?)`,
      [
        actor.id,
        actor.username,
        actor.id,
        action,
        item.id,
        old ? JSON.stringify(old) : null,
        JSON.stringify(item),
        action + " " + item.maHocVien,
        actor.ip || null,
      ],
    );
  }
  async create(input: CreateDefenseInput, actor: DefenseActor) {
    return this.write(actor, "DEFENSE_SCHEDULE", async (manager) => {
      await manager.query(
        "SELECT id FROM students WHERE student_code=? FOR UPDATE",
        [input.maHocVien],
      );
      const [student] = await manager.query(
        `SELECT CAST(s.id AS CHAR) studentId,CAST(a.id AS CHAR) assignmentId,
    CAST(t.id AS CHAR) trackId,s.full_name hoTen,v.program_name_snapshot chuyenNganh` +
          STUDENT_FROM +
          " AND s.student_code=? AND a.id=? FOR UPDATE",
        [...this.scope(actor), input.maHocVien, input.assignmentId],
      );
      if (!student)
        throw new NotFoundException(
          "Hồ sơ học viên hoặc chương trình đang học không còn phù hợp/trong phạm vi. Hãy chọn lại học viên.",
        );
      const [topic] = await manager.query(
        "SELECT CAST(id AS CHAR) topicId,title FROM thesis_topics WHERE assignment_id=? AND status='DANG_THUC_HIEN' FOR UPDATE",
        [student.assignmentId],
      );
      if (!topic)
        throw new ConflictException(
          "Học viên chưa có đề tài được duyệt cho phân CTĐT này.",
        );
      const [existing] = await manager.query(
        "SELECT id FROM thesis_defenses WHERE (student_id=? AND status='CHO_BAO_VE') OR (assignment_id=? AND status='DA_DAT') LIMIT 1",
        [student.studentId, student.assignmentId],
      );
      if (existing)
        throw new ConflictException(
          "Học viên đã có lịch chờ hoặc đã đạt bảo vệ cho chương trình này.",
        );
      const configured = await this.threshold(manager);
      if (configured !== null && configured !== input.diemDat)
        throw new ConflictException(
          "Ngưỡng đạt trong cấu hình đã thay đổi, hãy tải lại form.",
        );
      await manager.query(
        `INSERT INTO thesis_defenses(student_id,assignment_id,program_version_track_id,student_name_snapshot,program_name_snapshot,
    topic_id,thesis_title,defense_date,location,council_chair,reviewer,secretary,eligibility_note,passing_score,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          student.studentId,
          student.assignmentId,
          student.trackId,
          student.hoTen,
          student.chuyenNganh,
          topic.topicId,
          topic.title,
          input.ngayBaoVe,
          input.diaDiem,
          input.chuTichHoidong,
          input.phanBien,
          input.thuKy,
          input.eligibilityNote,
          input.diemDat,
          actor.id,
        ],
      );
      const [{ id }] = await manager.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) id",
      );
      const item = await this.getOne(manager, id, actor);
      await this.audit(manager, actor, "CREATE", item, null);
      return item;
    });
  }
  async recordResult(
    id: string,
    score: number,
    today: string,
    actor: DefenseActor,
  ) {
    return this.write(actor, "DEFENSE_RESULT", async (manager) => {
      const old = await this.lockDefense(manager, id, actor);
      if (old.trangThai !== "CHO_BAO_VE")
        throw new ConflictException(
          "Kết quả hoặc lịch đã khóa, không thể ghi lại.",
        );
      if (old.ngayBaoVe > today)
        throw new BadRequestException("Chưa đến ngày tổ chức bảo vệ.");
      const [active] = await manager.query(
        "SELECT a.id" +
          STUDENT_FROM +
          " AND a.id=? AND s.student_code=? FOR UPDATE",
        [...this.scope(actor), old.assignmentId, old.maHocVien],
      );
      if (!active)
        throw new ConflictException(
          "Hồ sơ học viên hoặc phân chương trình đã thay đổi. Cần kiểm tra lại lịch bảo vệ.",
        );
      await manager.query(
        "UPDATE thesis_defenses SET average_score=?,status=?,graded_by=?,graded_at=UTC_TIMESTAMP(6) WHERE id=?",
        [score, score >= old.diemDat ? "DA_DAT" : "CHUA_DAT", actor.id, id],
      );
      const item = await this.getOne(manager, id, actor);
      await this.audit(manager, actor, "DEFENSE_RESULT", item, old);
      return item;
    });
  }
  async cancel(id: string, reason: string, actor: DefenseActor) {
    return this.write(actor, "DEFENSE_SCHEDULE", async (manager) => {
      const old = await this.lockDefense(manager, id, actor);
      if (old.trangThai !== "CHO_BAO_VE")
        throw new ConflictException("Chỉ hủy lịch chưa có kết quả.");
      await manager.query(
        "UPDATE thesis_defenses SET status='DA_HUY',cancelled_by=?,cancelled_at=UTC_TIMESTAMP(6),cancellation_reason=? WHERE id=?",
        [actor.id, reason, id],
      );
      const item = await this.getOne(manager, id, actor);
      await this.audit(manager, actor, "DEFENSE_CANCEL", item, old);
      return item;
    });
  }
}
