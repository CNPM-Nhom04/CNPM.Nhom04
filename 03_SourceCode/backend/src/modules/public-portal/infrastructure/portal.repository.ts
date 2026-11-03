import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DataSource, EntityManager } from "typeorm";
import {
  PortalActor,
  PortalQuery,
  PortalRepository,
  PublicDocumentInput,
  SubscriptionInput,
} from "../domain/portal";
const PROGRAM_FROM = ` FROM program_versions v JOIN training_programs p ON p.id=v.program_id
 JOIN majors m ON m.id=p.major_id JOIN organizational_units u ON u.id=p.managing_unit_id
 JOIN education_levels e ON e.id=p.education_level_id LEFT JOIN program_ui_details d ON d.program_version_id=v.id`;
const PUBLIC_PROGRAM = `v.status='PUBLISHED' AND p.status='ACTIVE' AND m.status='ACTIVE' AND u.status='ACTIVE' AND e.status='ACTIVE' AND e.level_code IN('MASTER','DOCTOR','PHD')`;
const PROGRAM_SELECT =
  `SELECT CAST(v.id AS CHAR) id,p.program_code code,v.version_code versionCode,v.program_name_snapshot name,
 v.cohort_year cohortYear,e.level_code levelCode,e.level_name levelName,CAST(e.id AS CHAR) levelId,m.major_name majorName,u.unit_name unitName,
 d.study_form studyForm,d.duration_label duration, d.description description,
 DATE_FORMAT(v.effective_from,'%Y-%m-%d') effectiveFrom,DATE_FORMAT(v.effective_to,'%Y-%m-%d') effectiveTo,
 d.decision_number decisionNumber,DATE_FORMAT(d.decision_date,'%Y-%m-%d') decisionDate` +
  PROGRAM_FROM;
const DOC_SELECT = `SELECT CAST(id AS CHAR) id,title,category,summary,document_url documentUrl,reference_number referenceNumber,
 DATE_FORMAT(issued_on,'%Y-%m-%d') issuedOn,status,revision,DATE_FORMAT(updated_at,'%Y-%m-%d %H:%i:%s.%f') updatedAt FROM public_documents`;
