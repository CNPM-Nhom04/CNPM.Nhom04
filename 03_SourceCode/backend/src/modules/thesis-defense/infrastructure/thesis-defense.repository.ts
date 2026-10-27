import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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

// p is the program of the exact track used by the defense/assignment.
const SCOPE = `(? = 1 OR EXISTS (
  SELECT 1 FROM user_scopes us WHERE us.user_id = ? AND (
    us.scope_type = 'GLOBAL'
    OR (us.scope_type = 'PROGRAM' AND us.program_id = p.id)
    OR (us.scope_type = 'MAJOR' AND us.major_id = p.major_id)
    OR (us.scope_type = 'ORG_UNIT' AND EXISTS (
      SELECT 1 FROM organizational_unit_closure oc
      WHERE oc.ancestor_id = us.organizational_unit_id AND oc.descendant_id = p.managing_unit_id
    ))
  )
))`;
const DEFENSE_FROM = ` FROM thesis_defenses d
  JOIN students s ON s.id = d.student_id
  JOIN program_version_tracks t ON t.id = d.program_version_track_id
  JOIN program_versions v ON v.id = t.program_version_id
  JOIN training_programs p ON p.id = v.program_id`;
const DEFENSE_SELECT =
  `SELECT CAST(d.id AS CHAR) AS id, s.student_code AS maHocVien,
  d.student_name_snapshot AS hoTen, d.program_name_snapshot AS chuyenNganh,
  d.thesis_title AS tenDeTai, DATE_FORMAT(d.defense_date, '%Y-%m-%d') AS ngayBaoVe,
  d.location AS diaDiem, d.council_chair AS chuTichHoidong,
  COALESCE(d.reviewer, '') AS phanBien, COALESCE(d.secretary, '') AS thuKy,
  d.average_score AS diemTrungBinh, d.passing_score AS diemDat, d.status AS trangThai,
  d.graded_at AS gradedAt` + DEFENSE_FROM;
const STUDENT_FROM = ` FROM students s
  JOIN student_program_assignments a ON a.student_id = s.id AND a.assignment_status = 'ACTIVE'
  JOIN program_version_tracks t ON t.id = a.program_version_track_id
  JOIN program_versions v ON v.id = t.program_version_id
  JOIN training_programs p ON p.id = v.program_id
  JOIN education_levels e ON e.id = p.education_level_id
  WHERE s.status = 'ACTIVE' AND t.status = 'ACTIVE'
    AND e.level_code IN ('MASTER', 'PHD', 'DOCTOR', 'DOCTORATE') AND ${SCOPE}`;
