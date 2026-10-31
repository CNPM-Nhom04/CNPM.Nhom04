import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { createHash } from "crypto";
import {
  GraduationActor,
  GraduationEvidence,
  GraduationInput,
  GraduationPolicy,
  GraduationQuery,
  GraduationRepository,
} from "../domain/graduation";
import { evaluateGraduation } from "../domain/evaluate-graduation";
import {
  GraduationEvidenceDto,
  GraduationPolicyDto,
} from "../application/graduation.dto";
const SCOPE = `EXISTS(SELECT 1 FROM vw_user_program_access pa WHERE pa.user_id=? AND pa.program_id=p.id)
 AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id)`;
const FROM = ` FROM student_program_assignments a JOIN students s ON s.id=a.student_id
 JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id
 JOIN training_programs p ON p.id=v.program_id JOIN organizational_units u ON u.id=p.managing_unit_id
 JOIN education_levels l ON l.id=p.education_level_id`;
const SELECT =
  `SELECT CAST(a.id AS CHAR) assignmentId,CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.full_name studentName,
 s.status studentStatus,a.assignment_status assignmentStatus,CAST(t.id AS CHAR) trackId,t.track_code_snapshot trackCode,
 t.track_name_snapshot trackName,t.required_total_credits requiredCredits,CAST(v.id AS CHAR) versionId,v.version_code versionCode,
 v.status versionStatus,CAST(p.id AS CHAR) programId,p.program_code programCode,v.program_name_snapshot programName,
 CAST(u.id AS CHAR) unitId,u.unit_name unitName,CAST(l.id AS CHAR) levelId,l.level_name levelName` +
  FROM;
