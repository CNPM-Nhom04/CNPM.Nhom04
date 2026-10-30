import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  CourseActor,
  CourseQuery,
  CourseRepository,
  CourseVersionInput,
  CreateCourseInput,
  RevisionInput,
} from "../domain/course";
const SCOPE =
  "EXISTS(SELECT 1 FROM vw_user_course_access a WHERE a.user_id=? AND a.course_id=c.id)";
const UNIT_SCOPE =
  "EXISTS(SELECT 1 FROM user_scopes s WHERE s.user_id=? AND (s.scope_type='GLOBAL' OR (s.scope_type='ORG_UNIT' AND EXISTS(SELECT 1 FROM organizational_unit_closure oc WHERE oc.ancestor_id=s.organizational_unit_id AND oc.descendant_id=u.id))))";
const BASE = ` FROM courses c JOIN organizational_units u ON u.id=c.owning_unit_id
 LEFT JOIN course_versions v ON v.id=(SELECT v2.id FROM course_versions v2 WHERE v2.course_id=c.id ORDER BY v2.version_no DESC LIMIT 1)
 LEFT JOIN course_versions av ON av.course_id=c.id AND av.status='ACTIVE'`;
const SELECT =
  `SELECT CAST(c.id AS CHAR) id,c.course_code courseCode,c.status,
 CAST(u.id AS CHAR) unitId,u.unit_name unitName,u.unit_code unitCode,
 CAST(v.id AS CHAR) latestVersionId,v.version_no versionNo,v.course_name courseName,v.english_name englishName,
 v.credits,v.theory_hours theoryHours,v.practice_hours practiceHours,v.description,v.status versionStatus,
 DATE_FORMAT(v.effective_from,'%Y-%m-%d') effectiveFrom,DATE_FORMAT(v.effective_to,'%Y-%m-%d') effectiveTo,
 CAST(av.id AS CHAR) activeVersionId,av.version_no activeVersionNo,av.course_name activeCourseName,av.credits activeCredits` +
  BASE;