function resultPage<T>(
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
    return [actor.isAdmin ? 1 : 0, actor.id];
  }
  private map(row): DefenseItem {
    return {
      ...row,
      id: String(row.id),
      diemTrungBinh:
        row.diemTrungBinh == null ? null : Number(row.diemTrungBinh),
      diemDat: Number(row.diemDat),
      gradedAt:
        row.gradedAt instanceof Date
          ? row.gradedAt.toISOString()
          : row.gradedAt,
    };
  }
  async list(
    query: DefenseQuery,
    actor: DefenseActor,
  ): Promise<DefensePage<DefenseItem>> {
    const search = query.searchTerm || "";
    const status = query.selectedStatus || "ALL";
    const where = ` WHERE ${SCOPE} AND (? = 'ALL' OR d.status = ?)
      AND (? = '' OR LOCATE(?, s.student_code) > 0 OR LOCATE(?, d.student_name_snapshot) > 0 OR LOCATE(?, d.thesis_title) > 0)`;
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
        " ORDER BY d.defense_date DESC, d.id DESC LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) AS total" + DEFENSE_FROM + where,
      params,
    );
    return resultPage<DefenseItem>(
      rows.map((row) => this.map(row)),
      Number(count.total),
      query,
    );
  }
  async students(
    query: DefenseQuery,
    actor: DefenseActor,
  ): Promise<DefensePage<StudentOption>> {
    const search = query.searchTerm || "";
    const where = ` AND NOT EXISTS (SELECT 1 FROM thesis_defenses pending WHERE pending.student_id = s.id AND pending.status = 'CHO_BAO_VE')
      AND (? = '' OR LOCATE(?, s.student_code) > 0 OR LOCATE(?, s.full_name) > 0)`;
    const params = [...this.scope(actor), search, search, search];
    const data = await this.db.query(
      `SELECT s.student_code AS maHocVien, s.full_name AS hoTen,
      v.program_name_snapshot AS chuyenNganh` +
        STUDENT_FROM +
        where +
        " ORDER BY s.student_code LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) AS total" + STUDENT_FROM + where,
      params,
    );
    return resultPage(data, Number(count.total), query);
  }
  private async getOne(
    manager: EntityManager,
    id: string,
    actor: DefenseActor,
    lock = false,
  ): Promise<DefenseItem> {
    const [row] = await manager.query(
      DEFENSE_SELECT +
        ` WHERE d.id = ? AND ${SCOPE}` +
        (lock ? " FOR UPDATE" : ""),
      [id, ...this.scope(actor)],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy lịch bảo vệ trong phạm vi được phân quyền.",
      );
    return this.map(row);
  }
  findById(id: string, actor: DefenseActor) {
    return this.getOne(this.db.manager, id, actor);
  }
  private async audit(
    manager: EntityManager,
    actor: DefenseActor,
    action: string,
    item: DefenseItem,
    old: DefenseItem | null,
  ) {
    await manager.query(
      `INSERT INTO audit_logs
      (actor_id, actor_username, action, entity_type, entity_id, old_value, new_value, reason, ip_address)
      VALUES (?, ?, ?, 'thesis_defense', ?, ?, ?, ?, ?)`,
      [
        actor.id,
        actor.username,
        action,
        item.id,
        old ? JSON.stringify(old) : null,
        JSON.stringify(item),
        `${action === "CREATE" ? "Lập lịch" : "Ghi kết quả"} bảo vệ ${item.maHocVien}: ${item.tenDeTai}`.slice(
          0,
          1000,
        ),
        actor.ip,
      ],
    );
  }
  async create(
    input: CreateDefenseInput,
    actor: DefenseActor,
  ): Promise<DefenseItem> {
    try {
      return await this.db.transaction(async (manager) => {
        const [student] = await manager.query(
          `SELECT CAST(s.id AS CHAR) AS studentId,
          s.full_name AS hoTen, CAST(t.id AS CHAR) AS trackId,
          v.program_name_snapshot AS chuyenNganh` +
            STUDENT_FROM +
            " AND s.student_code = ? FOR UPDATE",
          [...this.scope(actor), input.maHocVien],
        );
        if (!student)
          throw new NotFoundException(
            "Học viên không tồn tại, chưa có CTĐT SĐH đang học hoặc ngoài phạm vi được phân quyền.",
          );
        await manager.query(
          `INSERT INTO thesis_defenses
          (student_id, program_version_track_id, student_name_snapshot, program_name_snapshot,
            thesis_title, defense_date, location, council_chair, reviewer, secretary, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            student.studentId,
            student.trackId,
            student.hoTen,
            student.chuyenNganh,
            input.tenDeTai,
            input.ngayBaoVe,
            input.diaDiem,
            input.chuTichHoidong,
            input.phanBien || null,
            input.thuKy || null,
            actor.id,
          ],
        );
        const [{ id }] = await manager.query(
          "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
        );
        const item = await this.getOne(manager, id, actor);
        await this.audit(manager, actor, "CREATE", item, null);
        return item;
      });
    } catch (error) {
      if ((error.driverError?.code || error.code) === "ER_DUP_ENTRY")
        throw new ConflictException("Học viên đã có lịch bảo vệ đang chờ.");
      throw error;
    }
  }
  async recordResult(
    id: string,
    score: number,
    today: string,
    actor: DefenseActor,
  ): Promise<DefenseItem> {
    return this.db.transaction(async (manager) => {
      const old = await this.getOne(manager, id, actor, true);
      if (old.trangThai !== "CHO_BAO_VE")
        throw new ConflictException(
          "Lịch bảo vệ đã có kết quả, không thể ghi lại.",
        );
      if (old.ngayBaoVe > today)
        throw new BadRequestException("Chưa đến ngày tổ chức bảo vệ.");
      await manager.query(
        `UPDATE thesis_defenses SET average_score = ?, status = ?, graded_by = ?,
        graded_at = UTC_TIMESTAMP(6) WHERE id = ?`,
        [score, score >= old.diemDat ? "DA_DAT" : "CHUA_DAT", actor.id, id],
      );
      const item = await this.getOne(manager, id, actor);
      await this.audit(manager, actor, "UPDATE", item, old);
      return item;
    });
  }
}
