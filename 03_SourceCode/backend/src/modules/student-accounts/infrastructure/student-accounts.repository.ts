import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  LinkStudentAccount,
  ACCOUNT_IMPORT_PERMISSIONS,
  AccountActor,
  AccountImportRow,
  ClassInput,
  ClassItem,
  ClassQuery,
  ClassUpdate,
  PreparedStudentAccount,
  StudentAccountsRepository,
} from "../domain/student-accounts";
const TRACK_FROM = ` FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id JOIN organizational_units u ON u.id=p.managing_unit_id JOIN majors m ON m.id=p.major_id JOIN education_levels e ON e.id=p.education_level_id`;
const TRACK_VALID = `t.status='ACTIVE' AND v.status IN('PUBLISHED','ARCHIVED') AND p.status='ACTIVE' AND u.status='ACTIVE' AND m.status='ACTIVE' AND e.status='ACTIVE'`;
const TRACK_SELECT =
  `SELECT CAST(t.id AS CHAR) id,t.track_code_snapshot trackCode,t.track_name_snapshot trackName,v.version_code versionCode,v.program_name_snapshot programName,v.status versionStatus,v.cohort_year cohortYear,CAST(u.id AS CHAR) unitId,u.unit_name unitName` +
  TRACK_FROM;
const CLASS_SELECT = `SELECT CAST(c.id AS CHAR) id,c.class_code code,c.class_name name,CAST(c.program_version_track_id AS CHAR) trackId,c.admission_year admissionYear,c.status,c.revision,t.track_code_snapshot trackCode,t.track_name_snapshot trackName,v.version_code versionCode,v.program_name_snapshot programName,CAST(u.id AS CHAR) unitId,u.unit_name unitName,(SELECT COUNT(*) FROM student_class_memberships cm WHERE cm.class_id=c.id) memberCount FROM student_classes c JOIN program_version_tracks t ON t.id=c.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id JOIN organizational_units u ON u.id=p.managing_unit_id`;
function page(data, total: number, q: ClassQuery) {
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
export class MysqlStudentAccountsRepository extends StudentAccountsRepository {
  constructor(private readonly db: DataSource) {
    super();
  }
  async linkAccounts(id: string, q: ClassQuery) {
    await this.detail(id);
    const search = q.searchTerm || "";
    const from = ` FROM users u LEFT JOIN students s ON s.user_id=u.id
      WHERE u.deleted_at IS NULL AND u.account_status='ACTIVE'
      AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code='STUDENT')
      AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code<>'STUDENT')
      AND NOT EXISTS(SELECT 1 FROM student_class_memberships cm WHERE cm.student_id=s.id)
      AND (?='' OR LOCATE(?,u.username)>0 OR LOCATE(?,u.full_name)>0 OR LOCATE(?,COALESCE(s.student_code,''))>0)`;
    const params = [search, search, search, search];
    const rows = await this.db.query(
      `SELECT CAST(u.id AS CHAR) id,u.username,u.full_name fullName,u.email,
      CAST(u.organizational_unit_id AS CHAR) unitId,CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.full_name studentName` +
        from +
        " ORDER BY u.username LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query("SELECT COUNT(*) total" + from, params);
    return page(rows, Number(count.total), q);
  }
  async linkProfiles(id: string, q: ClassQuery) {
    const item = await this.detail(id),
      search = q.searchTerm || "";
    const from = ` FROM students s WHERE s.user_id IS NULL AND s.status='ACTIVE' AND s.admission_year=?
      AND (s.organizational_unit_id IS NULL OR s.organizational_unit_id=?)
      AND NOT EXISTS(SELECT 1 FROM student_class_memberships cm WHERE cm.student_id=s.id AND cm.class_id<>?)
      AND NOT EXISTS(SELECT 1 FROM student_program_assignments a WHERE a.student_id=s.id AND a.assignment_status='ACTIVE' AND a.program_version_track_id<>?)
      AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0)`;
    const params = [
      item.admissionYear,
      item.unitId,
      id,
      item.trackId,
      search,
      search,
      search,
    ];
    const rows = await this.db.query(
      "SELECT CAST(s.id AS CHAR) id,s.student_code studentCode,s.full_name fullName,s.admission_year admissionYear" +
        from +
        " ORDER BY s.student_code LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query("SELECT COUNT(*) total" + from, params);
    return page(rows, Number(count.total), q);
  }
  link(id: string, input: LinkStudentAccount, actor: AccountActor) {
    return this.write(actor, async (m) => {
      const item = await this.get(m, id, true);
      if (item.revision !== input.revision)
        throw new ConflictException(
          "Lớp đã thay đổi. Đóng form và tải lại lớp.",
        );
      if (item.status !== "ACTIVE")
        throw new ConflictException("Lớp đã ngừng tiếp nhận học viên.");
      await this.track(m, item.trackId, true);
      await this.studentRole(m, true);
      const [user] = await m.query(
        `SELECT CAST(u.id AS CHAR) id,u.full_name fullName,CAST(u.organizational_unit_id AS CHAR) unitId FROM users u
        WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL
        AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code='STUDENT')
        AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code<>'STUDENT') FOR UPDATE`,
        [input.userId],
      );
      if (!user)
        throw new ConflictException(
          "Chỉ liên kết tài khoản học viên đang hoạt động, không có vai trò nhân sự quản lý.",
        );
      if (user.unitId && user.unitId !== item.unitId)
        throw new ConflictException(
          "Đơn vị tài khoản khác khoa quản lý của lớp; không tự chuyển khoa.",
        );
      const [linked] = await m.query(
        "SELECT CAST(id AS CHAR) id FROM students WHERE user_id=? FOR UPDATE",
        [user.id],
      );
      if (linked && input.studentId && linked.id !== input.studentId)
        throw new ConflictException(
          "Tài khoản đã liên kết hồ sơ khác; không thay thế danh tính.",
        );
      if (linked && input.studentCode)
        throw new ConflictException(
          "Tài khoản đã có hồ sơ; không tạo hồ sơ thứ hai.",
        );
      let studentId: string = linked?.id || input.studentId;
      let createdProfile = false;
      if (studentId) {
        const [profile] = await m.query(
          "SELECT CAST(user_id AS CHAR) userId,CAST(organizational_unit_id AS CHAR) unitId,full_name fullName,admission_year year,status FROM students WHERE id=? FOR UPDATE",
          [studentId],
        );
        if (!profile)
          throw new NotFoundException("Hồ sơ học viên không tồn tại.");
        if (profile.userId && profile.userId !== user.id)
          throw new ConflictException(
            "Hồ sơ đã thuộc tài khoản khác; không ghi đè.",
          );
        if (
          profile.status !== "ACTIVE" ||
          Number(profile.year) !== item.admissionYear ||
          (profile.unitId && profile.unitId !== item.unitId)
        )
          throw new ConflictException(
            "Hồ sơ không đúng trạng thái, khoa hoặc khóa nhập học của lớp.",
          );
      } else {
        if (
          !input.studentCode ||
          !/^[A-Za-z0-9_.-]{1,50}$/.test(input.studentCode)
        )
          throw new BadRequestException(
            "Chọn hồ sơ có sẵn hoặc nhập mã học viên hợp lệ để tạo hồ sơ mới.",
          );
        if (!user.fullName?.trim())
          throw new BadRequestException(
            "Cần bổ sung họ tên tài khoản trước khi tạo hồ sơ học viên.",
          );
        const result = await m.query(
          "INSERT INTO students(user_id,organizational_unit_id,student_code,full_name,admission_year,status) VALUES(?,?,?,?,?,'ACTIVE')",
          [
            user.id,
            item.unitId,
            input.studentCode,
            user.fullName,
            item.admissionYear,
          ],
        );
        studentId = String(result.insertId);
        createdProfile = true;
      }
      const [member] = await m.query(
        "SELECT CAST(class_id AS CHAR) classId FROM student_class_memberships WHERE student_id=? FOR UPDATE",
        [studentId],
      );
      if (member)
        throw new ConflictException(
          member.classId === id
            ? "Học viên đã được liên kết vào lớp này."
            : "Học viên đang thuộc lớp khác; không tự chuyển lớp.",
        );
      const [assignment] = await m.query(
        "SELECT CAST(id AS CHAR) id,CAST(program_version_track_id AS CHAR) trackId FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE' FOR UPDATE",
        [studentId],
      );
      if (assignment && assignment.trackId !== item.trackId)
        throw new ConflictException(
          "Học viên đã có phân công CTĐT/hướng khác; không tự thay đổi.",
        );
      await m.query(
        "UPDATE students SET user_id=?,organizational_unit_id=COALESCE(organizational_unit_id,?) WHERE id=?",
        [user.id, item.unitId, studentId],
      );
      await m.query(
        "UPDATE users SET organizational_unit_id=COALESCE(organizational_unit_id,?) WHERE id=?",
        [item.unitId, user.id],
      );
      if (!assignment)
        await m.query(
          "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status,assigned_by,reason) VALUES(?,?,'ACTIVE',?,?)",
          [studentId, item.trackId, actor.id, input.reason],
        );
      await m.query(
        "INSERT INTO student_class_memberships(student_id,class_id,created_by) VALUES(?,?,?)",
        [studentId, id, actor.id],
      );
      await this.audit(m, actor, "LINK_STUDENT_ACCOUNT", "student_class", id, {
        userId: user.id,
        studentId,
        trackId: item.trackId,
        createdProfile,
        reason: input.reason,
      });
      return {
        message:
          "Đã liên kết tài khoản, hồ sơ và CTĐT của lớp. Mật khẩu và vai trò được giữ nguyên.",
        studentId,
        userId: user.id,
        classId: id,
      };
    });
  }
  async limits() {
    const rows = await this.db.query(
      "SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN('import.max_file_mb','import.max_rows','account.password_min_length')",
    );
    const settings = Object.fromEntries(
      rows.map((r) => [r.setting_key, Number(r.setting_value)]),
    );
    const mb = settings["import.max_file_mb"],
      maxRows = settings["import.max_rows"],
      passwordMinLength = settings["account.password_min_length"];
    if (
      !Number.isFinite(mb) ||
      mb <= 0 ||
      !Number.isSafeInteger(maxRows) ||
      maxRows < 1 ||
      !Number.isSafeInteger(passwordMinLength) ||
      passwordMinLength < 1 ||
      passwordMinLength > 72
    )
      throw new BadRequestException(
        "Cần cấu hình import.max_file_mb, import.max_rows và account.password_min_length hợp lệ trong SQL.",
      );
    return {
      maxFileBytes: Math.min(Math.floor(mb * 1024 * 1024), 5 * 1024 * 1024),
      maxRows: Math.min(maxRows, 200),
      passwordMinLength,
    };
  }
  async options() {
    return {
      tracks: await this.db.query(
        TRACK_SELECT +
          " WHERE " +
          TRACK_VALID +
          " ORDER BY u.unit_name,v.cohort_year DESC,v.id,t.id",
      ),
      limits: await this.limits(),
    };
  }
  private map(row): ClassItem {
    return {
      ...row,
      admissionYear: Number(row.admissionYear),
      revision: Number(row.revision),
      memberCount: Number(row.memberCount),
    };
  }
  async list(q: ClassQuery) {
    const search = q.searchTerm || "",
      status = q.status || "ALL";
    const where =
      " WHERE (?='ALL' OR c.status=?) AND (?='' OR LOCATE(?,c.class_code)>0 OR LOCATE(?,c.class_name)>0 OR LOCATE(?,v.version_code)>0)";
    const params = [status, status, search, search, search, search];
    const data = await this.db.query(
      CLASS_SELECT + where + " ORDER BY c.id DESC LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query(
      "SELECT COUNT(*) total FROM student_classes c JOIN program_version_tracks t ON t.id=c.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id" +
        where,
      params,
    );
    return page(
      data.map((r) => this.map(r)),
      Number(count.total),
      q,
    );
  }
  private async get(manager: EntityManager, id: string, lock = false) {
    if (lock)
      await manager.query(
        "SELECT id FROM student_classes WHERE id=? FOR UPDATE",
        [id],
      );
    const [row] = await manager.query(CLASS_SELECT + " WHERE c.id=?", [id]);
    if (!row)
      throw new NotFoundException("Không tìm thấy lớp quản lý học viên.");
    return this.map(row);
  }
  detail(id: string) {
    return this.get(this.db.manager, id);
  }
  private async track(manager: EntityManager, id: string, lock = false) {
    const [track] = await manager.query(
      TRACK_SELECT +
        " WHERE t.id=? AND " +
        TRACK_VALID +
        (lock ? " FOR UPDATE" : ""),
      [id],
    );
    if (!track)
      throw new ConflictException(
        "CTĐT/hướng/đơn vị không còn đủ trạng thái để tiếp nhận học viên. Chọn hướng ACTIVE của phiên bản PUBLISHED hoặc ARCHIVED.",
      );
    return track;
  }
  private async studentRole(manager: EntityManager, lock = false) {
    const [role] = await manager.query(
      "SELECT CAST(r.id AS CHAR) id FROM roles r WHERE r.role_code='STUDENT' AND r.status='ACTIVE' AND EXISTS(SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=r.id AND p.permission_code='PROGRAM_READ_OWN')" +
        (lock ? " FOR UPDATE" : ""),
    );
    if (!role)
      throw new ConflictException(
        "Vai trò STUDENT phải đang hoạt động và có PROGRAM_READ_OWN để học viên tra cứu CTĐT.",
      );
    return role.id;
  }
  private write<T>(
    actor: AccountActor,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.db
      .transaction(async (manager) => {
        await manager.query(
          "SELECT id FROM roles WHERE role_code='ADMIN' FOR UPDATE",
        );
        const [allowed] = await manager.query(
          `SELECT u.id FROM users u WHERE u.id=? AND u.account_status='ACTIVE' AND u.deleted_at IS NULL AND u.must_change_password=0 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_code='ADMIN' AND r.status='ACTIVE') AND 3=(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN (?,?,?)) FOR UPDATE`,
          [actor.id, ...ACCOUNT_IMPORT_PERMISSIONS],
        );
        if (!allowed)
          throw new ForbiddenException(
            "Quyền tạo tài khoản học viên đã thay đổi. Vui lòng đăng nhập lại.",
          );
        return work(manager);
      })
      .catch((error) => {
        const code = error.driverError?.code || error.code;
        if (
          [
            "ER_DUP_ENTRY",
            "ER_LOCK_DEADLOCK",
            "ER_LOCK_WAIT_TIMEOUT",
            "ER_ROW_IS_REFERENCED_2",
            "ER_NO_REFERENCED_ROW_2",
          ].includes(code)
        )
          throw new ConflictException(
            "Dữ liệu đã tồn tại, đang được sử dụng hoặc vừa thay đổi. Không ghi đè; tải lại lớp và kiểm tra file trước khi nhập lại.",
          );
        throw error;
      });
  }
  private async audit(
    manager: EntityManager,
    actor: AccountActor,
    action: string,
    entity: string,
    id: string,
    value: unknown,
  ) {
    await manager.query(
      "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,entity_id,new_value,ip_address) VALUES(?,?,?,?,?,?,?)",
      [
        actor.id,
        actor.username,
        action,
        entity,
        id,
        JSON.stringify(value),
        actor.ip,
      ],
    );
  }
  create(input: ClassInput, actor: AccountActor) {
    return this.write(actor, async (manager) => {
      await this.track(manager, input.trackId, true);
      const saved = await manager.query(
        "INSERT INTO student_classes(class_code,class_name,program_version_track_id,admission_year,created_by) VALUES(?,?,?,?,?)",
        [input.code, input.name, input.trackId, input.admissionYear, actor.id],
      );
      const item = await this.get(manager, String(saved.insertId));
      await this.audit(
        manager,
        actor,
        "CREATE",
        "student_class",
        item.id,
        item,
      );
      return item;
    });
  }
  update(id: string, input: ClassUpdate, actor: AccountActor) {
    return this.write(actor, async (manager) => {
      const old = await this.get(manager, id, true);
      if (old.revision !== input.revision)
        throw new ConflictException("Lớp đã thay đổi. Tải lại trước khi sửa.");
      await manager.query(
        "UPDATE student_classes SET class_name=?,status=?,revision=revision+1 WHERE id=?",
        [input.name, input.status, id],
      );
      const item = await this.get(manager, id);
      await this.audit(manager, actor, "UPDATE", "student_class", id, {
        name: item.name,
        status: item.status,
        revision: item.revision,
      });
      return item;
    });
  }
  remove(id: string, revision: number, actor: AccountActor) {
    return this.write(actor, async (manager) => {
      const old = await this.get(manager, id, true);
      if (old.revision !== revision)
        throw new ConflictException("Lớp đã thay đổi. Tải lại trước khi xóa.");
      if (old.memberCount)
        throw new ConflictException(
          "Lớp đã có học viên; có thể ngừng tiếp nhận thay vì xóa.",
        );
      await manager.query("DELETE FROM student_classes WHERE id=?", [id]);
      await this.audit(manager, actor, "DELETE", "student_class", id, old);
    });
  }
  async members(id: string, q: ClassQuery) {
    const item = await this.detail(id),
      search = q.searchTerm || "";
    const from = ` FROM student_class_memberships cm JOIN students s ON s.id=cm.student_id LEFT JOIN users u ON u.id=s.user_id LEFT JOIN student_program_assignments a ON a.student_id=s.id AND a.assignment_status='ACTIVE' LEFT JOIN program_version_tracks t ON t.id=a.program_version_track_id LEFT JOIN program_versions v ON v.id=t.program_version_id WHERE cm.class_id=? AND (?='' OR LOCATE(?,s.student_code)>0 OR LOCATE(?,s.full_name)>0 OR LOCATE(?,COALESCE(u.username,''))>0)`;
    const params = [id, search, search, search, search];
    const rows = await this.db.query(
      `SELECT CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.full_name fullName,u.username,u.email,u.account_status accountStatus,u.must_change_password mustChangePassword,s.status studentStatus,v.version_code versionCode,t.track_name_snapshot trackName,CAST(a.program_version_track_id AS CHAR) trackId` +
        from +
        " ORDER BY s.student_code LIMIT ? OFFSET ?",
      [...params, q.limit, (q.page - 1) * q.limit],
    );
    const [count] = await this.db.query("SELECT COUNT(*) total" + from, params);
    return {
      class: item,
      ...page(
        rows.map((r) => ({
          ...r,
          mustChangePassword: !!Number(r.mustChangePassword),
          assignmentMatchesClass: r.trackId === item.trackId,
        })),
        Number(count.total),
        q,
      ),
    };
  }
  private async checkRows(
    manager: EntityManager,
    item: ClassItem,
    rows: AccountImportRow[],
    lock = false,
  ) {
    if (item.status !== "ACTIVE")
      throw new ConflictException("Lớp đã ngừng tiếp nhận học viên.");
    await this.track(manager, item.trackId, lock);
    await this.studentRole(manager, lock);
    const checked: AccountImportRow[] = [];
    for (const row of rows) {
      const result: AccountImportRow = {
        ...row,
        errors: [...row.errors],
        mode: "CREATE_PROFILE",
      };
      const [account] = await manager.query(
        "SELECT id FROM users WHERE username=? LIMIT 1",
        [row.username],
      );
      if (account) result.errors.push("Tên đăng nhập đã tồn tại trong SQL.");
      const [email] = await manager.query(
        "SELECT id FROM users WHERE email=? LIMIT 1",
        [row.email],
      );
      if (email) result.errors.push("Email đã được tài khoản khác sử dụng.");
      const [student] = await manager.query(
        "SELECT CAST(id AS CHAR) id,CAST(user_id AS CHAR) userId,CAST(organizational_unit_id AS CHAR) unitId,full_name name,admission_year year,status FROM students WHERE student_code=?" +
          (lock ? " FOR UPDATE" : ""),
        [row.studentCode],
      );
      if (student) {
        result.mode = "LINK_PROFILE";
        result.studentId = student.id;
        if (student.userId)
          result.errors.push(
            "Mã học viên đã có tài khoản; không ghi đè hay cấp lại mật khẩu.",
          );
        if (student.status !== "ACTIVE")
          result.errors.push("Hồ sơ học viên không ở trạng thái ACTIVE.");
        if (
          student.name.trim().normalize("NFC").toLowerCase() !==
          row.fullName.toLowerCase()
        )
          result.errors.push("Họ tên khác hồ sơ học viên có sẵn.");
        if (Number(student.year) !== item.admissionYear)
          result.errors.push("Năm nhập học của hồ sơ khác khóa của lớp.");
        if (student.unitId && student.unitId !== item.unitId)
          result.errors.push(
            "Đơn vị học viên khác đơn vị quản lý CTĐT của lớp.",
          );
        const [member] = await manager.query(
          "SELECT CAST(class_id AS CHAR) classId FROM student_class_memberships WHERE student_id=?" +
            (lock ? " FOR UPDATE" : ""),
          [student.id],
        );
        if (member && member.classId !== item.id)
          result.errors.push("Học viên đang thuộc lớp quản lý khác.");
        const [assignment] = await manager.query(
          "SELECT CAST(program_version_track_id AS CHAR) trackId FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'" +
            (lock ? " FOR UPDATE" : ""),
          [student.id],
        );
        if (assignment && assignment.trackId !== item.trackId)
          result.errors.push(
            "Học viên đã được phân công CTĐT/hướng khác. Không tự chuyển phân công.",
          );
      }
      checked.push(result);
    }
    return checked;
  }
  async check(id: string, rows: AccountImportRow[], revision: number) {
    const item = await this.detail(id);
    if (item.revision !== revision)
      throw new ConflictException("Lớp đã thay đổi. Đóng form và tải lại lớp.");
    return this.checkRows(this.db.manager, item, rows);
  }
  commit(
    id: string,
    accounts: PreparedStudentAccount[],
    revision: number,
    fileHash: string,
    actor: AccountActor,
    fileBytes: number,
  ) {
    return this.write(actor, async (manager) => {
      const settings = await manager.query(
        "SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN('import.max_file_mb','import.max_rows','account.password_min_length') FOR UPDATE",
      );
      const policy = Object.fromEntries(
        settings.map((r) => [r.setting_key, Number(r.setting_value)]),
      );
      if (
        !Number.isSafeInteger(policy["import.max_rows"]) ||
        policy["import.max_rows"] < 1 ||
        !Number.isFinite(policy["import.max_file_mb"]) ||
        policy["import.max_file_mb"] <= 0 ||
        !Number.isSafeInteger(policy["account.password_min_length"]) ||
        policy["account.password_min_length"] < 1 ||
        policy["account.password_min_length"] > 72 ||
        accounts.length < 1 ||
        accounts.length > Math.min(policy["import.max_rows"], 200) ||
        fileBytes >
          Math.min(
            policy["import.max_file_mb"] * 1024 * 1024,
            5 * 1024 * 1024,
          ) ||
        accounts.some(
          (a) => a.passwordLength < policy["account.password_min_length"],
        )
      )
        throw new ConflictException(
          "Cấu hình giới hạn nhập hoặc mật khẩu đã thay đổi. Hãy kiểm tra lại file.",
        );
      const item = await this.get(manager, id, true);
      if (item.revision !== revision)
        throw new ConflictException(
          "Lớp đã thay đổi. Kiểm tra lại file với dữ liệu lớp mới.",
        );
      const checked = await this.checkRows(
          manager,
          item,
          accounts.map((a) => a.row),
          true,
        ),
        invalid = checked.filter((r) => r.errors.length);
      if (invalid.length)
        throw new ConflictException(
          invalid
            .slice(0, 20)
            .map((r) => `Dòng ${r.rowNumber}: ${r.errors.join(" ")}`),
        );
      const roleId = await this.studentRole(manager, true),
        ids: string[] = [];
      for (let i = 0; i < accounts.length; i++) {
        const row = checked[i];
        const user = await manager.query(
          "INSERT INTO users(username,email,full_name,password_hash,organizational_unit_id,must_change_password,account_status) VALUES(?,?,?,?,?,1,'ACTIVE')",
          [
            row.username,
            row.email,
            row.fullName,
            accounts[i].passwordHash,
            item.unitId,
          ],
        );
        const userId = String(user.insertId);
        await manager.query(
          "INSERT INTO user_roles(user_id,role_id) VALUES(?,?)",
          [userId, roleId],
        );
        let studentId = row.studentId;
        if (studentId)
          await manager.query(
            "UPDATE students SET user_id=?,organizational_unit_id=COALESCE(organizational_unit_id,?) WHERE id=?",
            [userId, item.unitId, studentId],
          );
        else {
          const saved = await manager.query(
            "INSERT INTO students(user_id,organizational_unit_id,student_code,full_name,admission_year,status) VALUES(?,?,?,?,?,'ACTIVE')",
            [
              userId,
              item.unitId,
              row.studentCode,
              row.fullName,
              item.admissionYear,
            ],
          );
          studentId = String(saved.insertId);
        }
        const [assigned] = await manager.query(
          "SELECT id FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
          [studentId],
        );
        if (!assigned)
          await manager.query(
            "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status,assigned_by,reason) VALUES(?,?,'ACTIVE',?,?)",
            [
              studentId,
              item.trackId,
              actor.id,
              "Nhập học viên lớp " + item.code,
            ],
          );
        await manager.query(
          "INSERT INTO student_class_memberships(student_id,class_id,created_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE student_id=student_id",
          [studentId, id, actor.id],
        );
        await this.audit(manager, actor, "CREATE", "user", userId, {
          username: row.username,
          role: "STUDENT",
          studentId,
          classId: id,
          mustChangePassword: true,
        });
        ids.push(userId);
      }
      await this.audit(manager, actor, "IMPORT", "student_class", id, {
        count: accounts.length,
        userIds: ids,
        fileHash,
      });
      return accounts.length;
    });
  }
}
