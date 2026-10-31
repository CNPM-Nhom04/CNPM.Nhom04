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
  GradeActor,
  GradePolicyInput,
  GradeQuery,
  GradeRepository,
  GradeWrite,
  LegacyWrite,
} from "../domain/grade";
import { calculateGrade } from "../domain/calculate-grade";
const COURSE_SCOPE =
  "EXISTS(SELECT 1 FROM vw_user_course_access ca WHERE ca.user_id=? AND ca.course_id=c.id)";
const SCOPE =
  COURSE_SCOPE +
  " AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id)";
const BASE = ` FROM student_course_results r JOIN students s ON s.id=r.student_id JOIN courses c ON c.id=r.course_id
 JOIN course_versions v ON v.id=r.course_version_id JOIN organizational_units u ON u.id=c.owning_unit_id
 LEFT JOIN course_offerings co ON co.id=r.course_offering_id AND co.course_version_id=r.course_version_id
 LEFT JOIN registration_periods rp ON rp.id=co.registration_period_id LEFT JOIN academic_terms t ON t.id=rp.academic_term_id
 LEFT JOIN grade_details d ON d.result_id=r.id LEFT JOIN grade_policies p ON p.id=d.policy_id`;
const SELECT =
  `SELECT CAST(r.id AS CHAR) id,CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.full_name studentName,
 CAST(c.id AS CHAR) courseId,CAST(v.id AS CHAR) courseVersionId,c.course_code courseCode,v.course_name courseName,v.version_no courseVersionNo,
 CAST(c.owning_unit_id AS CHAR) unitId,u.unit_name unitName,CAST(r.course_offering_id AS CHAR) offeringId,
 co.class_code classCode,co.status classStatus,t.academic_year academicYear,t.semester,
 r.result_status resultStatus,r.grade,r.revision,r.passed_at passedAt,
 DATE_FORMAT(r.passed_at+INTERVAL 7 HOUR,'%Y-%m-%d') passedDate,r.created_at createdAt,
 CAST(d.registration_id AS CHAR) registrationId,COALESCE(d.state,'LEGACY') state,d.attendance_score attendanceScore,
 d.midterm_score midtermScore,d.exam_score examScore,d.total_score totalScore,d.finalized_at finalizedAt,
 CAST(p.id AS CHAR) policyId,p.attendance_weight attendanceWeight,p.midterm_weight midtermWeight,p.exam_weight examWeight,
 p.passing_score passingScore,p.decimal_places decimalPlaces,p.rounding,p.reference policyReference` +
  BASE;
const CLASS_BASE = ` FROM course_offerings co JOIN courses c ON c.id=(SELECT course_id FROM course_versions WHERE id=co.course_version_id)
 JOIN course_versions v ON v.id=co.course_version_id JOIN organizational_units u ON u.id=c.owning_unit_id
 JOIN registration_periods rp ON rp.id=co.registration_period_id JOIN academic_terms t ON t.id=rp.academic_term_id`;
const CLASS_SELECT =
  `SELECT CAST(co.id AS CHAR) id,co.class_code classCode,co.status,
 CAST(v.id AS CHAR) courseVersionId,c.course_code courseCode,v.course_name courseName,v.version_no courseVersionNo,
 CAST(c.owning_unit_id AS CHAR) unitId,u.unit_name unitName,t.academic_year academicYear,t.semester` +
  CLASS_BASE;
const REG_BASE = ` FROM course_registrations cr JOIN students s ON s.id=cr.student_id JOIN course_offerings co ON co.id=cr.course_offering_id
 JOIN course_versions v ON v.id=co.course_version_id JOIN courses c ON c.id=v.course_id JOIN organizational_units u ON u.id=c.owning_unit_id`;
const REG_SELECT =
  `SELECT CAST(cr.id AS CHAR) id,CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.full_name studentName,
 CAST(co.id AS CHAR) offeringId,co.class_code classCode,co.status classStatus,cr.status registrationStatus,
 CAST(v.id AS CHAR) courseVersionId,CAST(c.id AS CHAR) courseId,c.course_code courseCode,v.course_name courseName,
 v.version_no courseVersionNo,u.unit_name unitName` + REG_BASE;
