import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "crypto";
import {
  CurriculumInput,
  DocumentInput,
  ProgramActor,
  ProgramInput,
  ProgramItem,
  ProgramQuery,
  ProgramRepository,
  ProgramTrack,
  ReviewInput,
  STATUS_LABELS,
} from "../domain/program";
import { validateCurriculum } from "../domain/validate-curriculum";

const REAL_PROGRAM = `NOT EXISTS (SELECT 1 FROM program_test_fixtures fixture WHERE fixture.program_code=p.program_code)`;
const SCOPE = `EXISTS (SELECT 1 FROM user_scopes us WHERE us.user_id=? AND (
 us.scope_type='GLOBAL' OR (us.scope_type='PROGRAM' AND us.program_id=p.id)
 OR (us.scope_type='MAJOR' AND us.major_id=p.major_id)
 OR (us.scope_type='ORG_UNIT' AND EXISTS (SELECT 1 FROM organizational_unit_closure oc
   WHERE oc.ancestor_id=us.organizational_unit_id AND oc.descendant_id=p.managing_unit_id))))`;
const FROM = ` FROM program_versions v JOIN training_programs p ON p.id=v.program_id
 JOIN education_levels e ON e.id=p.education_level_id JOIN organizational_units u ON u.id=p.managing_unit_id
 JOIN majors m ON m.id=p.major_id LEFT JOIN program_ui_details d ON d.program_version_id=v.id`;
const SELECT =
  `SELECT CAST(v.id AS CHAR) AS id, CAST(p.id AS CHAR) AS programId,
 p.program_code AS maCTDT, v.version_code AS maPhienBan, v.cohort_year AS cohortYear,
 CAST(v.source_program_version_id AS CHAR) AS sourceVersionId,
 (SELECT source.version_code FROM program_versions source WHERE source.id=v.source_program_version_id) AS sourceVersionCode,
 v.status_reason AS statusReason, DATE_FORMAT(v.effective_from,'%Y-%m-%d') AS effectiveFrom,
 DATE_FORMAT(v.effective_to,'%Y-%m-%d') AS effectiveTo, v.created_at AS createdAt,
 v.submitted_at AS submittedAt,v.published_at AS publishedAt,v.archived_at AS archivedAt,
 v.retired_at AS retiredAt,v.locked_at AS lockedAt,CAST(v.created_by AS CHAR) AS createdBy,
 (SELECT full_name FROM users WHERE id=v.created_by) AS createdByName,
 (d.program_version_id IS NOT NULL) AS hasExtendedInfo,
 v.program_name_snapshot AS tenCTDT, COALESCE(d.english_name,'') AS tenTiengAnh,
 CAST(p.education_level_id AS CHAR) AS educationLevelId, CAST(p.managing_unit_id AS CHAR) AS managingUnitId,
 CAST(p.major_id AS CHAR) AS majorId, e.level_name AS levelName, u.unit_name AS unitName, m.major_name AS majorName,
 COALESCE(d.study_form,'') AS hinhThucDaoTao, COALESCE(d.duration_label,'') AS thoiGianDaoTao,
 COALESCE(d.cohort_label, CAST(v.cohort_year AS CHAR)) AS khoaTuyenSinh,
 COALESCE(d.required_total_credits,(SELECT MAX(required_total_credits) FROM program_version_tracks WHERE program_version_id=v.id),0) AS tongTinChiYeuCau,
 COALESCE(d.language_requirement,'') AS chuanDauRaTiengAnh, COALESCE(d.it_requirement,'') AS chuanDauRaTinHoc,
 COALESCE(d.decision_number,'') AS soQuyetDinhBanHanh, DATE_FORMAT(d.decision_date,'%Y-%m-%d') AS ngayBanHanh,
 COALESCE(d.description,p.description,'') AS moTa, COALESCE(d.revision,0) AS revision,
 v.status, v.updated_at AS updatedAt, e.min_total_credits AS minCredits, e.max_total_credits AS maxCredits,
 e.min_elective_ratio AS minElective, e.max_elective_ratio AS maxElective` +
  FROM;