@Injectable()
export class MysqlCourseRepository extends CourseRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private map(row) {
    return {
      ...row,
      credits: row.credits == null ? null : Number(row.credits),
      activeCredits:
        row.activeCredits == null ? null : Number(row.activeCredits),
      ...(row.usageCount !== undefined
        ? { usageCount: Number(row.usageCount) }
        : {}),
    };
  }
  async list(query: CourseQuery, actor: CourseActor) {
    const search = query.search || "",
      status = query.status || "ALL",
      unit = query.unitId || "";
    const where =
      " WHERE " +
      SCOPE +
      ` AND (?='ALL' OR c.status=?) AND (?='' OR c.owning_unit_id=?)
      AND (?='' OR LOCATE(?,c.course_code)>0 OR EXISTS(SELECT 1 FROM course_versions sv WHERE sv.course_id=c.id AND (LOCATE(?,sv.course_name)>0 OR LOCATE(?,sv.english_name)>0)))`;
    const params = [
      actor.id,
      status,
      status,
      unit,
      unit,
      search,
      search,
      search,
      search,
    ];
    const rows = await this.db.query(
      SELECT + where + " ORDER BY c.course_code,c.id LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + BASE + where,
      params,
    );
    return {
      data: rows.map((row) => this.map(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: Number(count.total),
        totalPages: Math.ceil(Number(count.total) / query.limit),
      },
      permissions: { canManage: actor.canManage },
    };
  }
  units(actor: CourseActor) {
    return this.db.query(
      "SELECT CAST(u.id AS CHAR) id,u.unit_code code,u.unit_name name,u.status FROM organizational_units u WHERE " +
        UNIT_SCOPE +
        " ORDER BY u.unit_name",
      [actor.id],
    );
  }
  private async get(
    m: EntityManager,
    id: string,
    actor: CourseActor,
    lock = false,
  ) {
    if (lock) {
      const [found] = await m.query(
        "SELECT c.id FROM courses c WHERE c.id=? AND " + SCOPE + " FOR UPDATE",
        [id, actor.id],
      );
      if (!found)
        throw new NotFoundException(
          "Không tìm thấy học phần trong phạm vi được cấp.",
        );
    }
    const [course] = await m.query(SELECT + " WHERE c.id=? AND " + SCOPE, [
      id,
      actor.id,
    ]);
    if (!course)
      throw new NotFoundException(
        "Không tìm thấy học phần trong phạm vi được cấp.",
      );
    return this.map(course);
  }
  private async details(m: EntityManager, id: string, actor: CourseActor) {
    const course = await this.get(m, id, actor);
    const rows = await m.query(
      `SELECT CAST(v.id AS CHAR) id,v.version_no versionNo,v.course_name courseName,
      v.english_name englishName,v.credits,v.theory_hours theoryHours,v.practice_hours practiceHours,v.description,v.status,
      DATE_FORMAT(v.effective_from,'%Y-%m-%d') effectiveFrom,DATE_FORMAT(v.effective_to,'%Y-%m-%d') effectiveTo,
      (SELECT COUNT(*) FROM curriculum_courses cc WHERE cc.course_version_id=v.id) usageCount
      FROM course_versions v WHERE v.course_id=? ORDER BY v.version_no DESC`,
      [id],
    );
    return {
      ...course,
      versions: rows.map((row) => this.map(row)),
      permissions: { canManage: actor.canManage },
      today: this.today(),
    };
  }
  detail(id: string, actor: CourseActor) {
    return this.details(this.db.manager, id, actor);
  }
  private today() {
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  }
  private async write<T>(
    actor: CourseActor,
    callback: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction("READ COMMITTED", async (m) => {
        const [user] = await m.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
          AND 2=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
            WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN ('CATALOG_READ','CATALOG_MANAGE')) FOR UPDATE`,
          [actor.id],
        );
        if (!user)
          throw new ForbiddenException(
            "Tài khoản không còn quyền quản lý học phần.",
          );
        return callback(m);
      });
    } catch (error) {
      const code = error.driverError?.code || error.code;
      if (
        [
          "ER_DUP_ENTRY",
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_SIGNAL_EXCEPTION",
        ].includes(code)
      )
        throw new ConflictException(
          "Mã học phần đã tồn tại hoặc dữ liệu vừa thay đổi. Hãy tải lại.",
        );
      throw error;
    }
  }
  private async unit(m: EntityManager, id: string, actor: CourseActor) {
    const [unit] = await m.query(
      "SELECT u.id FROM organizational_units u WHERE u.id=? AND u.status='ACTIVE' AND " +
        UNIT_SCOPE +
        " FOR UPDATE",
      [id, actor.id],
    );
    if (!unit)
      throw new ForbiddenException(
        "Đơn vị không hoạt động hoặc ngoài phạm vi được cấp.",
      );
  }
  private async insertVersion(
    m: EntityManager,
    id: string,
    no: number,
    input: CourseVersionInput,
    actor: CourseActor,
  ) {
    await m.query(
      `INSERT INTO course_versions(course_id,version_no,course_name,english_name,credits,theory_hours,practice_hours,description,search_text,effective_from,effective_to,status,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'DRAFT',?)`,
      [
        id,
        no,
        input.courseName,
        input.englishName || null,
        input.credits,
        input.theoryHours,
        input.practiceHours,
        input.description || null,
        (input.courseName + " " + (input.englishName || "")).slice(0, 600),
        input.effectiveFrom,
        input.effectiveTo || null,
        actor.id,
      ],
    );
  }
  private async audit(
    m: EntityManager,
    actor: CourseActor,
    action: string,
    course,
    old: unknown,
    value: unknown,
  ) {
    await m.query(
      `INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,scope_unit_id,old_value,new_value,ip_address)
      VALUES(?,?,?,'course',?,?,?,?,?)`,
      [
        actor.id,
        actor.username,
        action,
        course.id,
        course.unitId,
        old ? JSON.stringify(old) : null,
        JSON.stringify(value),
        actor.ip || null,
      ],
    );
  }
  create(input: CreateCourseInput, actor: CourseActor) {
    return this.write(actor, async (m) => {
      await this.unit(m, input.unitId, actor);
      await m.query(
        "INSERT INTO courses(owning_unit_id,course_code,status) VALUES(?,?,'ACTIVE')",
        [input.unitId, input.courseCode],
      );
      const [row] = await m.query(
        "SELECT CAST(id AS CHAR) id FROM courses WHERE course_code=?",
        [input.courseCode],
      );
      await this.insertVersion(m, row.id, 1, input, actor);
      const item = await this.details(m, row.id, actor);
      await this.audit(m, actor, "COURSE_CREATE", item, null, item);
      return item;
    });
  }
  revise(id: string, input: RevisionInput, actor: CourseActor) {
    return this.write(actor, async (m) => {
      const old = await this.get(m, id, actor, true);
      await this.unit(m, old.unitId, actor);
      if (old.status !== "ACTIVE")
        throw new ConflictException(
          "Hãy mở sử dụng học phần trước khi tạo phiên bản.",
        );
      if (String(old.latestVersionId || "0") !== input.expectedLatestVersionId)
        throw new ConflictException(
          "Đã có phiên bản mới. Hãy tải lại trước khi tạo bản sửa đổi.",
        );
      await this.insertVersion(
        m,
        id,
        Number(old.versionNo || 0) + 1,
        input,
        actor,
      );
      const item = await this.details(m, id, actor);
      await this.audit(m, actor, "COURSE_VERSION_CREATE", item, old, item);
      return item;
    });
  }
  activate(id: string, versionId: string, actor: CourseActor) {
    return this.write(actor, async (m) => {
      const old = await this.get(m, id, actor, true);
      await this.unit(m, old.unitId, actor);
      const [draft] = await m.query(
        "SELECT id,status,DATE_FORMAT(effective_from,'%Y-%m-%d') startDate,DATE_FORMAT(effective_to,'%Y-%m-%d') endDate FROM course_versions WHERE id=? AND course_id=? FOR UPDATE",
        [versionId, id],
      );
      if (!draft)
        throw new NotFoundException("Không tìm thấy phiên bản của học phần.");
      if (
        old.status !== "ACTIVE" ||
        draft.status !== "DRAFT" ||
        old.latestVersionId !== versionId
      )
        throw new ConflictException(
          "Chỉ kích hoạt bản nháp mới nhất của học phần đang mở sử dụng.",
        );
      if (
        draft.startDate > this.today() ||
        (draft.endDate && draft.endDate < this.today())
      )
        throw new BadRequestException(
          "Phiên bản chưa đến ngày hiệu lực hoặc đã hết hiệu lực.",
        );
      if (old.activeVersionId) {
        const [previous] = await m.query(
          "SELECT DATE_FORMAT(effective_from,'%Y-%m-%d') startDate FROM course_versions WHERE id=? FOR UPDATE",
          [old.activeVersionId],
        );
        if (draft.startDate <= previous.startDate)
          throw new BadRequestException(
            "Ngày hiệu lực bản mới phải sau ngày bắt đầu bản ACTIVE hiện tại.",
          );
        await m.query(
          "UPDATE course_versions SET status='RETIRED',effective_to=LEAST(COALESCE(effective_to,'9999-12-31'),DATE_SUB(?,INTERVAL 1 DAY)) WHERE id=?",
          [draft.startDate, old.activeVersionId],
        );
      }
      await m.query("UPDATE course_versions SET status='ACTIVE' WHERE id=?", [
        versionId,
      ]);
      const item = await this.details(m, id, actor);
      await this.audit(m, actor, "COURSE_VERSION_ACTIVATE", item, old, item);
      return item;
    });
  }
  setStatus(
    id: string,
    status: string,
    expectedStatus: string,
    actor: CourseActor,
  ) {
    return this.write(actor, async (m) => {
      const old = await this.get(m, id, actor, true);
      if (
        old.status === "RETIRED" ||
        old.status !== expectedStatus ||
        old.status === status
      )
        throw new ConflictException(
          "Trạng thái đã thay đổi hoặc học phần đã ngừng dùng vĩnh viễn. Hãy tải lại.",
        );
      if (status === "ACTIVE") await this.unit(m, old.unitId, actor);
      await m.query("UPDATE courses SET status=? WHERE id=?", [status, id]);
      const item = await this.details(m, id, actor);
      await this.audit(
        m,
        actor,
        status === "ACTIVE" ? "COURSE_UNLOCK" : "COURSE_LOCK",
        item,
        old,
        item,
      );
      return item;
    });
  }
}