const POLICY_SELECT = `SELECT CAST(id AS CHAR) id,CAST(course_offering_id AS CHAR) offeringId,attendance_weight attendanceWeight,
 midterm_weight midtermWeight,exam_weight examWeight,passing_score passingScore,decimal_places decimalPlaces,rounding,reference,revision
 FROM grade_policies`;
const OPEN_CLASSES = ["OPEN", "CLOSED", "CONFIRMED", "COMPLETED"];
function paged(data, total: number, q: GradeQuery) {
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
export class MysqlGradeRepository extends GradeRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private map(row) {
    return {
      ...row,
      ...Object.fromEntries(
        [
          "attendanceScore",
          "midtermScore",
          "examScore",
          "totalScore",
          "attendanceWeight",
          "midtermWeight",
          "examWeight",
          "passingScore",
        ]
          .filter((k) => k in row)
          .map((k) => [k, row[k] == null ? null : Number(row[k])]),
      ),
      ...Object.fromEntries(
        ["passedAt", "createdAt", "finalizedAt"]
          .filter((k) => k in row)
          .map((k) => [
            k,
            row[k] instanceof Date ? row[k].toISOString() : (row[k] ?? null),
          ]),
      ),
    };
  }
  async list(q: GradeQuery, a: GradeActor) {
    const search = q.searchTerm || "",
      result = q.resultStatus || "ALL",
      state = q.state || "ALL",
      offering = q.offeringId || "";
    const where =
      " WHERE " +
      SCOPE +
      " AND (?='ALL' OR r.result_status=?) AND (?='ALL' OR COALESCE(d.state,'LEGACY')=?) AND (?='' OR r.course_offering_id=?) AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0 OR LOCATE(?,c.course_code)>0 OR LOCATE(?,v.course_name)>0 OR LOCATE(?,co.class_code)>0)";
    const args = [
      a.id,
      a.id,
      result,
      result,
      state,
      state,
      offering,
      offering,
      search,
      search,
      search,
      search,
      search,
      search,
    ];
    const data = await this.db.query(
      SELECT + where + " ORDER BY r.id DESC LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + BASE + where,
      args,
    );
    return {
      ...paged(
        data.map((r) => this.map(r)),
        Number(count.total),
        q,
      ),
      permissions: { canManage: a.canManage },
    };
  }
  async classes(q: GradeQuery, a: GradeActor) {
    const search = q.searchTerm || "";
    const where =
      " WHERE " +
      COURSE_SCOPE +
      " AND (?='' OR LOCATE(?,co.class_code)>0 OR LOCATE(?,c.course_code)>0 OR LOCATE(?,v.course_name)>0)";
    const args = [a.id, search, search, search, search];
    const data = await this.db.query(
      CLASS_SELECT + where + " ORDER BY co.id DESC LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + CLASS_BASE + where,
      args,
    );
    return paged(data, Number(count.total), q);
  }
  async registrations(q: GradeQuery, a: GradeActor) {
    const search = q.searchTerm || "",
      offering = q.offeringId || "";
    const where =
      " WHERE " +
      SCOPE +
      ` AND cr.status='REGISTERED' AND co.status IN ('OPEN','CLOSED','CONFIRMED','COMPLETED')
   AND NOT EXISTS(SELECT 1 FROM student_course_results r WHERE r.student_id=s.id AND r.course_offering_id=co.id)
   AND (?='' OR co.id=?) AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0 OR LOCATE(?,co.class_code)>0)`;
    const args = [
      a.id,
      a.id,
      offering,
      offering,
      search,
      search,
      search,
      search,
    ];
    const data = await this.db.query(
      REG_SELECT +
        where +
        " ORDER BY co.class_code,s.student_code LIMIT ? OFFSET ?",
      [...args, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total" + REG_BASE + where,
      args,
    );
    return paged(data, Number(count.total), q);
  }
  private async getClass(
    m: EntityManager,
    id: string,
    a: GradeActor,
    lock = false,
  ) {
    const [row] = await m.query(
      CLASS_SELECT +
        " WHERE co.id=? AND " +
        COURSE_SCOPE +
        (lock ? " FOR UPDATE" : ""),
      [id, a.id],
    );
    if (!row)
      throw new NotFoundException("Không tìm thấy lớp học phần trong phạm vi.");
    return row;
  }
  private async get(m: EntityManager, id: string, a: GradeActor, lock = false) {
    const [row] = await m.query(
      SELECT + " WHERE r.id=? AND " + SCOPE + (lock ? " FOR UPDATE" : ""),
      [id, a.id, a.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy kết quả học tập trong phạm vi.",
      );
    return this.map(row);
  }
  private async details(m: EntityManager, id: string, a: GradeActor) {
    const item = await this.get(m, id, a);
    const history = await m.query(
      "SELECT h.revision,h.action,u.full_name actorName,h.note,h.reference,h.old_value oldValue,h.new_value newValue,h.created_at createdAt FROM grade_revisions h JOIN users u ON u.id=h.actor_id WHERE h.result_id=? ORDER BY h.revision",
      [id],
    );
    return {
      ...item,
      history: history.map((h) => this.map(h)),
      permissions: { canManage: a.canManage },
    };
  }
  detail(id: string, a: GradeActor) {
    return this.details(this.db.manager, id, a);
  }
  private async getPolicy(m: EntityManager, offeringId: string, lock = false) {
    const [row] = await m.query(
      POLICY_SELECT +
        " WHERE course_offering_id=?" +
        (lock ? " FOR UPDATE" : ""),
      [offeringId],
    );
    return row ? this.map(row) : null;
  }
  private async policyResponse(m: EntityManager, id: string, a: GradeActor) {
    const offering = await this.getClass(m, id, a);
    const policy = await this.getPolicy(m, id);
    const [frozen] = await m.query(
      "SELECT COUNT(*) total FROM grade_details d JOIN grade_policies p ON p.id=d.policy_id WHERE p.course_offering_id=?",
      [id],
    );
    const [setting] = await m.query(
      "SELECT setting_value FROM system_settings WHERE setting_key='training.diemDatHocPhan'",
    );
    let configuredPassingScore: number | null = null;
    if (setting && String(setting.setting_value).trim()) {
      const raw = String(setting.setting_value).trim(),
        value = Number(raw);
      if (
        !/^\d+(\.\d{1,2})?$/.test(raw) ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > 10
      )
        throw new ServiceUnavailableException(
          "Tham số điểm đạt trong SQL không hợp lệ.",
        );
      configuredPassingScore = value;
    }
    return {
      offering,
      policy,
      configuredPassingScore,
      frozen: !!Number(frozen.total),
      permissions: { canManage: a.canManage },
    };
  }
  policy(id: string, a: GradeActor) {
    return this.policyResponse(this.db.manager, id, a);
  }
  private async write<T>(a: GradeActor, fn: (m: EntityManager) => Promise<T>) {
    try {
      return await this.db.transaction("READ COMMITTED", async (m) => {
        const [user] = await m.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
   AND 2=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
    WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN ('GRADE_READ','GRADE_MANAGE')) FOR UPDATE`,
          [a.id],
        );
        if (!user)
          throw new ForbiddenException(
            "Tài khoản không còn quyền quản lý điểm.",
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
          "Kết quả đã tồn tại hoặc dữ liệu vừa thay đổi. Hãy tải lại.",
        );
      throw error;
    }
  }
  private async audit(
    m: EntityManager,
    a: GradeActor,
    action: string,
    item,
    old,
    reference: string,
    note: string,
    policy = false,
  ) {
    if (!policy)
      await m.query(
        "INSERT INTO grade_revisions(result_id,revision,action,actor_id,note,reference,old_value,new_value) VALUES(?,?,?,?,?,?,?,?)",
        [
          item.id,
          item.revision,
          action,
          a.id,
          note,
          reference,
          old ? JSON.stringify(old) : null,
          JSON.stringify(item),
        ],
      );
    await m.query(
      "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,scope_unit_id,old_value,new_value,reason,ip_address) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        a.id,
        a.username,
        action,
        policy ? "grade_policy" : "student_course_result",
        item.id,
        item.unitId,
        old ? JSON.stringify(old) : null,
        JSON.stringify(item),
        (note + " [" + reference + "]").slice(0, 1000),
        a.ip || null,
      ],
    );
  }
  savePolicy(id: string, b: GradePolicyInput, a: GradeActor) {
    return this.write(a, async (m) => {
      const offering = await this.getClass(m, id, a, true);
      if (!OPEN_CLASSES.includes(offering.status))
        throw new ConflictException(
          "Lớp đang dự kiến hoặc đã hủy, không cấu hình chấm điểm.",
        );
      const old = await this.getPolicy(m, id, true);
      if ((old?.revision || 0) !== b.revision)
        throw new ConflictException("Quy tắc đã thay đổi. Hãy tải lại.");
      const [used] = await m.query(
        "SELECT d.result_id FROM grade_details d JOIN grade_policies p ON p.id=d.policy_id WHERE p.course_offering_id=? LIMIT 1",
        [id],
      );
      if (used)
        throw new ConflictException(
          "Lớp đã có bảng điểm; quy tắc được giữ cố định để bảo toàn kết quả.",
        );
      const args = [
        b.attendanceWeight,
        b.midtermWeight,
        b.examWeight,
        b.passingScore,
        b.decimalPlaces,
        b.rounding,
        b.reference,
        a.id,
      ];
      if (old)
        await m.query(
          "UPDATE grade_policies SET attendance_weight=?,midterm_weight=?,exam_weight=?,passing_score=?,decimal_places=?,rounding=?,reference=?,updated_by=?,revision=revision+1 WHERE id=?",
          [...args, old.id],
        );
      else
        await m.query(
          "INSERT INTO grade_policies(attendance_weight,midterm_weight,exam_weight,passing_score,decimal_places,rounding,reference,updated_by,course_offering_id,revision) VALUES(?,?,?,?,?,?,?,?,?,1)",
          [...args, id],
        );
      const policy = await this.getPolicy(m, id);
      await this.audit(
        m,
        a,
        "GRADE_POLICY_SAVE",
        { ...policy, unitId: offering.unitId },
        old,
        b.reference,
        "Thiết lập quy tắc lớp học phần",
        true,
      );
      return this.policyResponse(m, id, a);
    });
  }
  private async lockResult(m: EntityManager, id: string, a: GradeActor) {
    const found = await this.get(m, id, a);
    await m.query("SELECT id FROM students WHERE id=? FOR UPDATE", [
      found.studentId,
    ]);
    if (found.offeringId) await this.getClass(m, found.offeringId, a, true);
    return this.get(m, id, a, true);
  }
  private async registration(
    m: EntityManager,
    id: string,
    a: GradeActor,
    completed = false,
  ) {
    const [r] = await m.query(
      REG_SELECT + " WHERE cr.id=? AND " + SCOPE + " FOR UPDATE",
      [id, a.id, a.id],
    );
    if (!r)
      throw new NotFoundException(
        "Không tìm thấy đăng ký học phần trong phạm vi.",
      );
    if (
      r.registrationStatus !== "REGISTERED" ||
      !OPEN_CLASSES.includes(r.classStatus)
    )
      throw new ConflictException(
        "Đăng ký đã hủy/rút hoặc lớp không còn phù hợp để nhập điểm.",
      );
    if (completed && r.classStatus !== "COMPLETED")
      throw new ConflictException(
        "Chỉ chốt hoặc điều chỉnh điểm đã chốt khi lớp ở trạng thái COMPLETED.",
      );
    return r;
  }
  create(b: GradeWrite, a: GradeActor) {
    return this.write(a, async (m) => {
      const [target] = await m.query(
        "SELECT CAST(student_id AS CHAR) studentId,CAST(course_offering_id AS CHAR) offeringId FROM course_registrations WHERE id=?",
        [b.registrationId],
      );
      if (!target)
        throw new NotFoundException("Không tìm thấy đăng ký học phần.");
      await m.query("SELECT id FROM students WHERE id=? FOR UPDATE", [
        target.studentId,
      ]);
      await this.getClass(m, String(target.offeringId), a, true);
      const registration = await this.registration(m, b.registrationId, a);
      const policy = await this.getPolicy(m, registration.offeringId, true);
      if (!policy)
        throw new ConflictException("Lớp chưa có quy tắc chấm điểm trong SQL.");
      const total = calculateGrade(b, policy);
      await m.query(
        "INSERT INTO student_course_results(student_id,course_id,course_version_id,course_offering_id,result_status,grade,recorded_by) VALUES(?,?,?,?,'INCOMPLETE',NULL,?)",
        [
          registration.studentId,
          registration.courseId,
          registration.courseVersionId,
          registration.offeringId,
          a.id,
        ],
      );
      const [{ id }] = await m.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) id",
      );
      await m.query(
        "INSERT INTO grade_details(result_id,registration_id,policy_id,attendance_score,midterm_score,exam_score,total_score) VALUES(?,?,?,?,?,?,?)",
        [
          id,
          b.registrationId,
          policy.id,
          b.attendanceScore ?? null,
          b.midtermScore ?? null,
          b.examScore ?? null,
          total,
        ],
      );
      const item = await this.get(m, id, a);
      await this.audit(m, a, "GRADE_CREATE", item, null, b.reference, b.note);
      return this.details(m, id, a);
    });
  }
  update(id: string, b: GradeWrite, a: GradeActor) {
    return this.write(a, async (m) => {
      const old = await this.lockResult(m, id, a);
      if (old.revision !== b.revision)
        throw new ConflictException("Bảng điểm vừa thay đổi. Hãy tải lại.");
      if (old.state === "LEGACY")
        throw new ConflictException(
          "Kết quả cũ không có điểm thành phần; dùng điều chỉnh theo hồ sơ.",
        );
      if (old.state === "VOIDED")
        throw new ConflictException("Bảng điểm đã hủy; mở lại trước khi nhập.");
      await this.registration(
        m,
        old.registrationId,
        a,
        old.state === "FINALIZED",
      );
      const policy = await this.getPolicy(m, old.offeringId, true);
      const total = calculateGrade(b, policy);
      if (old.state === "FINALIZED" && total === null)
        throw new BadRequestException(
          "Điểm đã chốt phải đủ các thành phần có trọng số.",
        );
      await m.query(
        "UPDATE grade_details SET attendance_score=?,midterm_score=?,exam_score=?,total_score=? WHERE result_id=?",
        [
          b.attendanceScore ?? null,
          b.midtermScore ?? null,
          b.examScore ?? null,
          total,
          id,
        ],
      );
      if (old.state === "FINALIZED")
        await this.publish(m, id, total, policy.passingScore, a);
      else
        await m.query(
          "UPDATE student_course_results SET revision=revision+1,recorded_by=? WHERE id=?",
          [a.id, id],
        );
      const item = await this.get(m, id, a);
      await this.audit(
        m,
        a,
        old.state === "FINALIZED" ? "GRADE_CORRECT" : "GRADE_UPDATE",
        item,
        old,
        b.reference,
        b.note,
      );
      return this.details(m, id, a);
    });
  }
  private async publish(
    m: EntityManager,
    id: string,
    total: number,
    passing: number,
    a: GradeActor,
  ) {
    await m.query(
      "UPDATE student_course_results SET result_status=?,grade=?,passed_at=IF(?=1,COALESCE(passed_at,UTC_TIMESTAMP(6)),NULL),recorded_by=?,revision=revision+1 WHERE id=?",
      [
        total >= passing ? "PASSED" : "FAILED",
        total.toFixed(2),
        total >= passing ? 1 : 0,
        a.id,
        id,
      ],
    );
  }
  action(id: string, action: string, b: GradeWrite, a: GradeActor) {
    return this.write(a, async (m) => {
      const old = await this.lockResult(m, id, a);
      if (old.revision !== b.revision)
        throw new ConflictException("Bảng điểm vừa thay đổi. Hãy tải lại.");
      if (old.state === "LEGACY")
        throw new ConflictException("Dùng điều chỉnh kết quả cũ theo hồ sơ.");
      if (action === "finalize") {
        if (old.state !== "DRAFT")
          throw new ConflictException("Chỉ chốt bảng điểm nháp.");
        await this.registration(m, old.registrationId, a, true);
        const policy = await this.getPolicy(m, old.offeringId, true);
        const total = calculateGrade(old, policy);
        if (total === null)
          throw new BadRequestException(
            "Chưa đủ các thành phần có trọng số để chốt.",
          );
        await m.query(
          "UPDATE grade_details SET state='FINALIZED',total_score=?,finalized_at=UTC_TIMESTAMP(6) WHERE result_id=?",
          [total, id],
        );
        await this.publish(m, id, total, policy.passingScore, a);
      } else if (action === "void") {
        if (old.state === "VOIDED")
          throw new ConflictException("Bảng điểm đã hủy.");
        await m.query(
          "UPDATE grade_details SET state='VOIDED',finalized_at=NULL WHERE result_id=?",
          [id],
        );
        await m.query(
          "UPDATE student_course_results SET result_status='INCOMPLETE',grade=NULL,passed_at=NULL,recorded_by=?,revision=revision+1 WHERE id=?",
          [a.id, id],
        );
      } else if (action === "reopen") {
        if (old.state !== "VOIDED")
          throw new ConflictException("Chỉ mở lại bảng điểm đã hủy.");
        await this.registration(m, old.registrationId, a);
        await m.query(
          "UPDATE grade_details SET state='DRAFT',attendance_score=NULL,midterm_score=NULL,exam_score=NULL,total_score=NULL WHERE result_id=?",
          [id],
        );
        await m.query(
          "UPDATE student_course_results SET revision=revision+1,recorded_by=? WHERE id=?",
          [a.id, id],
        );
      } else throw new BadRequestException("Thao tác không hợp lệ.");
      const item = await this.get(m, id, a);
      await this.audit(
        m,
        a,
        "GRADE_" + action.toUpperCase(),
        item,
        old,
        b.reference,
        b.note,
      );
      return this.details(m, id, a);
    });
  }
  legacy(id: string, b: LegacyWrite, a: GradeActor) {
    return this.write(a, async (m) => {
      const old = await this.lockResult(m, id, a);
      if (old.revision !== b.revision)
        throw new ConflictException("Kết quả vừa thay đổi. Hãy tải lại.");
      if (old.state !== "LEGACY")
        throw new ConflictException(
          "Bảng điểm có thành phần phải điều chỉnh theo quy tắc đã lưu.",
        );
      await m.query(
        "UPDATE student_course_results SET grade=?,result_status=?,passed_at=IF(? IS NULL,NULL,DATE_SUB(CAST(? AS DATETIME),INTERVAL 7 HOUR)),recorded_by=?,revision=revision+1 WHERE id=?",
        [
          b.grade?.trim() || null,
          b.resultStatus,
          b.passedDate || null,
          b.passedDate || null,
          a.id,
          id,
        ],
      );
      const item = await this.get(m, id, a);
      await this.audit(
        m,
        a,
        "GRADE_LEGACY_CORRECT",
        item,
        old,
        b.reference,
        b.note,
      );
      return this.details(m, id, a);
    });
  }
}