const iso = (x) => (x instanceof Date ? x.toISOString() : (x ?? null));
const json = (x) => (typeof x === "string" ? JSON.parse(x) : x);
const bool = (x) => !!Number(x);
const blank = (x) => (typeof x === "string" && x.trim() ? x.trim() : null);
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const placeholders = (ids: string[]) => ids.map(() => "?").join(",");
function mapPolicy(r): GraduationPolicy | null {
  return r
    ? {
        trackId: String(r.program_version_track_id),
        revision: Number(r.revision),
        requireGpa: bool(r.require_gpa),
        minimumGpa: r.minimum_gpa == null ? null : Number(r.minimum_gpa),
        requireLanguage: bool(r.require_language),
        languageRule: r.language_rule,
        requireDefense: bool(r.require_defense),
        otherRequirements: r.other_requirements,
        reference: r.reference,
        updatedBy: String(r.updated_by),
        updatedAt: iso(r.updated_at),
      }
    : null;
}
function mapEvidence(r): GraduationEvidence | null {
  return r
    ? {
        assignmentId: String(r.assignment_id),
        revision: Number(r.revision),
        policyRevision: Number(r.policy_revision),
        gpa: r.gpa == null ? null : Number(r.gpa),
        gpaReference: r.gpa_reference,
        languageState: r.language_state,
        languageReference: r.language_reference,
        languageValidUntil: r.validUntil,
        languageNoExpiry: bool(r.language_no_expiry),
        otherState: r.other_state,
        otherReference: r.other_reference,
        verifiedBy: String(r.verified_by),
        verifiedAt: iso(r.verified_at),
      }
    : null;
}
@Injectable()
export class MysqlGraduationRepository extends GraduationRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  private async write<T>(
    actor: GraduationActor,
    permission: string,
    run: (m: EntityManager) => Promise<T>,
  ) {
    try {
      return await this.db.transaction("REPEATABLE READ", async (m) => {
        await m.query("SET time_zone='+00:00'");
        const [u] = await m.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0
    AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE' JOIN role_permissions rp ON rp.role_id=r.id
    JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND p.permission_code=?)
    AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE' JOIN role_permissions rp ON rp.role_id=r.id
    JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND p.permission_code='GRADUATION_READ') FOR UPDATE`,
          [actor.id, permission],
        );
        if (!u)
          throw new ForbiddenException("Tài khoản không còn quyền thao tác.");
        return run(m);
      });
    } catch (e) {
      if (
        [
          "ER_DUP_ENTRY",
          "ER_LOCK_DEADLOCK",
          "ER_LOCK_WAIT_TIMEOUT",
          "ER_SIGNAL_EXCEPTION",
        ].includes(e.driverError?.code || e.code)
      )
        throw new ConflictException(
          "Dữ liệu đã thay đổi hoặc đang được xử lý. Vui lòng tải lại.",
        );
      throw e;
    }
  }
  private async bases(
    m: EntityManager,
    actor: GraduationActor,
    filter: Partial<GraduationQuery> = {},
    id?: string,
    afterId?: string,
    limit?: number,
  ) {
    const search = filter.searchTerm || "",
      level = filter.educationLevelId || "",
      state = filter.assignmentStatus || "ALL";
    return m.query(
      SELECT +
        ` WHERE ${SCOPE} AND (?='' OR a.id=?) AND (?='' OR a.id>?)
   AND (?='' OR l.id=?) AND (?='ALL' OR a.assignment_status=?)
   AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0 OR LOCATE(?,p.program_code)>0 OR LOCATE(?,v.program_name_snapshot)>0)
   ORDER BY a.id` +
        (limit ? " LIMIT ?" : ""),
      [
        actor.id,
        actor.id,
        id || "",
        id || "",
        afterId || "",
        afterId || "",
        level,
        level,
        state,
        state,
        search,
        search,
        search,
        search,
        search,
        ...(limit ? [limit] : []),
      ],
    );
  }
  private async load(m: EntityManager, base): Promise<GraduationInput[]> {
    if (!base.length) return [];
    const output: GraduationInput[] = [];
    for (let offset = 0; offset < base.length; offset += 100) {
      const part = base.slice(offset, offset + 100),
        ids = part.map((r) => String(r.assignmentId)),
        tracks = [...new Set<string>(part.map((r) => String(r.trackId)))];
      const trackIn = placeholders(tracks),
        idIn = placeholders(ids);
      const policies = await m.query(
        "SELECT graduation_policies.*,CAST(program_version_track_id AS CHAR) program_version_track_id,CAST(updated_by AS CHAR) updated_by FROM graduation_policies WHERE program_version_track_id IN(" +
          trackIn +
          ")",
        tracks,
      );
      const evidence = await m.query(
        "SELECT graduation_evidence.*,CAST(assignment_id AS CHAR) assignment_id,CAST(verified_by AS CHAR) verified_by,DATE_FORMAT(language_valid_until,'%Y-%m-%d') validUntil FROM graduation_evidence WHERE assignment_id IN(" +
          idIn +
          ")",
        ids,
      );
      const groups = await m.query(
        `SELECT CAST(program_version_track_id AS CHAR) trackId,CAST(id AS CHAR) id,CAST(parent_group_id AS CHAR) parentId,
    group_code code,group_name name,minimum_credits minimum,maximum_credits maximum FROM curriculum_groups
    WHERE program_version_track_id IN(` +
          trackIn +
          ") ORDER BY id",
        tracks,
      );
      const courses = await m.query(
        `SELECT CAST(cc.program_version_track_id AS CHAR) trackId,CAST(cc.id AS CHAR) id,CAST(cc.course_id AS CHAR) courseId,
    CAST(cc.course_version_id AS CHAR) courseVersionId,c.course_code code,cv.course_name name,cv.credits,CAST(cc.curriculum_group_id AS CHAR) groupId,
    cc.requirement_type FROM curriculum_courses cc JOIN courses c ON c.id=cc.course_id JOIN course_versions cv ON cv.id=cc.course_version_id
    WHERE cc.program_version_track_id IN(` +
          trackIn +
          ") ORDER BY cc.id",
        tracks,
      );
      const results = await m.query(
        `SELECT CAST(a.id AS CHAR) assignmentId,CAST(r.id AS CHAR) id,CAST(r.course_id AS CHAR) courseId,
    CAST(r.course_version_id AS CHAR) courseVersionId,r.result_status status,r.grade,r.passed_at passedAt
    FROM student_program_assignments a JOIN student_course_results r ON r.student_id=a.student_id
    WHERE a.id IN(` +
          idIn +
          `) AND EXISTS(SELECT 1 FROM curriculum_courses cc WHERE cc.program_version_track_id=a.program_version_track_id AND cc.course_id=r.course_id)
    ORDER BY a.id,r.id`,
        ids,
      );
      const defenses = await m.query(
        `SELECT CAST(assignment_id AS CHAR) assignmentId,CAST(id AS CHAR) id,status,DATE_FORMAT(defense_date,'%Y-%m-%d') date,
    average_score score FROM thesis_defenses WHERE assignment_id IN(` +
          idIn +
          ") ORDER BY id",
        ids,
      );
      for (const r of part)
        output.push({
          ...r,
          requiredCredits: Number(r.requiredCredits),
          policy: mapPolicy(
            policies.find(
              (p) => String(p.program_version_track_id) === r.trackId,
            ),
          ),
          evidence: mapEvidence(
            evidence.find((e) => String(e.assignment_id) === r.assignmentId),
          ),
          groups: groups
            .filter((g) => g.trackId === r.trackId)
            .map(({ trackId, ...g }) => ({
              ...g,
              minimum: Number(g.minimum),
              maximum: g.maximum == null ? null : Number(g.maximum),
            })),
          courses: courses
            .filter((c) => c.trackId === r.trackId)
            .map(({ trackId, requirement_type, ...c }) => ({
              ...c,
              credits: Number(c.credits),
              required: requirement_type === "REQUIRED",
            })),
          results: results
            .filter((v) => v.assignmentId === r.assignmentId)
            .map(({ assignmentId, ...v }) => ({
              ...v,
              passedAt: iso(v.passedAt),
            })),
          defenses: defenses
            .filter((v) => v.assignmentId === r.assignmentId)
            .map(({ assignmentId, ...v }) => ({
              ...v,
              score: v.score == null ? null : Number(v.score),
            })),
        });
    }
    return output;
  }
  private evaluate(input: GraduationInput) {
    const evaluation = evaluateGraduation(input, today());
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ input, evaluation }))
      .digest("hex");
    return { input, evaluation, fingerprint };
  }
  private async latest(m: EntityManager, ids: string[]) {
    if (!ids.length) return [];
    return m.query(
      `SELECT CAST(e.assignment_id AS CHAR) assignmentId,e.data,e.created_at createdAt FROM graduation_events e
   WHERE e.event_type='CHECK' AND e.assignment_id IN(` +
        placeholders(ids) +
        `)
   AND e.id=(SELECT MAX(last.id) FROM graduation_events last WHERE last.assignment_id=e.assignment_id AND last.event_type='CHECK')`,
      ids,
    );
  }
  async list(query: GraduationQuery, actor: GraduationActor) {
    return this.db.transaction("REPEATABLE READ", async (m) => {
      const inputs = await this.load(m, await this.bases(m, actor, query));
      const evaluated = inputs.map((i) => this.evaluate(i));
      const summary = {
        DU_DIEN_KIEN: 0,
        CHUA_DU_DIEN_KIEN: 0,
        THIEU_THONG_TIN: 0,
      };
      for (const r of evaluated) summary[r.evaluation.status]++;
      const filtered = evaluated.filter(
        (r) =>
          !query.status ||
          query.status === "ALL" ||
          r.evaluation.status === query.status,
      );
      const start = (query.page - 1) * query.limit,
        part = filtered.slice(start, start + query.limit),
        latest = await this.latest(
          m,
          part.map((r) => r.input.assignmentId),
        );
      return {
        data: part.map((r) => {
          const saved = latest.find(
              (v) => v.assignmentId === r.input.assignmentId,
            ),
            snapshot = saved ? json(saved.data) : null;
          const {
            courses,
            groups,
            results,
            defenses,
            policy,
            evidence,
            ...identity
          } = r.input;
          return {
            ...identity,
            status: r.evaluation.status,
            earnedCredits: r.evaluation.earnedCredits,
            rawCredits: r.evaluation.rawCredits,
            officialGpa: r.evaluation.officialGpa,
            languageState: r.evaluation.criteria.find(
              (c) => c.code === "LANGUAGE",
            )?.state,
            defenseState: r.evaluation.criteria.find(
              (c) => c.code === "DEFENSE",
            )?.state,
            missingInformation: r.evaluation.criteria.filter(
              (c) => c.state === "UNKNOWN",
            ).length,
            checkedAt: saved ? iso(saved.createdAt) : null,
            changedSinceCheck:
              !!saved && snapshot.fingerprint !== r.fingerprint,
          };
        }),
        summary,
        meta: {
          page: query.page,
          limit: query.limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / query.limit),
        },
        permissions: this.permissions(actor),
      };
    });
  }
  private permissions(actor: GraduationActor) {
    return {
      canCheck: actor.permissions.includes("GRADUATION_CHECK"),
      canEvidence: actor.permissions.includes("GRADUATION_EVIDENCE"),
      canPolicy: actor.permissions.includes("GRADUATION_POLICY"),
    };
  }
  async detail(id: string, actor: GraduationActor) {
    return this.db.transaction("REPEATABLE READ", async (m) => {
      const [input] = await this.load(m, await this.bases(m, actor, {}, id));
      if (!input)
        throw new NotFoundException(
          "Không tìm thấy hồ sơ trong phạm vi được phân quyền.",
        );
      const [saved] = await this.latest(m, [id]),
        value = this.evaluate(input);
      return {
        ...value,
        checkedAt: saved ? iso(saved.createdAt) : null,
        changedSinceCheck:
          !!saved && json(saved.data).fingerprint !== value.fingerprint,
        permissions: this.permissions(actor),
      };
    });
  }
  private async lockAssignment(
    m: EntityManager,
    id: string,
    actor: GraduationActor,
  ) {
    const [row] = await m.query(
      SELECT + ` WHERE a.id=? AND ${SCOPE} FOR UPDATE`,
      [id, actor.id, actor.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy hồ sơ trong phạm vi được phân quyền.",
      );
    return row;
  }
  private async lockTrack(
    m: EntityManager,
    id: string,
    actor: GraduationActor,
    lock = true,
  ) {
    const [row] = await m.query(
      `SELECT CAST(t.id AS CHAR) trackId,CAST(p.managing_unit_id AS CHAR) unitId,t.track_code_snapshot code,
   t.track_name_snapshot name,p.program_code programCode,v.version_code versionCode FROM program_version_tracks t
   JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id
   WHERE t.id=? AND EXISTS(SELECT 1 FROM vw_user_program_access access WHERE access.user_id=? AND access.program_id=p.id)` +
        (lock ? " FOR UPDATE" : ""),
      [id, actor.id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy hướng đào tạo trong phạm vi.",
      );
    return row;
  }
  async options(actor: GraduationActor) {
    return this.db.transaction("REPEATABLE READ", async (m) => {
      const levels = await m.query(
        "SELECT DISTINCT CAST(l.id AS CHAR) id,l.level_name name" +
          FROM +
          ` WHERE ${SCOPE} ORDER BY l.id`,
        [actor.id, actor.id],
      );
      const tracks = await m.query(
        `SELECT CAST(t.id AS CHAR) id,t.track_code_snapshot code,t.track_name_snapshot name,p.program_code programCode,
    v.version_code versionCode,u.unit_name unitName FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id
    JOIN training_programs p ON p.id=v.program_id JOIN organizational_units u ON u.id=p.managing_unit_id
    WHERE EXISTS(SELECT 1 FROM vw_user_program_access access WHERE access.user_id=? AND access.program_id=p.id) ORDER BY p.program_code,v.id,t.id`,
        [actor.id],
      );
      return { levels, tracks, permissions: this.permissions(actor) };
    });
  }
  async policy(trackId: string, actor: GraduationActor) {
    return this.db.transaction("REPEATABLE READ", async (m) => {
      const track = await this.lockTrack(m, trackId, actor, false);
      const [row] = await m.query(
        "SELECT graduation_policies.*,CAST(program_version_track_id AS CHAR) program_version_track_id,CAST(updated_by AS CHAR) updated_by FROM graduation_policies WHERE program_version_track_id=?",
        [trackId],
      );
      return {
        track,
        policy: mapPolicy(row),
        permissions: this.permissions(actor),
      };
    });
  }
  private async event(
    m: EntityManager,
    actor: GraduationActor,
    trackId: string,
    assignmentId: string | null,
    type: string,
    data: unknown,
    unitId: string,
  ) {
    await m.query(
      "INSERT INTO graduation_events(assignment_id,track_id,event_type,actor_id,data) VALUES(?,?,?,?,?)",
      [assignmentId, trackId, type, actor.id, JSON.stringify(data)],
    );
    await m.query(
      `INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,scope_unit_id,new_value,reason,ip_address)
   VALUES(?,?,?,'graduation',?,?,?,?,?)`,
      [
        actor.id,
        actor.username,
        "GRADUATION_" + type,
        assignmentId || trackId,
        unitId,
        JSON.stringify({ trackId, assignmentId, eventType: type }),
        "Đối chiếu hồ sơ xét điều kiện tốt nghiệp",
        actor.ip,
      ],
    );
  }
  async savePolicy(
    trackId: string,
    value: GraduationPolicyDto,
    actor: GraduationActor,
  ) {
    if (
      (value.requireGpa &&
        (value.minimumGpa == null || value.minimumGpa <= 0)) ||
      (!value.requireGpa && value.minimumGpa != null)
    )
      throw new BadRequestException(
        "Ngưỡng ĐTB phải được nhập khi có yêu cầu; không yêu cầu thì để trống.",
      );
    if (value.requireLanguage && !blank(value.languageRule))
      throw new BadRequestException(
        "Nhập chuẩn ngoại ngữ theo quy định thực tế.",
      );
    await this.write(actor, "GRADUATION_POLICY", async (m) => {
      const track = await this.lockTrack(m, trackId, actor);
      const [old] = await m.query(
        "SELECT graduation_policies.*,CAST(program_version_track_id AS CHAR) program_version_track_id,CAST(updated_by AS CHAR) updated_by FROM graduation_policies WHERE program_version_track_id=? FOR UPDATE",
        [trackId],
      );
      if (Number(old?.revision || 0) !== value.revision)
        throw new ConflictException("Quy định đã thay đổi. Vui lòng tải lại.");
      await m.query(
        `INSERT INTO graduation_policies(program_version_track_id,revision,require_gpa,minimum_gpa,require_language,language_rule,require_defense,other_requirements,reference,updated_by)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),require_gpa=VALUES(require_gpa),minimum_gpa=VALUES(minimum_gpa),
    require_language=VALUES(require_language),language_rule=VALUES(language_rule),require_defense=VALUES(require_defense),other_requirements=VALUES(other_requirements),
    reference=VALUES(reference),updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP(6)`,
        [
          trackId,
          value.revision + 1,
          value.requireGpa,
          value.minimumGpa ?? null,
          value.requireLanguage,
          blank(value.languageRule),
          value.requireDefense,
          blank(value.otherRequirements),
          value.reference,
          actor.id,
        ],
      );
      const [after] = await m.query(
        "SELECT graduation_policies.*,CAST(program_version_track_id AS CHAR) program_version_track_id,CAST(updated_by AS CHAR) updated_by FROM graduation_policies WHERE program_version_track_id=?",
        [trackId],
      );
      await this.event(
        m,
        actor,
        trackId,
        null,
        "POLICY",
        { before: mapPolicy(old), after: mapPolicy(after) },
        track.unitId,
      );
    });
    return this.policy(trackId, actor);
  }
  async saveEvidence(
    id: string,
    value: GraduationEvidenceDto,
    actor: GraduationActor,
  ) {
    if (
      (value.gpa != null && !blank(value.gpaReference)) ||
      (value.gpa == null && blank(value.gpaReference))
    )
      throw new BadRequestException(
        "ĐTB chính thức và căn cứ phải được nhập cùng nhau.",
      );
    if (value.languageState !== "UNKNOWN" && !blank(value.languageReference))
      throw new BadRequestException("Thiếu căn cứ xác minh ngoại ngữ.");
    if (value.languageNoExpiry && value.languageValidUntil)
      throw new BadRequestException(
        "Chọn không hết hạn hoặc nhập ngày hết hạn.",
      );
    if (
      value.languageState === "MET" &&
      !value.languageNoExpiry &&
      !value.languageValidUntil
    )
      throw new BadRequestException(
        "Nhập hạn hiệu lực hoặc xác nhận hồ sơ không quy định hết hạn.",
      );
    if (value.otherState !== "UNKNOWN" && !blank(value.otherReference))
      throw new BadRequestException("Thiếu căn cứ tiêu chí khác.");
    await this.write(actor, "GRADUATION_EVIDENCE", async (m) => {
      const row = await this.lockAssignment(m, id, actor);
      if (row.studentStatus !== "ACTIVE" || row.assignmentStatus !== "ACTIVE")
        throw new ConflictException(
          "Chỉ xác minh hồ sơ học viên/phân công đang hoạt động.",
        );
      const [p] = await m.query(
        "SELECT revision FROM graduation_policies WHERE program_version_track_id=? FOR UPDATE",
        [row.trackId],
      );
      if (!p || Number(p.revision) !== value.policyRevision)
        throw new ConflictException(
          "Chưa có quy định hoặc quy định đã thay đổi; hãy tải lại.",
        );
      const [old] = await m.query(
        "SELECT graduation_evidence.*,CAST(assignment_id AS CHAR) assignment_id,CAST(verified_by AS CHAR) verified_by,DATE_FORMAT(language_valid_until,'%Y-%m-%d') validUntil FROM graduation_evidence WHERE assignment_id=? FOR UPDATE",
        [id],
      );
      if (Number(old?.revision || 0) !== value.revision)
        throw new ConflictException(
          "Hồ sơ đã được xác minh lại bởi người khác.",
        );
      await m.query(
        `INSERT INTO graduation_evidence(assignment_id,revision,policy_revision,gpa,gpa_reference,language_state,language_reference,language_valid_until,language_no_expiry,other_state,other_reference,verified_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),policy_revision=VALUES(policy_revision),gpa=VALUES(gpa),gpa_reference=VALUES(gpa_reference),
    language_state=VALUES(language_state),language_reference=VALUES(language_reference),language_valid_until=VALUES(language_valid_until),language_no_expiry=VALUES(language_no_expiry),
    other_state=VALUES(other_state),other_reference=VALUES(other_reference),verified_by=VALUES(verified_by),verified_at=UTC_TIMESTAMP(6)`,
        [
          id,
          value.revision + 1,
          value.policyRevision,
          value.gpa ?? null,
          blank(value.gpaReference),
          value.languageState,
          blank(value.languageReference),
          value.languageValidUntil ?? null,
          value.languageNoExpiry,
          value.otherState,
          blank(value.otherReference),
          actor.id,
        ],
      );
      const [after] = await m.query(
        "SELECT graduation_evidence.*,CAST(assignment_id AS CHAR) assignment_id,CAST(verified_by AS CHAR) verified_by,DATE_FORMAT(language_valid_until,'%Y-%m-%d') validUntil FROM graduation_evidence WHERE assignment_id=?",
        [id],
      );
      await this.event(
        m,
        actor,
        row.trackId,
        id,
        "EVIDENCE",
        { before: mapEvidence(old), after: mapEvidence(after) },
        row.unitId,
      );
    });
    return this.detail(id, actor);
  }
  async check(id: string, actor: GraduationActor) {
    await this.write(actor, "GRADUATION_CHECK", async (m) => {
      const row = await this.lockAssignment(m, id, actor);
      const [input] = await this.load(m, [row]);
      await this.event(
        m,
        actor,
        input.trackId,
        id,
        "CHECK",
        this.evaluate(input),
        input.unitId,
      );
    });
    return this.detail(id, actor);
  }
  async batch(
    value: { educationLevelId: string; afterId?: string; limit: number },
    actor: GraduationActor,
  ) {
    return this.write(actor, "GRADUATION_CHECK", async (m) => {
      const rows = await this.bases(
        m,
        actor,
        {
          educationLevelId: value.educationLevelId,
          assignmentStatus: "ACTIVE",
        },
        undefined,
        value.afterId,
        value.limit + 1,
      );
      const selected = rows.slice(0, value.limit);
      for (const row of selected)
        await this.lockAssignment(m, row.assignmentId, actor);
      const inputs = await this.load(m, selected);
      for (const input of inputs)
        await this.event(
          m,
          actor,
          input.trackId,
          input.assignmentId,
          "CHECK",
          this.evaluate(input),
          input.unitId,
        );
      return {
        checked: inputs.length,
        hasMore: rows.length > value.limit,
        nextAfterId: selected[selected.length - 1]?.assignmentId || null,
      };
    });
  }
  async history(id: string, page: number, actor: GraduationActor) {
    return this.db.transaction("REPEATABLE READ", async (m) => {
      const [row] = await this.bases(m, actor, {}, id);
      if (!row)
        throw new NotFoundException("Không tìm thấy hồ sơ trong phạm vi.");
      const where =
        " FROM graduation_events e JOIN users u ON u.id=e.actor_id WHERE e.assignment_id=? OR(e.assignment_id IS NULL AND e.track_id=? AND e.event_type='POLICY')";
      const [count] = await m.query("SELECT COUNT(*) total" + where, [
        id,
        row.trackId,
      ]);
      const data = await m.query(
        "SELECT CAST(e.id AS CHAR) id,e.event_type eventType,u.full_name actorName,e.created_at createdAt,e.data" +
          where +
          " ORDER BY e.id DESC LIMIT 20 OFFSET ?",
        [id, row.trackId, (page - 1) * 20],
      );
      return {
        data: data.map((e) => ({
          ...e,
          createdAt: iso(e.createdAt),
          data: json(e.data),
        })),
        meta: {
          page,
          limit: 20,
          total: Number(count.total),
          totalPages: Math.ceil(Number(count.total) / 20),
        },
      };
    });
  }
}
