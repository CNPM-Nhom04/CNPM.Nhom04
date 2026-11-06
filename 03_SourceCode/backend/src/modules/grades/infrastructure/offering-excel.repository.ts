import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { GradeActor } from "../domain/grade";

export interface OfferingInput {
  code: string;
  courseVersionId: string;
  termId: string;
  capacity: number;
  status: string;
  reason: string;
  reference: string;
}
const ACCESS =
  "EXISTS(SELECT 1 FROM vw_user_course_access ca WHERE ca.user_id=? AND ca.course_id=c.id)";
const FROM = ` FROM course_offerings co JOIN course_versions cv ON cv.id=co.course_version_id
 JOIN courses c ON c.id=cv.course_id JOIN registration_periods rp ON rp.id=co.registration_period_id`;
export class OfferingExcelRepository {
  constructor(private readonly db: DataSource) {}
  async options(actor: GradeActor) {
    return {
      courses: await this.db.query(
        `SELECT CAST(cv.id AS CHAR) id,c.course_code code,cv.course_name name,cv.version_no version
        FROM course_versions cv JOIN courses c ON c.id=cv.course_id
        WHERE c.status='ACTIVE' AND cv.status='ACTIVE' AND ${ACCESS}
        AND cv.effective_from<=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)
        AND (cv.effective_to IS NULL OR cv.effective_to>=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)) ORDER BY c.course_code,cv.version_no`,
        [actor.id],
      ),
      terms: await this.db.query(
        "SELECT CAST(id AS CHAR) id,academic_year year,semester FROM academic_terms ORDER BY id DESC",
      ),
    };
  }
  list(actor: GradeActor) {
    return this.db.query(
      `SELECT CAST(co.id AS CHAR) id,co.class_code code,CAST(co.course_version_id AS CHAR) courseVersionId,
      CAST(rp.academic_term_id AS CHAR) termId,co.capacity,co.status,
      (SELECT COUNT(*) FROM course_registrations cr WHERE cr.course_offering_id=co.id AND cr.status='REGISTERED') enrolled,
      rp.status periodStatus` +
        FROM +
        ` WHERE ${ACCESS} ORDER BY co.id`,
      [actor.id],
    );
  }
  lock(actor: GradeActor) {
    return this.db
      .query(
        `SELECT co.id` + FROM + ` WHERE ${ACCESS} ORDER BY co.id FOR UPDATE`,
        [actor.id],
      )
      .then(() => {});
  }
  validate(input: OfferingInput) {
    if (
      !/^[A-Za-z0-9_.-]{1,50}$/.test(input.code || "") ||
      ![input.courseVersionId, input.termId].every((v) =>
        /^[1-9]\d{0,19}$/.test(v || ""),
      ) ||
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > 10000 ||
      ![
        "PLANNED",
        "OPEN",
        "CLOSED",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
      ].includes(input.status)
    )
      throw new BadRequestException(
        "Chọn học phần/học kỳ hợp lệ; mã lớp tối đa 50 ký tự và sĩ số là số nguyên 1–10000.",
      );
    if (
      (input.reason || "").trim().length < 10 ||
      input.reason.length > 700 ||
      !(input.reference || "").trim() ||
      input.reference.length > 255
    )
      throw new BadRequestException(
        "Điền lý do 10–700 ký tự và số hồ sơ tối đa 255 ký tự.",
      );
    return input;
  }
  async save(input: OfferingInput, id: string | null, actor: GradeActor) {
    this.validate(input);
    return this.db.transaction("READ COMMITTED", async (m) => {
      const [allowed] = await m.query(
        `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
        AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code='TRAINING_OFFICER')
        AND 3=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN ('GRADE_READ','GRADE_MANAGE','REGISTRATION_MANAGE')) FOR UPDATE`,
        [actor.id],
      );
      if (!allowed)
        throw new ForbiddenException(
          "Cần quyền quản lý điểm và lập danh sách học.",
        );
      const [course] = await m.query(
        `SELECT cv.id,cv.status versionStatus,c.status courseStatus,(cv.effective_from<=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR) AND (cv.effective_to IS NULL OR cv.effective_to>=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR))) effective FROM course_versions cv JOIN courses c ON c.id=cv.course_id WHERE cv.id=? AND ${ACCESS} FOR UPDATE`,
        [input.courseVersionId, actor.id],
      );
      if (!course)
        throw new ForbiddenException("Học phần không thuộc phạm vi tài khoản.");
      const [term] = await m.query(
        "SELECT id,start_date startDate,end_date endDate,status FROM academic_terms WHERE id=? FOR UPDATE",
        [input.termId],
      );
      if (!term) throw new BadRequestException("Học kỳ không tồn tại.");
      let periodId: string;
      let before: Record<string, unknown> | null = null;
      if (id) {
        const [old] = await m.query(
          `SELECT co.*,CAST(rp.academic_term_id AS CHAR) termId,rp.status periodStatus` +
            FROM +
            ` WHERE co.id=? AND ${ACCESS} FOR UPDATE`,
          [id, actor.id],
        );
        if (!old)
          throw new ConflictException(
            "Lớp học phần đã bị xóa hoặc ngoài phạm vi.",
          );
        if (
          String(old.course_version_id) !== input.courseVersionId ||
          old.termId !== input.termId ||
          old.class_code !== input.code
        )
          throw new BadRequestException(
            "Không đổi mã, môn hoặc học kỳ của lớp học phần đã có.",
          );
        if (
          ["CANCELLED", "COMPLETED"].includes(old.status) &&
          old.status !== input.status
        )
          throw new ConflictException(
            "Lớp đã hoàn tất hoặc đã hủy, không mở lại bằng mẫu cấu hình.",
          );
        if (["CANCELLED", "FINALIZED"].includes(old.periodStatus))
          throw new ConflictException("Hồ sơ học kỳ đã khóa hoặc hủy.");
        const [count] = await m.query(
          "SELECT COUNT(*) n FROM course_registrations WHERE course_offering_id=? AND status='REGISTERED'",
          [id],
        );
        if (input.capacity < Number(count.n))
          throw new ConflictException(
            "Sĩ số tối đa không được nhỏ hơn số học viên đang có.",
          );
        if (input.status === "CANCELLED" && Number(count.n))
          throw new ConflictException("Lớp còn học viên, không thể hủy.");
        before = old;
        periodId = String(old.registration_period_id);
        await m.query(
          "UPDATE course_offerings SET capacity=?,status=? WHERE id=?",
          [input.capacity, input.status, id],
        );
      } else {
        if (input.status !== "OPEN")
          throw new BadRequestException(
            "Lớp học phần mới phải ở trạng thái Đang giảng dạy.",
          );
        if (
          course.versionStatus !== "ACTIVE" ||
          !Number(course.effective) ||
          course.courseStatus !== "ACTIVE" ||
          term.status !== "ACTIVE"
        )
          throw new ConflictException(
            "Chọn học phần và học kỳ đang hoạt động.",
          );
        const [period] = await m.query(
          "SELECT CAST(id AS CHAR) id FROM registration_periods WHERE academic_term_id=? AND status IN ('OPEN','CLOSED') ORDER BY id LIMIT 1 FOR UPDATE",
          [input.termId],
        );
        periodId = period?.id;
        if (!periodId) {
          if (
            !term.startDate ||
            !term.endDate ||
            new Date(term.endDate).getTime() <=
              new Date(term.startDate).getTime()
          )
            throw new BadRequestException(
              "Học kỳ cần có ngày bắt đầu và ngày kết thúc hợp lệ.",
            );
          const r = await m.query(
            "INSERT INTO registration_periods(academic_term_id,period_code,period_name,open_at,close_at,status,created_by) VALUES(?,?,?,?,?,'CLOSED',?)",
            [
              input.termId,
              "GRADE_TERM_" + input.termId,
              "Danh sách học và điểm học kỳ",
              term.startDate,
              term.endDate,
              actor.id,
            ],
          );
          periodId = String(r.insertId);
        }
        const result = await m.query(
          "INSERT INTO course_offerings(registration_period_id,course_version_id,class_code,capacity,status,created_by) VALUES(?,?,?,?,'OPEN',?)",
          [
            periodId,
            input.courseVersionId,
            input.code,
            input.capacity,
            actor.id,
          ],
        );
        id = String(result.insertId);
      }
      await m.query(
        "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,old_value,new_value,reason,ip_address) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          actor.id,
          actor.username,
          before ? "UPDATE" : "CREATE",
          "course_offering",
          id,
          before ? JSON.stringify(before) : null,
          JSON.stringify(input),
          input.reason + " · " + input.reference,
          actor.ip,
        ],
      );
      return { id, periodId };
    });
  }
}