function page(data, total: number, q: PortalQuery) {
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
export class MysqlPortalRepository extends PortalRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  async options() {
    const levels = await this.db.query(
      "SELECT CAST(id AS CHAR) id,level_code code,level_name name FROM education_levels WHERE status='ACTIVE' ORDER BY id",
    );
    const majors = await this.db.query(
      "SELECT CAST(m.id AS CHAR) id,m.major_code code,m.major_name name,u.unit_name unitName FROM majors m JOIN organizational_units u ON u.id=m.organizational_unit_id WHERE m.status='ACTIVE' AND u.status='ACTIVE' ORDER BY m.major_name",
    );
    return { levels, majors };
  }
  private async viewer(manager: EntityManager, viewerId?: string) {
    if (!viewerId)
      return { mode: "PUBLIC", facultyId: null, facultyName: null };
    const [user] = await manager.query(
      `SELECT u.account_status,u.deleted_at,
      COALESCE(u.organizational_unit_id,(SELECT s.organizational_unit_id FROM students s WHERE s.user_id=u.id)) unitId,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_code='ADMIN' AND r.status='ACTIVE') isAdmin
      FROM users u WHERE u.id=?`,
      [viewerId],
    );
    if (!user || user.account_status !== "ACTIVE" || user.deleted_at)
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    if (!user.unitId && Number(user.isAdmin))
      return { mode: "ADMIN_ALL", facultyId: null, facultyName: null };
    const [faculty] = user.unitId
      ? await manager.query(
          `SELECT CAST(f.id AS CHAR) id,f.unit_name name FROM organizational_unit_closure oc
      JOIN organizational_units f ON f.id=oc.ancestor_id WHERE oc.descendant_id=? AND f.unit_type='FACULTY' AND f.status='ACTIVE'
      ORDER BY oc.depth,f.id LIMIT 1`,
          [user.unitId],
        )
      : [];
    return faculty
      ? { mode: "FACULTY", facultyId: faculty.id, facultyName: faculty.name }
      : { mode: "UNASSIGNED", facultyId: null, facultyName: null };
  }
  private facultyFilter(view: { mode: string; facultyId: string | null }) {
    if (view.mode === "UNASSIGNED")
      return { sql: " AND 1=0", params: [] as string[] };
    if (view.mode === "FACULTY")
      return {
        sql: " AND EXISTS(SELECT 1 FROM organizational_unit_closure fc WHERE fc.ancestor_id=? AND fc.descendant_id=p.managing_unit_id)",
        params: [view.facultyId!],
      };
    return { sql: "", params: [] as string[] };
  }
  async programs(q: PortalQuery, viewerId?: string) {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const view = await this.viewer(manager, viewerId),
        scope = this.facultyFilter(view);
      const search = q.search || "",
        level = q.levelId || "",
        code = q.levelCode || "";
      const where = ` WHERE ${PUBLIC_PROGRAM} ${scope.sql} AND (?='' OR p.education_level_id=?)
        AND (?='' OR (?='MASTER' AND e.level_code='MASTER') OR (?='DOCTOR' AND e.level_code IN('DOCTOR','PHD')))
        AND (?='' OR LOCATE(?,v.program_name_snapshot)>0 OR LOCATE(?,p.program_code)>0 OR LOCATE(?,m.major_name)>0)`;
      const params = [
        ...scope.params,
        level,
        level,
        code,
        code,
        code,
        search,
        search,
        search,
        search,
      ];
      const data = await manager.query(
        PROGRAM_SELECT +
          where +
          " ORDER BY v.cohort_year DESC,v.id DESC LIMIT ? OFFSET ?",
        [...params, q.limit, (q.page - 1) * q.limit],
      );
      const [count] = await manager.query(
        "SELECT COUNT(*) total" + PROGRAM_FROM + where,
        params,
      );
      return { ...page(data, Number(count.total), q), view };
    });
  }
  program(id: string, viewerId?: string) {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const view = await this.viewer(manager, viewerId),
        scope = this.facultyFilter(view);
      const [item] = await manager.query(
        PROGRAM_SELECT + ` WHERE v.id=? AND ${PUBLIC_PROGRAM}` + scope.sql,
        [id, ...scope.params],
      );
      if (!item)
        throw new NotFoundException(
          "Chương trình chưa công bố hoặc không thuộc khoa của tài khoản.",
        );
      const tracks = await manager.query(
        "SELECT CAST(id AS CHAR) id,track_code_snapshot code,track_name_snapshot name,required_total_credits credits FROM program_version_tracks WHERE program_version_id=? AND status='ACTIVE' ORDER BY id",
        [id],
      );
      for (const track of tracks) {
        track.credits = Number(track.credits);
        track.groups = await manager.query(
          "SELECT CAST(id AS CHAR) id,group_code code,group_name name,minimum_credits minimumCredits,maximum_credits maximumCredits FROM curriculum_groups WHERE program_version_track_id=? ORDER BY display_order,id",
          [track.id],
        );
        track.courses = await manager.query(
          `SELECT CAST(cc.id AS CHAR) id,c.course_code code,cv.course_name name,cv.version_no versionNo,cv.credits,cv.theory_hours theoryHours,cv.practice_hours practiceHours,g.group_code groupCode,cc.requirement_type requirementType,cc.suggested_semester semester,
     (SELECT GROUP_CONCAT(pc.course_code ORDER BY cp.id SEPARATOR ', ') FROM curriculum_prerequisites cp JOIN curriculum_courses pre ON pre.id=cp.prerequisite_curriculum_course_id JOIN courses pc ON pc.id=pre.course_id WHERE cp.curriculum_course_id=cc.id) prerequisites
     FROM curriculum_courses cc JOIN courses c ON c.id=cc.course_id JOIN course_versions cv ON cv.id=cc.course_version_id JOIN curriculum_groups g ON g.id=cc.curriculum_group_id WHERE cc.program_version_track_id=? ORDER BY cc.display_order,cc.id`,
          [track.id],
        );
      }
      return { ...item, tracks, view };
    });
  }
  async documents(q: PortalQuery, admin = false) {
    const search = q.search || "",
      category = q.category || "ALL",
      status = admin ? q.status || "ALL" : "PUBLISHED";
    const where =
      " WHERE (?='ALL' OR status=?) AND (?='ALL' OR category=?) AND (?='' OR LOCATE(?,title)>0 OR LOCATE(?,COALESCE(reference_number,''))>0)";
    const params = [status, status, category, category, search, search, search];
    const data = await this.db.query(
      DOC_SELECT + where + " ORDER BY issued_on DESC,id DESC LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total FROM public_documents" + where,
      params,
    );
    return page(data, Number(count.total), q);
  }
  private write<T>(
    actor: PortalActor,
    action: (manager: EntityManager) => Promise<T>,
  ) {
    return this.db.transaction(async (manager) => {
      const [authorized] = await manager.query(
        `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0 AND r.role_code='ADMIN' AND r.status='ACTIVE' AND EXISTS(SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=r.id AND p.permission_code='MASTERDATA_MANAGE') FOR UPDATE`,
        [actor.id],
      );
      if (!authorized)
        throw new ForbiddenException(
          "Tài khoản không còn quyền quản trị cổng thông tin.",
        );
      return action(manager);
    });
  }
  private async audit(
    manager: EntityManager,
    actor: PortalActor,
    action: string,
    entity: string,
    id: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await manager.query(
      "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,old_value,new_value,ip_address) VALUES(?,?,?,?,?,?,?,?)",
      [
        actor.id,
        actor.username,
        action,
        entity,
        id,
        oldValue == null ? null : JSON.stringify(oldValue),
        newValue == null ? null : JSON.stringify(newValue),
        actor.ip,
      ],
    );
  }
  async saveDocument(
    id: string | null,
    input: PublicDocumentInput,
    actor: PortalActor,
  ) {
    return this.write(actor, async (manager) => {
      const [old] = id
        ? await manager.query(
            "SELECT * FROM public_documents WHERE id=? FOR UPDATE",
            [id],
          )
        : [];
      if (id && !old) throw new NotFoundException("Không tìm thấy văn bản.");
      if (old && Number(old.revision) !== input.revision)
        throw new ConflictException(
          "Văn bản đã thay đổi. Tải lại trước khi sửa.",
        );
      const values = [
        input.title,
        input.category,
        input.summary,
        input.documentUrl,
        input.referenceNumber || null,
        input.issuedOn || null,
        input.status,
        actor.id,
      ];
      if (old)
        await manager.query(
          "UPDATE public_documents SET title=?,category=?,summary=?,document_url=?,reference_number=?,issued_on=?,status=?,updated_by=?,revision=revision+1 WHERE id=?",
          [...values, id],
        );
      else {
        const saved = await manager.query(
          "INSERT INTO public_documents(title,category,summary,document_url,reference_number,issued_on,status,updated_by) VALUES(?,?,?,?,?,?,?,?)",
          values,
        );
        id = String(saved.insertId);
      }
      const [item] = await manager.query(DOC_SELECT + " WHERE id=?", [id]);
      await this.audit(
        manager,
        actor,
        old ? "UPDATE" : "CREATE",
        "public_document",
        id!,
        old,
        item,
      );
      return item;
    });
  }
  deleteDocument(id: string, revision: number, actor: PortalActor) {
    return this.write(actor, async (manager) => {
      const [old] = await manager.query(
        "SELECT * FROM public_documents WHERE id=? FOR UPDATE",
        [id],
      );
      if (!old) throw new NotFoundException("Không tìm thấy văn bản.");
      if (Number(old.revision) !== revision)
        throw new ConflictException(
          "Văn bản đã thay đổi. Tải lại trước khi xóa.",
        );
      await manager.query("DELETE FROM public_documents WHERE id=?", [id]);
      await this.audit(
        manager,
        actor,
        "DELETE",
        "public_document",
        id,
        old,
        null,
      );
      return { message: "Đã xóa văn bản khỏi cổng thông tin." };
    });
  }
  async subscribe(input: SubscriptionInput) {
    await this.db.transaction(async (manager) => {
      const [level] = await manager.query(
        "SELECT id,level_name FROM education_levels WHERE id=? AND status='ACTIVE' LOCK IN SHARE MODE",
        [input.levelId],
      );
      if (!level)
        throw new BadRequestException(
          "Bậc đào tạo đã ngừng hoạt động hoặc không tồn tại.",
        );
      const [major] = input.majorId
        ? await manager.query(
            "SELECT m.id,m.major_name FROM majors m JOIN organizational_units u ON u.id=m.organizational_unit_id WHERE m.id=? AND m.status='ACTIVE' AND u.status='ACTIVE' LOCK IN SHARE MODE",
            [input.majorId],
          )
        : [];
      if (input.majorId && !major)
        throw new BadRequestException(
          "Ngành quan tâm đã ngừng hoạt động hoặc không tồn tại.",
        );
      const email = input.email.toLowerCase();
      const fingerprint = createHash("sha256")
        .update(email + ":" + input.levelId + ":" + (input.majorId || "0"))
        .digest("hex");
      await manager.query(
        `INSERT INTO admission_subscriptions(fingerprint,family_name,given_name,email,phone,gender,education_level_id,level_name_snapshot,major_id,major_name_snapshot,previous_major,graduation_year,message) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`,
        [
          fingerprint,
          input.familyName,
          input.givenName,
          email,
          input.phone,
          input.gender || null,
          input.levelId,
          level.level_name,
          input.majorId || null,
          major?.major_name || null,
          input.previousMajor || null,
          input.graduationYear || null,
          input.message || null,
        ],
      );
    });
  }
  async subscriptions(q: PortalQuery) {
    const search = q.search || "",
      status = q.status || "ALL";
    if (!["ALL", "NEW", "CONTACTED"].includes(status))
      throw new BadRequestException("Trạng thái đăng ký không hợp lệ.");
    const where =
      " WHERE (?='ALL' OR status=?) AND (?='' OR LOCATE(?,email)>0 OR LOCATE(?,phone)>0 OR LOCATE(?,CONCAT(family_name,' ',given_name))>0)";
    const params = [status, status, search, search, search, search];
    const data = await this.db.query(
      `SELECT CAST(id AS CHAR) id,CONCAT(family_name,' ',given_name) fullName,email,phone,gender,level_name_snapshot levelName,major_name_snapshot majorName,previous_major previousMajor,graduation_year graduationYear,message,status,revision,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') createdAt,DATE_FORMAT(consented_at,'%Y-%m-%d %H:%i:%s') consentedAt FROM admission_subscriptions` +
        where +
        " ORDER BY id DESC LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total FROM admission_subscriptions" + where,
      params,
    );
    return page(data, Number(count.total), q);
  }
  contact(id: string, revision: number, actor: PortalActor) {
    return this.write(actor, async (manager) => {
      const [old] = await manager.query(
        "SELECT id,status,revision FROM admission_subscriptions WHERE id=? FOR UPDATE",
        [id],
      );
      if (!old) throw new NotFoundException("Không tìm thấy đăng ký.");
      if (Number(old.revision) !== revision)
        throw new ConflictException(
          "Đăng ký đã thay đổi. Tải lại trước khi cập nhật.",
        );
      await manager.query(
        "UPDATE admission_subscriptions SET status='CONTACTED',revision=revision+1 WHERE id=?",
        [id],
      );
      await this.audit(
        manager,
        actor,
        "UPDATE",
        "admission_subscription",
        id,
        old,
        { status: "CONTACTED" },
      );
      return { message: "Đã đánh dấu liên hệ." };
    });
  }
}