@Injectable()
export class MysqlProgramRepository extends ProgramRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private map(row): ProgramItem {
    const { minCredits, maxCredits, minElective, maxElective, ...data } = row;
    return {
      ...data,
      id: String(row.id),
      programId: String(row.programId),
      revision: Number(row.revision),
      cohortYear: Number(row.cohortYear),
      hasExtendedInfo: !!Number(row.hasExtendedInfo),
      ...Object.fromEntries(
        [
          "createdAt",
          "submittedAt",
          "publishedAt",
          "archivedAt",
          "retiredAt",
          "lockedAt",
        ].map((key) => [
          key,
          row[key] instanceof Date
            ? row[key].toISOString()
            : (row[key] ?? null),
        ]),
      ),
      tongTinChiYeuCau: Number(row.tongTinChiYeuCau),
      statusLabel: STATUS_LABELS[row.status],
      ngayBanHanh: row.ngayBanHanh || undefined,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : row.updatedAt,
      rules: Object.fromEntries(
        Object.entries({
          minCredits,
          maxCredits,
          minElective,
          maxElective,
        }).map(([key, value]) => [key, value == null ? null : Number(value)]),
      ),
      tracks: [],
      documents: [],
      review: null,
      requestedBy: null,
    } as ProgramItem;
  }
  async list(query: ProgramQuery, actor: ProgramActor) {
    const search = query.searchTerm || "",
      status = query.selectedStatus || "ALL";
    const where = ` WHERE ${REAL_PROGRAM} AND ${SCOPE} AND (?='ALL' OR v.status=?) AND (?='' OR LOCATE(?,p.program_code)>0 OR LOCATE(?,v.program_name_snapshot)>0 OR LOCATE(?,v.version_code)>0)`;
    const params = [actor.id, status, status, search, search, search, search];
    const rows = await this.db.query(
      SELECT + where + " ORDER BY v.updated_at DESC,v.id DESC LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) AS total" + FROM + where,
      params,
    );
    const total = Number(count.total);
    const [unversioned] = await this.db.query(
      "SELECT COUNT(*) AS total FROM training_programs p WHERE " +
        REAL_PROGRAM +
        " AND " +
        SCOPE +
        " AND NOT EXISTS (SELECT 1 FROM program_versions v WHERE v.program_id=p.id)",
      [actor.id],
    );
    return {
      unversionedCount: Number(unversioned.total),
      data: rows.map((row) => this.map(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async unversioned(query: ProgramQuery, actor: ProgramActor) {
    const search = query.searchTerm || "";
    const from = ` FROM training_programs p JOIN education_levels e ON e.id=p.education_level_id
      JOIN organizational_units u ON u.id=p.managing_unit_id JOIN majors m ON m.id=p.major_id
      WHERE ${REAL_PROGRAM} AND ${SCOPE} AND NOT EXISTS(SELECT 1 FROM program_versions v WHERE v.program_id=p.id)
      AND (?='' OR LOCATE(?,p.program_code)>0 OR LOCATE(?,p.program_name)>0)`;
    const params = [actor.id, search, search, search];
    const rows = await this.db.query(
      `SELECT CAST(p.id AS CHAR) AS id,p.program_code AS maCTDT,
      p.program_name AS tenCTDT,e.level_name AS levelName,u.unit_name AS unitName,m.major_name AS majorName,
      p.status,p.description AS moTa` +
        from +
        " ORDER BY p.program_code LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) AS total" + from,
      params,
    );
    return {
      data: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total: Number(count.total),
        totalPages: Math.ceil(Number(count.total) / query.limit),
      },
    };
  }
  async baseProgram(id: string, actor: ProgramActor): Promise<ProgramInput> {
    const [row] = await this.db.query(
      `SELECT p.program_code AS maCTDT,p.program_name AS tenCTDT,
      CAST(p.education_level_id AS CHAR) AS educationLevelId,CAST(p.major_id AS CHAR) AS majorId,
      CAST(p.managing_unit_id AS CHAR) AS managingUnitId,COALESCE(p.description,'') AS moTa,
      e.min_total_credits AS defaultCredits FROM training_programs p JOIN education_levels e ON e.id=p.education_level_id
      WHERE p.id=? AND ${SCOPE}`,
      [id, actor.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy chương trình trong phạm vi được phân quyền.",
      );
    return {
      ...row,
      maPhienBan: "v1",
      tenTiengAnh: "",
      hinhThucDaoTao: "",
      thoiGianDaoTao: "",
      khoaTuyenSinh: "",
      tongTinChiYeuCau: Number(row.defaultCredits || 0),
      chuanDauRaTiengAnh: "",
      chuanDauRaTinHoc: "",
      soQuyetDinhBanHanh: "",
    };
  }
  async options() {
    const levels = await this.db.query(
      "SELECT CAST(id AS CHAR) AS id,level_name AS name,level_code AS code,min_total_credits AS minCredits,max_total_credits AS maxCredits FROM education_levels WHERE status='ACTIVE' ORDER BY id",
    );
    const units = await this.db.query(
      "SELECT CAST(id AS CHAR) AS id,unit_name AS name FROM organizational_units WHERE status='ACTIVE' ORDER BY unit_name",
    );
    const rows = await this.db
      .query(`SELECT CAST(m.id AS CHAR) AS id,m.major_name AS name,
      GROUP_CONCAT(CAST(oc.ancestor_id AS CHAR)) AS unitIds FROM majors m
      JOIN organizational_unit_closure oc ON oc.descendant_id=m.organizational_unit_id
      WHERE m.status='ACTIVE' GROUP BY m.id,m.major_name ORDER BY m.major_name`);
    return {
      levels,
      units,
      majors: rows.map((row) => ({ ...row, unitIds: row.unitIds.split(",") })),
    };
  }
  async catalog(query: ProgramQuery) {
    const search = query.searchTerm || "";
    const where =
      " FROM course_versions cv JOIN courses c ON c.id=cv.course_id WHERE cv.status='ACTIVE' AND c.status='ACTIVE' AND (?='' OR LOCATE(?,c.course_code)>0 OR LOCATE(?,cv.course_name)>0)";
    const data = await this.db.query(
      `SELECT CAST(cv.id AS CHAR) AS id,CAST(c.id AS CHAR) AS courseId,c.course_code AS code,cv.course_name AS name,cv.credits,cv.theory_hours AS theoryHours,cv.practice_hours AS practiceHours` +
        where +
        " ORDER BY c.course_code LIMIT ? OFFSET ?",
      [search, search, search, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.db.query("SELECT COUNT(*) AS total" + where, [
      search,
      search,
      search,
    ]);
    return {
      data: data.map((row) => ({ ...row, credits: Number(row.credits) })),
      meta: {
        page: query.page,
        limit: query.limit,
        total: Number(count.total),
        totalPages: Math.ceil(Number(count.total) / query.limit),
      },
    };
  }
  private async get(
    manager: EntityManager,
    id: string,
    actor: ProgramActor,
    lock = false,
  ): Promise<ProgramItem> {
    const [row] = await manager.query(
      SELECT + ` WHERE v.id=? AND ${SCOPE}` + (lock ? " FOR UPDATE" : ""),
      [id, actor.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy CTĐT trong phạm vi được phân quyền.",
      );
    const item = this.map(row);
    const tracks = await manager.query(
      "SELECT CAST(id AS CHAR) AS id,track_code_snapshot AS code,track_name_snapshot AS name,status,required_total_credits AS requiredCredits FROM program_version_tracks WHERE program_version_id=? ORDER BY id",
      [id],
    );
    for (const track of tracks) {
      const groups = await manager.query(
        "SELECT CAST(id AS CHAR) AS id,group_code AS code,group_name AS name,CAST(parent_group_id AS CHAR) AS parentId,minimum_credits AS minimumCredits,maximum_credits AS maximumCredits FROM curriculum_groups WHERE program_version_track_id=? ORDER BY display_order,id",
        [track.id],
      );
      const courses = await manager.query(
        `SELECT CAST(cc.id AS CHAR) AS id,CAST(cc.course_id AS CHAR) AS courseId,CAST(cc.course_version_id AS CHAR) AS courseVersionId,
       c.course_code AS code,cv.course_name AS name,cv.english_name AS englishName,cv.credits,cv.theory_hours AS theoryHours,
       cv.practice_hours AS practiceHours,cv.description,cv.version_no AS versionNumber,cc.notes,
       CAST(cc.curriculum_group_id AS CHAR) AS groupId,
       cc.requirement_type AS requirementType,cc.suggested_semester AS semester
       FROM curriculum_courses cc JOIN courses c ON c.id=cc.course_id JOIN course_versions cv ON cv.id=cc.course_version_id
       WHERE cc.program_version_track_id=? ORDER BY cc.display_order,cc.id`,
        [track.id],
      );
      const prerequisites = await manager.query(
        `SELECT CAST(cp.id AS CHAR) AS id,
        CAST(cp.curriculum_course_id AS CHAR) AS ownerId,CAST(cp.prerequisite_curriculum_course_id AS CHAR) AS courseEntryId,
        c.course_code AS code,cv.course_name AS name,cp.minimum_grade AS minimumGrade
        FROM curriculum_prerequisites cp JOIN curriculum_courses owner ON owner.id=cp.curriculum_course_id
        JOIN curriculum_courses required ON required.id=cp.prerequisite_curriculum_course_id
        JOIN courses c ON c.id=required.course_id JOIN course_versions cv ON cv.id=required.course_version_id
        WHERE owner.program_version_track_id=? ORDER BY cp.id`,
        [track.id],
      );
      const mappings = await manager.query(
        `SELECT CAST(cm.curriculum_course_id AS CHAR) AS ownerId,
        CAST(plo.id AS CHAR) AS ploId,plo.plo_code AS code,plo.description,cm.contribution_level AS contributionLevel
        FROM curriculum_course_plos cm JOIN program_learning_outcomes plo ON plo.id=cm.plo_id
        JOIN curriculum_courses cc ON cc.id=cm.curriculum_course_id
        WHERE cc.program_version_track_id=? ORDER BY plo.display_order,plo.id`,
        [track.id],
      );
      item.tracks.push({
        ...track,
        requiredCredits: Number(track.requiredCredits),
        groups: groups.map((group) => ({
          ...group,
          minimumCredits: Number(group.minimumCredits),
          maximumCredits:
            group.maximumCredits == null ? null : Number(group.maximumCredits),
        })),
        courses: courses.map((course) => ({
          ...course,
          credits: Number(course.credits),
          semester: course.semester == null ? null : Number(course.semester),
          theoryHours: Number(course.theoryHours),
          practiceHours: Number(course.practiceHours),
          versionNumber: Number(course.versionNumber),
          prerequisites: prerequisites
            .filter((entry) => entry.ownerId === course.id)
            .map(({ ownerId, ...entry }) => entry),
          ploMappings: mappings
            .filter((entry) => entry.ownerId === course.id)
            .map(({ ownerId, ...entry }) => entry),
        })),
      });
    }
    item.learningOutcomes = await manager.query(
      "SELECT CAST(id AS CHAR) AS id,plo_code AS code,description,status,display_order AS displayOrder FROM program_learning_outcomes WHERE program_version_id=? ORDER BY display_order,id",
      [id],
    );
    const requests = await manager.query(
      `SELECT CAST(ar.id AS CHAR) AS id,ar.request_no AS requestNo,
      ar.current_status AS status,CAST(ar.requested_by AS CHAR) AS requestedBy,
      u.full_name AS requesterName,ar.requested_at AS requestedAt,ar.completed_at AS completedAt,
      ar.latest_comment AS latestComment,rm.council_name AS hoiDongThamDinh,rm.chair_name AS chuTichHoidong,
      rm.secretary_name AS thuKhao,DATE_FORMAT(rm.meeting_date,'%Y-%m-%d') AS ngayHop,
      rm.conclusion AS ketLuan,rm.comments AS yKienDongGop,rm.minutes_number AS soBienBan
      FROM approval_requests ar JOIN users u ON u.id=ar.requested_by
      LEFT JOIN program_review_minutes rm ON rm.approval_request_id=ar.id
      WHERE ar.program_version_id=? ORDER BY ar.id DESC`,
      [id],
    );
    item.approvalHistory = [];
    for (const request of requests) {
      const actions = await manager.query(
        `SELECT CAST(a.id AS CHAR) AS id,a.action_type AS action,
        u.full_name AS actorName,a.comment_text AS comment,a.created_at AS createdAt
        FROM approval_actions a JOIN users u ON u.id=a.actor_id WHERE a.approval_request_id=? ORDER BY a.id`,
        [request.id],
      );
      const date = (value) =>
        value instanceof Date ? value.toISOString() : (value ?? null);
      item.approvalHistory.push({
        id: request.id,
        requestNo: request.requestNo,
        status: request.status,
        requestedBy: request.requestedBy,
        requesterName: request.requesterName,
        requestedAt: date(request.requestedAt),
        completedAt: date(request.completedAt),
        latestComment: request.latestComment,
        minutes: request.ketLuan
          ? {
              hoiDongThamDinh: request.hoiDongThamDinh,
              chuTichHoidong: request.chuTichHoidong,
              thuKhao: request.thuKhao,
              ngayHop: request.ngayHop,
              ketLuan: request.ketLuan,
              yKienDongGop: request.yKienDongGop || "",
              soBienBan: request.soBienBan || "",
            }
          : null,
        actions: actions.map((action) => ({
          ...action,
          createdAt: date(action.createdAt),
        })),
      });
    }
    item.documents = await manager.query(
      "SELECT CAST(id AS CHAR) AS id,original_name AS name,file_size AS size FROM program_review_documents WHERE program_version_id=? ORDER BY id",
      [id],
    );
    const [request] = await manager.query(
      `SELECT CAST(ar.requested_by AS CHAR) AS requestedBy,rm.council_name AS hoiDongThamDinh,
      rm.chair_name AS chuTichHoidong,rm.secretary_name AS thuKhao,DATE_FORMAT(rm.meeting_date,'%Y-%m-%d') AS ngayHop,
      rm.conclusion AS ketLuan,COALESCE(rm.comments,'') AS yKienDongGop,rm.minutes_number AS soBienBan
      FROM approval_requests ar LEFT JOIN program_review_minutes rm ON rm.approval_request_id=ar.id
      WHERE ar.program_version_id=? ORDER BY ar.id DESC LIMIT 1`,
      [id],
    );
    if (request) {
      item.requestedBy = request.requestedBy;
      if (request.ketLuan) {
        const { requestedBy, ...review } = request;
        item.review = review;
      }
    }
    return item;
  }
  detail(id: string, actor: ProgramActor) {
    return this.get(this.db.manager, id, actor);
  }
  private editable(item: ProgramItem, revision?: number) {
    if (!["DRAFT", "RETURNED"].includes(item.status))
      throw new ConflictException(
        "Chỉ bản nháp hoặc bản bị trả về mới được chỉnh sửa.",
      );
    this.revision(item, revision);
  }
  private revision(item: ProgramItem, revision?: number) {
    if (revision == null || item.revision !== revision)
      throw new ConflictException(
        "Dữ liệu đã thay đổi. Hãy tải lại trang trước khi lưu.",
      );
  }
  private async write<T>(
    actor: ProgramActor,
    permission: string,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (manager) => {
        const [user] = await manager.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL
          AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id
            JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code=?)`,
          [actor.id, permission],
        );
        if (!user)
          throw new ForbiddenException("Tài khoản không còn quyền thao tác.");
        return callback(manager);
      });
    } catch (error) {
      const code = error.driverError?.code || error.code;
      if (code === "ER_DUP_ENTRY")
        throw new ConflictException(
          "Mã CTĐT, phiên bản hoặc hồ sơ đang chờ đã tồn tại.",
        );
      if (
        [
          "ER_ROW_IS_REFERENCED_2",
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_CHECKREAD",
        ].includes(code)
      )
        throw new ConflictException(
          "Dữ liệu đang được sử dụng hoặc thay đổi đồng thời. Hãy tải lại và thử lại.",
        );
      if (code === "ER_SIGNAL_EXCEPTION")
        throw new ConflictException(
          "Thao tác bị chặn bởi quy tắc workflow hoặc dữ liệu đã khóa.",
        );
      throw error;
    }
  }
  private async audit(
    manager: EntityManager,
    actor: ProgramActor,
    action: string,
    item: ProgramItem,
  ) {
    await manager.query(
      `INSERT INTO audit_logs (actor_id,actor_username,action,entity_type,entity_id,scope_unit_id,new_value,reason,ip_address)
      VALUES (?,?,?,'program_version',?,?,?,?,?)`,
      [
        actor.id,
        actor.username,
        action,
        item.id,
        item.managingUnitId,
        JSON.stringify({
          code: item.maCTDT,
          status: item.status,
          revision: item.revision,
        }),
        action + " CTĐT " + item.maCTDT,
        actor.ip,
      ],
    );
  }
  private cohort(input: ProgramInput): number {
    const [start, end] = input.khoaTuyenSinh
      .split("-")
      .map((value) => Number(value.trim()));
    if (start < 1900 || end > 2200 || start > end)
      throw new BadRequestException(
        "Niên khóa phải trong 1900–2200 và năm kết thúc không nhỏ hơn năm bắt đầu.",
      );
    return start;
  }
  private async saveMetadata(
    manager: EntityManager,
    id: string,
    input: ProgramInput,
  ) {
    await manager.query(
      `INSERT INTO program_ui_details
      (program_version_id,english_name,study_form,duration_label,cohort_label,required_total_credits,language_requirement,it_requirement,decision_number,decision_date,description,revision)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE english_name=VALUES(english_name),study_form=VALUES(study_form),
      duration_label=VALUES(duration_label),cohort_label=VALUES(cohort_label),required_total_credits=VALUES(required_total_credits),
      language_requirement=VALUES(language_requirement),it_requirement=VALUES(it_requirement),decision_number=VALUES(decision_number),
      decision_date=VALUES(decision_date),description=VALUES(description),revision=revision+1`,
      [
        id,
        input.tenTiengAnh,
        input.hinhThucDaoTao,
        input.thoiGianDaoTao,
        input.khoaTuyenSinh,
        input.tongTinChiYeuCau,
        input.chuanDauRaTiengAnh,
        input.chuanDauRaTinHoc,
        input.soQuyetDinhBanHanh,
        input.ngayBanHanh || null,
        input.moTa,
      ],
    );
  }
  private async bump(manager: EntityManager, item: ProgramItem) {
    await manager.query(
      `INSERT INTO program_ui_details (program_version_id,cohort_label,required_total_credits,revision)
      VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE revision=revision+1`,
      [item.id, item.khoaTuyenSinh, item.tongTinChiYeuCau],
    );
    await manager.query(
      "UPDATE program_versions SET updated_at=UTC_TIMESTAMP(6) WHERE id=?",
      [item.id],
    );
  }
  async create(
    input: ProgramInput,
    actor: ProgramActor,
    existingProgramId?: string,
  ): Promise<ProgramItem> {
    return this.write(actor, "PROGRAM_EDIT", async (manager) => {
      const [reference] = await manager.query(
        `SELECT m.id FROM majors m JOIN education_levels e ON e.id=?
       JOIN organizational_units u ON u.id=? WHERE m.id=? AND m.status='ACTIVE' AND e.status='ACTIVE' AND u.status='ACTIVE'
       AND EXISTS(SELECT 1 FROM organizational_unit_closure oc WHERE oc.ancestor_id=u.id AND oc.descendant_id=m.organizational_unit_id)`,
        [input.educationLevelId, input.managingUnitId, input.majorId],
      );
      if (!reference)
        throw new BadRequestException(
          "Bậc, đơn vị hoặc ngành không tồn tại/không phù hợp.",
        );
      let programId: string;
      if (existingProgramId) {
        const base = await this.baseProgram(existingProgramId, actor);
        const [state] = await manager.query(
          "SELECT status FROM training_programs WHERE id=?",
          [existingProgramId],
        );
        if (state?.status !== "ACTIVE")
          throw new ConflictException(
            "Chương trình đã ngừng hoạt động, không thể khởi tạo phiên bản mới.",
          );
        if (
          base.maCTDT !== input.maCTDT ||
          base.educationLevelId !== input.educationLevelId ||
          base.managingUnitId !== input.managingUnitId ||
          base.majorId !== input.majorId
        )
          throw new BadRequestException(
            "Mã/ngành/bậc/đơn vị không khớp chương trình đã có.",
          );
        programId = existingProgramId;
      } else {
        const [scope] = await manager.query(
          `SELECT 1 AS allowed FROM (SELECT 0 AS id,? AS major_id,? AS managing_unit_id) p WHERE ${SCOPE}`,
          [input.majorId, input.managingUnitId, actor.id],
        );
        if (!scope)
          throw new ForbiddenException(
            "Không có quyền tạo CTĐT trong đơn vị/ngành này.",
          );
        await manager.query(
          "INSERT INTO training_programs (major_id,education_level_id,managing_unit_id,program_code,program_name,description) VALUES (?,?,?,?,?,?)",
          [
            input.majorId,
            input.educationLevelId,
            input.managingUnitId,
            input.maCTDT,
            input.tenCTDT,
            input.moTa,
          ],
        );
        const [{ id: newProgramId }] = await manager.query(
          "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
        );

        programId = newProgramId;
      }
      await manager.query(
        "INSERT INTO program_versions (program_id,version_code,program_name_snapshot,search_text,cohort_year,created_by) VALUES (?,?,?,?,?,?)",
        [
          programId,
          input.maPhienBan || "v1",
          input.tenCTDT,
          input.maCTDT + " " + input.tenCTDT,
          this.cohort(input),
          actor.id,
        ],
      );
      const [{ id }] = await manager.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
      );
      await this.saveMetadata(manager, id, input);
      const tracks = await manager.query(
        `SELECT st.id,st.track_code,st.track_name FROM education_level_tracks et JOIN study_tracks st ON st.id=et.study_track_id
        WHERE et.education_level_id=? AND st.status='ACTIVE' ORDER BY et.display_order,st.id`,
        [input.educationLevelId],
      );
      if (!tracks.length)
        throw new BadRequestException(
          "Bậc đào tạo chưa cấu hình hướng học bắt buộc.",
        );
      for (const track of tracks) {
        await manager.query(
          "INSERT INTO program_version_tracks (program_version_id,study_track_id,track_code_snapshot,track_name_snapshot,required_total_credits) VALUES (?,?,?,?,?)",
          [
            id,
            track.id,
            track.track_code,
            track.track_name,
            input.tongTinChiYeuCau,
          ],
        );
        const [{ id: trackId }] = await manager.query(
          "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
        );
        for (const [index, name] of [
          "Kiến thức chung",
          "Cơ sở ngành",
          "Chuyên ngành",
          "Tốt nghiệp",
        ].entries()) {
          await manager.query(
            "INSERT INTO curriculum_groups (program_version_track_id,group_code,group_name,display_order) VALUES (?,?,?,?)",
            [trackId, ["A", "B", "C", "D"][index], name, index],
          );
        }
      }
      const item = await this.get(manager, id, actor);
      await this.audit(manager, actor, "CREATE", item);
      return item;
    });
  }
  async update(id: string, input: ProgramInput, actor: ProgramActor) {
    return this.write(actor, "PROGRAM_EDIT", async (manager) => {
      const old = await this.get(manager, id, actor, true);
      this.editable(old, input.revision);
      if (
        old.maCTDT !== input.maCTDT ||
        (input.maPhienBan != null && old.maPhienBan !== input.maPhienBan) ||
        old.majorId !== input.majorId ||
        old.educationLevelId !== input.educationLevelId ||
        old.managingUnitId !== input.managingUnitId
      ) {
        throw new BadRequestException(
          "Mã, ngành, bậc và đơn vị của CTĐT không đổi khi chỉnh sửa phiên bản.",
        );
      }
      await manager.query(
        "UPDATE program_versions SET program_name_snapshot=?,search_text=?,cohort_year=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?",
        [
          input.tenCTDT,
          input.maCTDT + " " + input.tenCTDT,
          this.cohort(input),
          id,
        ],
      );
      await manager.query(
        "UPDATE program_version_tracks SET required_total_credits=? WHERE program_version_id=? AND status='ACTIVE'",
        [input.tongTinChiYeuCau, id],
      );
      await this.saveMetadata(manager, id, input);
      const item = await this.get(manager, id, actor);
      await this.audit(manager, actor, "UPDATE", item);
      return item;
    });
  }
  async structure(id: string, input: CurriculumInput, actor: ProgramActor) {
    return this.write(actor, "PROGRAM_EDIT", async (manager) => {
      const old = await this.get(manager, id, actor, true);
      this.editable(old, input.revision);
      const writableTracks = old.tracks.filter(
        (track) => track.status !== "INACTIVE",
      );
      if (
        input.tracks.length !== writableTracks.length ||
        writableTracks.some(
          (track) =>
            !input.tracks.some((candidate) => candidate.id === track.id),
        )
      )
        throw new BadRequestException("Danh sách hướng đào tạo không phù hợp.");
      for (const trackInput of input.tracks) {
        const track = writableTracks.find(
          (entry) => entry.id === trackInput.id,
        )!;
        if (
          trackInput.groups.length !== track.groups.length ||
          track.groups.some(
            (group) =>
              !trackInput.groups.some((candidate) => candidate.id === group.id),
          )
        )
          throw new BadRequestException(
            "Nhóm kiến thức không thuộc hướng đào tạo.",
          );
        for (const group of trackInput.groups) {
          const sourceGroup = track.groups.find(
            (item) => item.id === group.id,
          )!;
          if (
            sourceGroup.maximumCredits != null &&
            group.minimumCredits > sourceGroup.maximumCredits
          )
            throw new BadRequestException(
              "Tín chỉ tối thiểu vượt tối đa của nhóm " +
                sourceGroup.name +
                ".",
            );
          await manager.query(
            "UPDATE curriculum_groups SET minimum_credits=? WHERE id=?",
            [group.minimumCredits, group.id],
          );
        }
        const selected = [];
        const courseIds = new Set<string>();
        for (const course of trackInput.courses) {
          if (!track.groups.some((group) => group.id === course.groupId))
            throw new BadRequestException(
              "Học phần tham chiếu nhóm không thuộc hướng.",
            );
          const [version] = await manager.query(
            `SELECT CAST(cv.course_id AS CHAR) AS courseId FROM course_versions cv JOIN courses c ON c.id=cv.course_id
            WHERE cv.id=? AND c.status='ACTIVE' AND (cv.status='ACTIVE' OR EXISTS(
              SELECT 1 FROM curriculum_courses cc WHERE cc.program_version_track_id=? AND cc.course_version_id=cv.id))`,
            [course.courseVersionId, track.id],
          );
          if (!version)
            throw new BadRequestException(
              "Học phần không có phiên bản hợp lệ.",
            );
          if (courseIds.has(version.courseId))
            throw new BadRequestException(
              "Một học phần không được lặp trong cùng hướng.",
            );
          courseIds.add(version.courseId);
          selected.push({
            ...course,
            semester: course.semester ?? null,
            courseId: version.courseId,
          });
        }
        for (const previous of track.courses.filter(
          (course) => !courseIds.has(course.courseId),
        )) {
          await manager.query("DELETE FROM curriculum_courses WHERE id=?", [
            previous.id,
          ]);
        }
        for (const [order, course] of selected.entries()) {
          const previous = track.courses.find(
            (entry) => entry.courseId === course.courseId,
          );
          if (previous)
            await manager.query(
              `UPDATE curriculum_courses SET curriculum_group_id=?,course_version_id=?,requirement_type=?,suggested_semester=?,display_order=? WHERE id=?`,
              [
                course.groupId,
                course.courseVersionId,
                course.requirementType,
                course.semester,
                order,
                previous.id,
              ],
            );
          else
            await manager.query(
              `INSERT INTO curriculum_courses (curriculum_group_id,program_version_track_id,course_version_id,course_id,requirement_type,suggested_semester,display_order)
            VALUES (?,?,?,?,?,?,?)`,
              [
                course.groupId,
                track.id,
                course.courseVersionId,
                course.courseId,
                course.requirementType,
                course.semester,
                order,
              ],
            );
        }
      }
      await this.bump(manager, old);
      const item = await this.get(manager, id, actor);
      await this.audit(manager, actor, "UPDATE", item);
      return item;
    });
  }
  private async issues(manager: EntityManager, item: ProgramItem) {
    const required = await manager.query(
      "SELECT st.track_code FROM education_level_tracks et JOIN study_tracks st ON st.id=et.study_track_id WHERE et.education_level_id=? AND st.status='ACTIVE'",
      [item.educationLevelId],
    );
    const issues = validateCurriculum(
      item,
      required.map((track) => track.track_code),
    );
    if (!item.soQuyetDinhBanHanh || !item.ngayBanHanh)
      issues.push(
        "Cần bổ sung số và ngày quyết định ban hành trước khi gửi hồ sơ.",
      );
    return issues;
  }
  async validate(id: string, actor: ProgramActor) {
    const item = await this.detail(id, actor);
    return this.issues(this.db.manager, item);
  }
  async submit(id: string, revision: number, actor: ProgramActor) {
    return this.write(actor, "PROGRAM_SUBMIT", async (manager) => {
      const old = await this.get(manager, id, actor, true);
      this.editable(old, revision);
      const issues = await this.issues(manager, old);
      if (issues.length) throw new BadRequestException(issues);
      await manager.query(
        "UPDATE program_versions SET status='SUBMITTED',submitted_at=UTC_TIMESTAMP(6),status_reason=NULL WHERE id=?",
        [id],
      );
      await manager.query(
        "INSERT INTO approval_requests (program_version_id,request_no,requested_by) VALUES (?,?,?)",
        [id, "CTDT-" + randomUUID(), actor.id],
      );
      const [{ id: requestId }] = await manager.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
      );
      await manager.query(
        "INSERT INTO approval_actions (approval_request_id,actor_id,action_type,to_status) VALUES (?,?,'SUBMIT','PENDING')",
        [requestId, actor.id],
      );
      await this.bump(manager, old);
      const item = await this.get(manager, id, actor);
      await this.audit(manager, actor, "SUBMIT", item);
      return item;
    });
  }
  async review(
    id: string,
    input: ReviewInput,
    revision: number,
    actor: ProgramActor,
  ) {
    return this.write(actor, "PROGRAM_APPROVE", async (manager) => {
      const old = await this.get(manager, id, actor, true);
      this.revision(old, revision);
      if (!["SUBMITTED", "REVIEWING"].includes(old.status))
        throw new ConflictException(
          "CTĐT không còn trong trạng thái chờ thẩm định.",
        );
      const [request] = await manager.query(
        "SELECT CAST(id AS CHAR) AS id,CAST(requested_by AS CHAR) AS requestedBy FROM approval_requests WHERE program_version_id=? AND current_status='PENDING' FOR UPDATE",
        [id],
      );
      if (!request)
        throw new ConflictException(
          "Không tìm thấy yêu cầu xét duyệt đang chờ.",
        );
      if (request.requestedBy === actor.id)
        throw new ForbiddenException(
          "Người gửi không được tự xét duyệt hồ sơ của mình.",
        );
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (input.ngayHop > today)
        throw new BadRequestException(
          "Ngày họp thẩm định không được ở tương lai.",
        );
      const approved = input.ketLuan === "DAT_DIEU_KIEN";
      if (!approved && !input.yKienDongGop.trim())
        throw new BadRequestException(
          "Phải ghi ý kiến/lý do khi yêu cầu sửa hoặc kết luận không đạt.",
        );
      if (approved) {
        const issues = await this.issues(manager, old);
        if (issues.length) throw new BadRequestException(issues);
      }
      await manager.query(
        `INSERT INTO program_review_minutes
        (approval_request_id,council_name,chair_name,secretary_name,meeting_date,conclusion,comments,minutes_number,recorded_by)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          request.id,
          input.hoiDongThamDinh,
          input.chuTichHoidong,
          input.thuKhao,
          input.ngayHop,
          input.ketLuan,
          input.yKienDongGop,
          input.soBienBan,
          actor.id,
        ],
      );
      await manager.query(
        "INSERT INTO approval_actions (approval_request_id,actor_id,action_type,from_status,to_status,comment_text) VALUES (?,?,?,'PENDING',?,?)",
        [
          request.id,
          actor.id,
          approved ? "APPROVE" : "RETURN",
          approved ? "APPROVED" : "RETURNED",
          input.yKienDongGop || null,
        ],
      );
      await manager.query(
        "UPDATE approval_requests SET current_status=?,completed_at=UTC_TIMESTAMP(6),reviewing_by=?,latest_comment=? WHERE id=?",
        [
          approved ? "APPROVED" : "RETURNED",
          actor.id,
          input.yKienDongGop,
          request.id,
        ],
      );
      if (approved)
        await manager.query(
          "UPDATE program_versions SET status='PUBLISHED',published_at=UTC_TIMESTAMP(6),locked_at=UTC_TIMESTAMP(6),effective_from=COALESCE(effective_from,?) WHERE id=?",
          [old.ngayBanHanh, id],
        );
      else
        await manager.query(
          "UPDATE program_versions SET status='RETURNED',status_reason=? WHERE id=?",
          [input.yKienDongGop, id],
        );
      await this.bump(manager, old);
      const item = await this.get(manager, id, actor);
      await this.audit(manager, actor, approved ? "APPROVE" : "RETURN", item);
      return item;
    });
  }
  async addDocument(id: string, input: DocumentInput, actor: ProgramActor) {
    return this.write(actor, "PROGRAM_APPROVE", async (manager) => {
      const item = await this.get(manager, id, actor, true);
      if (!["SUBMITTED", "REVIEWING"].includes(item.status))
        throw new ConflictException(
          "Chỉ đính kèm tài liệu khi hồ sơ đang chờ thẩm định.",
        );
      if (item.requestedBy === actor.id)
        throw new ForbiddenException("Người gửi không tự thẩm định hồ sơ.");
      await manager.query(
        "INSERT INTO program_review_documents (program_version_id,storage_key,original_name,mime_type,file_size,uploaded_by) VALUES (?,?,?,?,?,?)",
        [id, input.storageKey, input.name, input.mime, input.size, actor.id],
      );
      const [{ id: documentId }] = await manager.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
      );
      await this.audit(manager, actor, "UPLOAD_DOCUMENT", item);
      return { id: documentId, name: input.name, size: input.size };
    });
  }
  async document(
    id: string,
    documentId: string,
    actor: ProgramActor,
  ): Promise<DocumentInput> {
    await this.detail(id, actor);
    const [row] = await this.db.query(
      "SELECT storage_key AS storageKey,original_name AS name,mime_type AS mime,file_size AS size FROM program_review_documents WHERE id=? AND program_version_id=?",
      [documentId, id],
    );
    if (!row) throw new NotFoundException("Không tìm thấy tài liệu.");
    return row;
  }
}
