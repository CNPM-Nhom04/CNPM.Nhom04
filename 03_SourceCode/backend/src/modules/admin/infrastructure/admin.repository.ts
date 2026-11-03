import { FacultyInput, FacultyItem, FacultyQuery } from "../domain/faculty";
import { MajorImportLimits, MajorImportRow } from "../domain/major-import";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import {
  Actor,
  AdminRepository,
  AuditItem,
  CategoryInput,
  CategoryItem,
  ListQuery,
  PageResult,
  ROLE_CODES,
  SETTING_DEFAULTS,
  Settings,
  UserInput,
  UserItem,
  UserRole,
} from "../domain/admin.repository";

import { MajorInput, MajorItem, MajorQuery } from "../domain/major";
const MAJOR_FROM =
  " FROM majors m JOIN organizational_units u ON u.id=m.organizational_unit_id";
const MAJOR_SELECT =
  `SELECT CAST(m.id AS CHAR) id,m.major_code majorCode,m.major_name majorName,
  CAST(m.organizational_unit_id AS CHAR) unitId,u.unit_code unitCode,u.unit_name unitName,u.status unitStatus,m.status,
  DATE_FORMAT(m.updated_at,'%Y-%m-%d %H:%i:%s.%f') updatedAt,
  (SELECT COUNT(*) FROM training_programs p WHERE p.major_id=m.id) programCount,
  (SELECT COUNT(*) FROM user_scopes s WHERE s.major_id=m.id) userScopeCount,
  (SELECT COUNT(*) FROM registration_period_scopes s WHERE s.major_id=m.id) registrationScopeCount` +
  MAJOR_FROM;
const CATEGORIES = {
  KHOA_QUAN_LY: {
    table: "organizational_units",
    code: "unit_code",
    name: "unit_name",
  },
  BAC_DAO_TAO: {
    table: "education_levels",
    code: "level_code",
    name: "level_name",
  },
  KHOI_KIEN_THUC: {
    table: "knowledge_blocks",
    code: "block_code",
    name: "block_name",
  },
};
const ROLE_ALIASES = Object.fromEntries(
  Object.entries(ROLE_CODES).map(([key, value]) => [value, key]),
);
const USER_SELECT = `
  SELECT CAST(u.id AS CHAR) AS id, u.username, u.full_name AS hoTen,
    COALESCE(u.email, '') AS email, CAST(u.organizational_unit_id AS CHAR) AS donViId,
    COALESCE(o.unit_name, '') AS donVi, u.account_status AS accountStatus,
    (SELECT GROUP_CONCAT(CASE s.scope_type
      WHEN 'GLOBAL' THEN 'Toàn hệ thống'
      WHEN 'ORG_UNIT' THEN CONCAT('Đơn vị: ',su.unit_name)
      WHEN 'MAJOR' THEN CONCAT('Ngành: ',sm.major_name)
      WHEN 'PROGRAM' THEN CONCAT('Chương trình: ',sp.program_code)
      END SEPARATOR '; ')
      FROM user_scopes s LEFT JOIN organizational_units su ON su.id=s.organizational_unit_id
      LEFT JOIN majors sm ON sm.id=s.major_id LEFT JOIN training_programs sp ON sp.id=s.program_id
      WHERE s.user_id=u.id) AS scopeSummary,
    (SELECT r.role_code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.status = 'ACTIVE'
      ORDER BY CASE WHEN r.role_code IN ('ADMIN','TRAINING_OFFICER','APPROVER','LECTURER','STUDENT') THEN FIELD(r.role_code, 'ADMIN','TRAINING_OFFICER','APPROVER','LECTURER','STUDENT') ELSE 99 END, r.id LIMIT 1) AS roleCode
  FROM users u LEFT JOIN organizational_units o ON o.id = u.organizational_unit_id
`;
const CATEGORY_SELECT = Object.entries(CATEGORIES)
  .map(
    ([type, config]) => `
  SELECT CONCAT('${type}:', CAST(id AS CHAR)) AS id, ${config.code} AS maDanhMuc,
    ${config.name} AS tenDanhMuc, '${type}' AS loaiDanhMuc,
    COALESCE(description, '') AS moTa, status
  FROM ${config.table}
`,
  )
  .join(" UNION ALL ");
const AUDIT_SELECT = `
  SELECT CAST(a.id AS CHAR) AS id, a.created_at AS thoiGian,
    COALESCE(u.full_name, a.actor_username, 'Hệ thống') AS nguoiThucHien,
    COALESCE(a.actor_role, (SELECT GROUP_CONCAT(r.role_name ORDER BY r.id SEPARATOR ', ')
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = a.actor_id), '—') AS vaiTro,
    a.action AS hanhDong,
    COALESCE(a.reason, CONCAT(a.action, ' ', a.entity_type, COALESCE(CONCAT(' #', a.entity_id), ''))) AS moTa,
    COALESCE(a.ip_address, '') AS diaChiIP
  FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
`;

function pageResult<T>(
  data: T[],
  total: number,
  query: ListQuery,
): PageResult<T> {
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
export class MysqlAdminRepository extends AdminRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  private mapMajor(row): MajorItem {
    const programCount = Number(row.programCount),
      userScopeCount = Number(row.userScopeCount),
      registrationScopeCount = Number(row.registrationScopeCount);
    return {
      ...row,
      id: String(row.id),
      unitId: String(row.unitId),
      programCount,
      userScopeCount,
      registrationScopeCount,
      identityLocked:
        programCount + userScopeCount + registrationScopeCount > 0,
    };
  }
  private async getMajor(
    manager: EntityManager,
    id: string,
    lock = false,
  ): Promise<MajorItem> {
    const [row] = await manager.query(
      MAJOR_SELECT + " WHERE m.id=?" + (lock ? " FOR UPDATE" : ""),
      [id],
    );
    if (!row) throw new NotFoundException("Không tìm thấy ngành đào tạo.");
    return this.mapMajor(row);
  }
  majorDetail(id: string) {
    return this.getMajor(this.dataSource.manager, id);
  }
  async majorOptions() {
    const units = await this.dataSource.query(
      "SELECT CAST(id AS CHAR) id,unit_code code,unit_name name FROM organizational_units WHERE status='ACTIVE' ORDER BY unit_name,id",
    );
    return { units };
  }
  async listMajors(query: MajorQuery): Promise<PageResult<MajorItem>> {
    const search = query.searchTerm || "",
      status = query.status || "ALL",
      unit = query.unitId || "";
    const where =
      " WHERE (?='' OR LOCATE(?,m.major_code)>0 OR LOCATE(?,m.major_name)>0 OR LOCATE(?,u.unit_name)>0) AND (?='ALL' OR m.status=?) AND (?='' OR m.organizational_unit_id=?)";
    const args = [search, search, search, search, status, status, unit, unit];
    const rows = await this.dataSource.query(
      MAJOR_SELECT + where + " ORDER BY m.major_code,m.id LIMIT ? OFFSET ?",
      [...args, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.dataSource.query(
      "SELECT COUNT(*) total" + MAJOR_FROM + where,
      args,
    );
    return pageResult(
      rows.map((row) => this.mapMajor(row)),
      Number(count.total),
      query,
    );
  }
  private majorVersion(item: MajorItem, expected?: string) {
    if (!expected || item.updatedAt !== expected)
      throw new ConflictException(
        "Ngành đã thay đổi sau khi mở form. Đóng form, tải lại danh sách rồi thử lại.",
      );
  }
  private facultySelect() {
    const refs = [
      ["training_programs", "managing_unit_id"],
      ["majors", "organizational_unit_id"],
      ["users", "organizational_unit_id"],
      ["user_scopes", "organizational_unit_id"],
      ["courses", "owning_unit_id"],
      ["students", "organizational_unit_id"],
      ["thesis_supervisors", "owning_unit_id"],
      ["audit_logs", "scope_unit_id"],
      ["organizational_units", "parent_id"],
    ];
    const count = (table: string, column: string) =>
      `(SELECT COUNT(*) FROM ${table} ref WHERE ref.${column}=u.id)`;
    return `SELECT CAST(u.id AS CHAR) id,u.unit_code code,u.unit_name name,COALESCE(u.description,'') description,u.status,
      CAST(u.parent_id AS CHAR) parentId,p.unit_name parentName,DATE_FORMAT(u.updated_at,'%Y-%m-%d %H:%i:%s.%f') updatedAt,
      ${count("majors", "organizational_unit_id")} majorCount,${count("training_programs", "managing_unit_id")} programCount,
      ${count("organizational_units", "parent_id")} childCount,(${refs.map(([t, c]) => count(t, c)).join("+")}) referenceCount
      FROM organizational_units u LEFT JOIN organizational_units p ON p.id=u.parent_id`;
  }
  private mapFaculty(row): FacultyItem {
    return {
      ...row,
      majorCount: Number(row.majorCount),
      programCount: Number(row.programCount),
      childCount: Number(row.childCount),
      referenceCount: Number(row.referenceCount),
    };
  }
  async listFaculties(query: FacultyQuery) {
    const search = query.searchTerm || "",
      status = query.status || "ALL";
    const where =
      " WHERE u.unit_type='FACULTY' AND (?='ALL' OR u.status=?) AND (?='' OR LOCATE(?,u.unit_code)>0 OR LOCATE(?,u.unit_name)>0)";
    const params = [status, status, search, search, search];
    const rows = await this.dataSource.query(
      this.facultySelect() +
        where +
        " ORDER BY u.unit_name,u.id LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.dataSource.query(
      "SELECT COUNT(*) total FROM organizational_units u" + where,
      params,
    );
    return pageResult<FacultyItem>(
      rows.map((row) => this.mapFaculty(row)),
      Number(count.total),
      query,
    );
  }
  private async faculty(manager: EntityManager, id: string, lock = false) {
    if (lock)
      await manager.query(
        "SELECT id FROM organizational_units WHERE id=? AND unit_type='FACULTY' FOR UPDATE",
        [id],
      );
    const [row] = await manager.query(
      this.facultySelect() + " WHERE u.id=? AND u.unit_type='FACULTY'",
      [id],
    );
    if (!row)
      throw new NotFoundException(
        "Không tìm thấy khoa. Bộ môn/đơn vị khác được quản lý trong danh mục dùng chung.",
      );
    return this.mapFaculty(row);
  }
  async saveFaculty(
    id: string | null,
    input: FacultyInput,
    actor: Actor,
    expectedUpdatedAt?: string,
  ) {
    return this.write(actor, async (manager) => {
      const old = id ? await this.faculty(manager, id, true) : null;
      const [duplicate] = await manager.query(
        "SELECT id FROM organizational_units WHERE unit_code=? AND id<>? LIMIT 1",
        [input.code, id || "0"],
      );
      if (duplicate) throw new ConflictException("Mã khoa/đơn vị đã tồn tại.");
      if (old && old.updatedAt !== expectedUpdatedAt)
        throw new ConflictException(
          "Khoa đã thay đổi. Tải lại danh sách trước khi sửa.",
        );
      if (old)
        await manager.query(
          "UPDATE organizational_units SET unit_code=?,unit_name=?,description=?,status=? WHERE id=?",
          [input.code, input.name, input.description, input.status, id],
        );
      else {
        const saved = await manager.query(
          "INSERT INTO organizational_units(unit_code,unit_name,description,status,unit_type) VALUES(?,?,?,?,'FACULTY')",
          [input.code, input.name, input.description, input.status],
        );
        id = String(saved.insertId);
      }
      const item = await this.faculty(manager, id!);
      await this.audit(
        manager,
        actor,
        old ? "UPDATE" : "CREATE",
        "organizational_units",
        id,
        old,
        item,
        (old ? "Cập nhật khoa " : "Thêm khoa ") + item.code,
      );
      return item;
    });
  }
  async deleteFaculty(id: string, expectedUpdatedAt: string, actor: Actor) {
    return this.write(actor, async (manager) => {
      const old = await this.faculty(manager, id, true);
      if (old.updatedAt !== expectedUpdatedAt)
        throw new ConflictException("Khoa đã thay đổi. Tải lại trước khi xóa.");
      if (old.referenceCount)
        throw new ConflictException(
          "Khoa còn dữ liệu hoặc đơn vị con. Có thể chuyển sang ngừng hoạt động thay vì xóa.",
        );
      await manager.query(
        "DELETE FROM organizational_unit_closure WHERE descendant_id=?",
        [id],
      );
      await manager.query("DELETE FROM organizational_units WHERE id=?", [id]);
      await this.audit(
        manager,
        actor,
        "DELETE",
        "organizational_units",
        id,
        old,
        null,
        "Xóa khoa " + old.code,
      );
    });
  }
  async majorImportLimits(): Promise<MajorImportLimits> {
    const settings = await this.dataSource.query(
      "SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('import.max_file_mb','import.max_rows')",
    );
    const values = Object.fromEntries(
      settings.map((row) => [row.setting_key, Number(row.setting_value)]),
    );
    const mb = values["import.max_file_mb"],
      rows = values["import.max_rows"];
    if (
      !Number.isFinite(mb) ||
      mb <= 0 ||
      !Number.isSafeInteger(rows) ||
      rows < 1
    )
      throw new BadRequestException(
        "Cần cấu hình import.max_file_mb và import.max_rows hợp lệ trong CSDL.",
      );
    return {
      maxFileBytes: Math.min(Math.floor(mb * 1024 * 1024), 5 * 1024 * 1024),
      maxRows: Math.min(rows, 5000),
    };
  }
  private async checkMajorRows(
    manager: EntityManager,
    rows: MajorImportRow[],
    lock = false,
  ): Promise<MajorImportRow[]> {
    // SQL comparisons use the database collation, including accented/case-insensitive unit codes.
    const result: MajorImportRow[] = [];
    for (const row of rows) {
      const checked = { ...row, errors: [...row.errors] };
      const [unit] = await manager.query(
        "SELECT CAST(id AS CHAR) id,unit_name name,status FROM organizational_units WHERE unit_code=?" +
          (lock ? " FOR UPDATE" : ""),
        [row.unitCode],
      );
      if (!unit) checked.errors.push("Mã đơn vị không tồn tại trong CSDL.");
      else if (unit.status !== "ACTIVE")
        checked.errors.push("Đơn vị đã ngừng hoạt động.");
      else {
        checked.unitId = String(unit.id);
        checked.unitName = unit.name;
      }
      const [existing] = await manager.query(
        "SELECT id FROM majors WHERE major_code=?",
        [row.majorCode],
      );
      if (existing) checked.errors.push("Mã ngành đã tồn tại trong CSDL.");
      result.push(checked);
    }
    return result;
  }
  async checkMajorImport(rows: MajorImportRow[]) {
    return this.checkMajorRows(this.dataSource.manager, rows);
  }
  async commitMajorImport(rows: MajorImportRow[], actor: Actor) {
    return this.write(actor, async (manager) => {
      const limits = await this.majorImportLimits();
      if (rows.length > limits.maxRows)
        throw new BadRequestException("Số dòng vượt cấu hình nhập hiện tại.");
      const checked = await this.checkMajorRows(manager, rows, true);
      const invalid = checked.filter((row) => row.errors.length);
      if (invalid.length)
        throw new ConflictException(
          invalid
            .slice(0, 20)
            .map((row) => `Dòng ${row.rowNumber}: ${row.errors.join(" ")}`),
        );
      for (const row of checked) {
        const saved = await manager.query(
          "INSERT INTO majors(major_code,major_name,organizational_unit_id,status) VALUES(?,?,?,?)",
          [row.majorCode, row.majorName, row.unitId, row.status],
        );
        await this.audit(
          manager,
          actor,
          "CREATE",
          "majors",
          String(saved.insertId),
          null,
          row,
          "Nhập Excel ngành " + row.majorCode,
        );
      }
      return { created: checked.length };
    });
  }
  async saveMajor(
    id: string | null,
    input: MajorInput,
    actor: Actor,
    expectedUpdatedAt?: string,
  ): Promise<MajorItem> {
    return this.write(actor, async (manager) => {
      const old = id ? await this.getMajor(manager, id, true) : null;
      if (old) {
        this.majorVersion(old, expectedUpdatedAt);
        if (
          old.identityLocked &&
          (old.majorCode !== input.majorCode || old.unitId !== input.unitId)
        )
          throw new ConflictException(
            "Ngành đã được sử dụng: không đổi mã hoặc đơn vị quản lý. Có thể sửa tên hoặc ngừng sử dụng.",
          );
      }
      const [duplicate] = await manager.query(
        "SELECT id FROM majors WHERE major_code=? AND id<>? LIMIT 1",
        [input.majorCode, id || "0"],
      );
      if (duplicate) throw new ConflictException("Mã ngành đã tồn tại.");
      const [unit] = await manager.query(
        "SELECT id,status FROM organizational_units WHERE id=? FOR UPDATE",
        [input.unitId],
      );
      if (!unit) throw new BadRequestException("Đơn vị quản lý không tồn tại.");
      if (
        unit.status !== "ACTIVE" &&
        (!old || old.unitId !== input.unitId || input.status === "ACTIVE")
      )
        throw new BadRequestException("Chọn đơn vị quản lý đang hoạt động.");
      if (old)
        await manager.query(
          "UPDATE majors SET major_code=?,major_name=?,organizational_unit_id=?,status=? WHERE id=?",
          [input.majorCode, input.majorName, input.unitId, input.status, id],
        );
      else {
        const saved = await manager.query(
          "INSERT INTO majors(major_code,major_name,organizational_unit_id,status) VALUES(?,?,?,?)",
          [input.majorCode, input.majorName, input.unitId, input.status],
        );
        id = String(saved.insertId);
      }
      const item = await this.getMajor(manager, id!);
      await this.audit(
        manager,
        actor,
        old ? "UPDATE" : "CREATE",
        "majors",
        id,
        old,
        item,
        (old ? "Cập nhật ngành " : "Thêm ngành ") + item.majorCode,
      );
      return item;
    });
  }
  async deleteMajor(
    id: string,
    expectedUpdatedAt: string,
    actor: Actor,
  ): Promise<void> {
    await this.write(actor, async (manager) => {
      const old = await this.getMajor(manager, id, true);
      this.majorVersion(old, expectedUpdatedAt);
      if (old.identityLocked)
        throw new ConflictException(
          "Ngành đang được CTĐT hoặc phạm vi dữ liệu sử dụng. Hãy ngừng sử dụng thay vì xóa.",
        );
      await manager.query("DELETE FROM majors WHERE id=?", [id]);
      await this.audit(
        manager,
        actor,
        "DELETE",
        "majors",
        id,
        old,
        null,
        "Xóa ngành " + old.majorCode,
      );
    });
  }

  private mapUser(row): UserItem {
    return {
      id: String(row.id),
      username: row.username,
      hoTen: row.hoTen,
      email: row.email,
      donViId: row.donViId == null ? "" : String(row.donViId),
      donVi: row.donVi,
      vaiTro: (ROLE_ALIASES[row.roleCode] || "HOC_VIEN") as UserRole,
      trangThai: row.accountStatus === "ACTIVE",
      accountStatus: row.accountStatus,
      scopeSummary: row.scopeSummary || "Chưa cấp phạm vi",
    };
  }

  private async getUser(manager: EntityManager, id: string): Promise<UserItem> {
    const [row] = await manager.query(
      USER_SELECT + " WHERE u.id = ? AND u.deleted_at IS NULL",
      [id],
    );
    if (!row) throw new NotFoundException("Không tìm thấy tài khoản.");
    return this.mapUser(row);
  }

  async listUsers(query: ListQuery): Promise<PageResult<UserItem>> {
    const search = query.searchTerm || "";
    const role = ROLE_CODES[query.selectedRole] || "ALL";
    const where = ` WHERE u.deleted_at IS NULL
      AND (? = '' OR LOCATE(?, u.full_name) > 0 OR LOCATE(?, COALESCE(u.email, '')) > 0
        OR LOCATE(?, COALESCE(o.unit_name, '')) > 0 OR LOCATE(?, u.username) > 0)
      AND (? = 'ALL' OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.role_code = ? AND r.status = 'ACTIVE'))`;
    const params = [search, search, search, search, search, role, role];
    const rows = await this.dataSource.query(
      USER_SELECT + where + " ORDER BY u.id DESC LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.dataSource.query(
      "SELECT COUNT(*) AS total FROM users u LEFT JOIN organizational_units o ON o.id = u.organizational_unit_id" +
        where,
      params,
    );
    return pageResult(
      rows.map((row) => this.mapUser(row)),
      Number(count.total),
      query,
    );
  }

  async userOptions() {
    const units = await this.dataSource.query(
      "SELECT CAST(id AS CHAR) AS id, unit_name AS name FROM organizational_units WHERE status = 'ACTIVE' ORDER BY unit_name",
    );
    return { units };
  }

  private async write<T>(
    actor: Actor,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query("SET time_zone = '+00:00'");
        // Serialize administrative writes and re-check authority inside the transaction.
        await manager.query(
          "SELECT id FROM roles WHERE role_code = 'ADMIN' FOR UPDATE",
        );
        const [activeAdmin] = await manager.query(
          `SELECT u.id FROM users u
          JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
          WHERE u.id = ? AND u.deleted_at IS NULL AND u.account_status = 'ACTIVE'
            AND r.role_code = 'ADMIN' AND r.status = 'ACTIVE'
            AND EXISTS (SELECT 1 FROM user_roles pur JOIN roles pr ON pr.id=pur.role_id JOIN role_permissions rp ON rp.role_id=pr.id JOIN permissions p ON p.id=rp.permission_id WHERE pur.user_id=u.id AND pr.status='ACTIVE' AND p.permission_code=?) FOR UPDATE`,
          [actor.id, actor.permission || ""],
        );
        if (!activeAdmin)
          throw new ForbiddenException(
            "Quyền quản trị đã thay đổi. Vui lòng đăng nhập lại.",
          );
        return callback(manager);
      });
    } catch (error) {
      const code = error.driverError?.code || error.code;
      if (code === "ER_DUP_ENTRY")
        throw new ConflictException("Mã, tên đăng nhập hoặc email đã tồn tại.");
      if (code === "ER_ROW_IS_REFERENCED_2")
        throw new ConflictException(
          "Danh mục đang được sử dụng, không thể xóa.",
        );
      if (code === "ER_NO_REFERENCED_ROW_2")
        throw new BadRequestException("Dữ liệu tham chiếu không tồn tại.");
      throw error;
    }
  }

  private async audit(
    manager: EntityManager,
    actor: Actor,
    action: string,
    entity: string,
    id: string | null,
    oldValue: unknown,
    newValue: unknown,
    reason: string,
  ) {
    await manager.query(
      `INSERT INTO audit_logs
      (actor_id, actor_username, actor_role, action, entity_type, entity_id, old_value, new_value, reason, ip_address)
      VALUES (?, ?, 'Quản trị viên', ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.id,
        actor.username,
        action,
        entity,
        id,
        oldValue == null ? null : JSON.stringify(oldValue),
        newValue == null ? null : JSON.stringify(newValue),
        reason,
        actor.ip,
      ],
    );
  }

  private async validateUserReferences(
    manager: EntityManager,
    input: UserInput,
    existingUnit?: string,
  ) {
    if (input.scopeMode === "UNIT" && !input.donViId)
      throw new BadRequestException("Chọn đơn vị khi cấp phạm vi đơn vị.");
    if (input.donViId) {
      const [unit] = await manager.query(
        "SELECT id,status FROM organizational_units WHERE id=?",
        [input.donViId],
      );
      if (!unit || (unit.status !== "ACTIVE" && input.donViId !== existingUnit))
        throw new BadRequestException(
          "Đơn vị không tồn tại hoặc đã ngừng hoạt động.",
        );
    }
    const [role] = await manager.query(
      "SELECT CAST(id AS CHAR) AS id FROM roles WHERE role_code = ? AND status = 'ACTIVE'",
      [ROLE_CODES[input.vaiTro]],
    );
    if (!role)
      throw new BadRequestException(
        "Vai trò không tồn tại hoặc đã ngừng hoạt động.",
      );
    return String(role.id);
  }

  private async scopePermission(manager: EntityManager, actor: Actor) {
    const [permission] = await manager.query(
      "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE' AND p.permission_code='ROLE_SCOPE_MANAGE' LIMIT 1",
      [actor.id],
    );
    if (!permission)
      throw new ForbiddenException(
        "Bạn chưa có quyền gán vai trò và phạm vi dữ liệu.",
      );
  }
  private async applyScope(
    manager: EntityManager,
    id: string,
    input: UserInput,
    actor: Actor,
  ) {
    if (!input.scopeMode || input.scopeMode === "KEEP") return;
    await this.scopePermission(manager, actor);
    await manager.query("DELETE FROM user_scopes WHERE user_id=?", [id]);
    if (input.scopeMode === "GLOBAL")
      await manager.query(
        "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
        [id],
      );
    if (input.scopeMode === "UNIT")
      await manager.query(
        "INSERT INTO user_scopes (user_id,scope_type,organizational_unit_id) VALUES (?,'ORG_UNIT',?)",
        [id, input.donViId],
      );
  }

  async createUser(
    input: UserInput,
    username: string,
    passwordHash: string,
    actor: Actor,
  ): Promise<UserItem> {
    return this.write(actor, async (manager) => {
      await this.scopePermission(manager, actor);
      const [duplicate] = await manager.query(
        "SELECT id FROM users WHERE username IN (?,?) OR email IN (?,?) LIMIT 1",
        [username, input.email, username, input.email],
      );
      if (duplicate)
        throw new ConflictException(
          "Tên đăng nhập hoặc email đã được sử dụng.",
        );
      const roleId = await this.validateUserReferences(manager, input);
      await manager.query(
        `INSERT INTO users (username, email, full_name, organizational_unit_id, password_hash, account_status, must_change_password)
        VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          username,
          input.email,
          input.hoTen,
          input.donViId || null,
          passwordHash,
          input.trangThai ? "ACTIVE" : "DISABLED",
        ],
      );
      const [{ id }] = await manager.query(
        "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
      );
      await manager.query(
        "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)",
        [id, roleId, actor.id],
      );
      await this.applyScope(manager, id, input, actor);
      const user = await this.getUser(manager, id);
      await this.audit(
        manager,
        actor,
        "CREATE",
        "user",
        id,
        null,
        user,
        `Tạo tài khoản ${username}`,
      );
      return user;
    });
  }

  async updateUser(
    id: string,
    input: UserInput,
    actor: Actor,
  ): Promise<UserItem> {
    return this.write(actor, async (manager) => {
      const old = await this.getUser(manager, id);
      if (
        input.donViId !== old.donViId &&
        (!input.scopeMode || input.scopeMode === "KEEP")
      ) {
        const [scope] = await manager.query(
          "SELECT COUNT(*) total,SUM(scope_type='ORG_UNIT') unitCount FROM user_scopes WHERE user_id=?",
          [id],
        );
        if (
          Number(scope.total) > 0 &&
          Number(scope.total) === Number(scope.unitCount)
        )
          throw new BadRequestException(
            "Khi chuyển đơn vị, hãy chọn lại phạm vi dữ liệu (Đơn vị công tác và đơn vị con), tránh giữ nhầm quyền khoa cũ.",
          );
      }
      const [emailConflict] = await manager.query(
        "SELECT id FROM users WHERE id<>? AND (username=? OR email=?) LIMIT 1",
        [id, input.email, input.email],
      );
      if (emailConflict) throw new ConflictException("Email đã được sử dụng.");
      if (
        id === actor.id &&
        (!input.trangThai || input.vaiTro !== "QUAN_TRI")
      ) {
        throw new ConflictException(
          "Không thể tự khóa hoặc tự hạ quyền quản trị.",
        );
      }
      const roleId = await this.validateUserReferences(
        manager,
        input,
        old.donViId,
      );
      await manager.query(
        `UPDATE users SET full_name = ?, email = ?, organizational_unit_id = ?, account_status = ?,
        failed_login_count = 0, locked_until = NULL WHERE id = ? AND deleted_at IS NULL`,
        [
          input.hoTen,
          input.email,
          input.donViId || null,
          input.trangThai ? "ACTIVE" : "DISABLED",
          id,
        ],
      );
      if (!input.trangThai || input.email !== old.email) {
        await manager.query(
          "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
          [id],
        );
        await manager.query(
          "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
          [id],
        );
      }
      if (input.vaiTro !== old.vaiTro) {
        await this.scopePermission(manager, actor);
        await manager.query("DELETE FROM user_roles WHERE user_id = ?", [id]);
        await manager.query(
          "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)",
          [id, roleId, actor.id],
        );
      }
      await this.applyScope(manager, id, input, actor);
      const user = await this.getUser(manager, id);
      await this.audit(
        manager,
        actor,
        "UPDATE",
        "user",
        id,
        old,
        user,
        `Cập nhật tài khoản ${user.username}`,
      );
      return user;
    });
  }

  async deleteUser(id: string, actor: Actor): Promise<void> {
    return this.write(actor, async (manager) => {
      if (id === actor.id)
        throw new ConflictException(
          "Không thể tự xóa tài khoản đang đăng nhập.",
        );
      const old = await this.getUser(manager, id);
      await manager.query(
        "UPDATE users SET deleted_at = UTC_TIMESTAMP(6), account_status = 'DISABLED' WHERE id = ?",
        [id],
      );
      await manager.query(
        "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
        [id],
      );
      await manager.query(
        "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
        [id],
      );
      await this.audit(
        manager,
        actor,
        "DELETE",
        "user",
        id,
        old,
        null,
        `Xóa mềm tài khoản ${old.username}`,
      );
    });
  }

  async listCategories(query: ListQuery): Promise<PageResult<CategoryItem>> {
    const search = query.searchTerm || "";
    const type = query.selectedType || "ALL";
    const where = ` WHERE (? = '' OR LOCATE(?, c.maDanhMuc) > 0 OR LOCATE(?, c.tenDanhMuc) > 0)
      AND (? = 'ALL' OR c.loaiDanhMuc = ?)`;
    const params = [search, search, search, type, type];
    const rows = await this.dataSource.query(
      "SELECT * FROM (" +
        CATEGORY_SELECT +
        ") c" +
        where +
        " ORDER BY c.loaiDanhMuc, c.maDanhMuc, c.id LIMIT ? OFFSET ?",
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    const [count] = await this.dataSource.query(
      "SELECT COUNT(*) AS total FROM (" + CATEGORY_SELECT + ") c" + where,
      params,
    );
    return pageResult(
      rows.map(({ status, ...row }) => ({
        ...row,
        trangThai: status === "ACTIVE",
      })),
      Number(count.total),
      query,
    );
  }

  private categoryId(composite: string) {
    const [type, id] = composite.split(":");
    if (!CATEGORIES[type] || !/^[1-9]\d{0,19}$/.test(id || ""))
      throw new BadRequestException("ID danh mục không hợp lệ.");
    return { type, id, config: CATEGORIES[type] };
  }

  private async getCategory(
    manager: EntityManager,
    composite: string,
  ): Promise<CategoryItem> {
    const { type, id, config } = this.categoryId(composite);
    const [row] = await manager.query(
      `SELECT ${config.code} AS maDanhMuc, ${config.name} AS tenDanhMuc,
      COALESCE(description, '') AS moTa, status FROM ${config.table} WHERE id = ?`,
      [id],
    );
    if (!row) throw new NotFoundException("Không tìm thấy danh mục.");
    return {
      id: composite,
      loaiDanhMuc: type,
      maDanhMuc: row.maDanhMuc,
      tenDanhMuc: row.tenDanhMuc,
      moTa: row.moTa,
      trangThai: row.status === "ACTIVE",
    } as CategoryItem;
  }

  async saveCategory(
    composite: string | null,
    input: CategoryInput,
    actor: Actor,
  ): Promise<CategoryItem> {
    return this.write(actor, async (manager) => {
      const config = CATEGORIES[input.loaiDanhMuc];
      let id: string;
      let old: CategoryItem | null = null;
      if (composite) {
        const parsed = this.categoryId(composite);
        if (parsed.type !== input.loaiDanhMuc)
          throw new BadRequestException("Không thể đổi loại danh mục khi sửa.");
        id = parsed.id;
        old = await this.getCategory(manager, composite);
        await manager.query(
          `UPDATE ${config.table} SET ${config.code} = ?, ${config.name} = ?, description = ?, status = ? WHERE id = ?`,
          [
            input.maDanhMuc,
            input.tenDanhMuc,
            input.moTa,
            input.trangThai ? "ACTIVE" : "INACTIVE",
            id,
          ],
        );
      } else {
        const extraColumn =
          input.loaiDanhMuc === "KHOA_QUAN_LY" ? ", unit_type" : "";
        const extraValue =
          input.loaiDanhMuc === "KHOA_QUAN_LY" ? ", 'FACULTY'" : "";
        await manager.query(
          `INSERT INTO ${config.table} (${config.code}, ${config.name}, description, status${extraColumn})
          VALUES (?, ?, ?, ?${extraValue})`,
          [
            input.maDanhMuc,
            input.tenDanhMuc,
            input.moTa,
            input.trangThai ? "ACTIVE" : "INACTIVE",
          ],
        );
        [{ id }] = await manager.query(
          "SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id",
        );
        composite = input.loaiDanhMuc + ":" + id;
      }
      const item = await this.getCategory(manager, composite);
      await this.audit(
        manager,
        actor,
        old ? "UPDATE" : "CREATE",
        config.table,
        id,
        old,
        item,
        `${old ? "Cập nhật" : "Tạo"} danh mục ${input.maDanhMuc}`,
      );
      return item;
    });
  }

  async deleteCategory(composite: string, actor: Actor): Promise<void> {
    return this.write(actor, async (manager) => {
      const { id, config } = this.categoryId(composite);
      const old = await this.getCategory(manager, composite);
      if (config.table === "organizational_units") {
        const [accounts] = await manager.query(
          "SELECT COUNT(*) AS total FROM users WHERE organizational_unit_id = ?",
          [id],
        );
        if (Number(accounts.total))
          throw new ConflictException(
            "Đơn vị còn tài khoản tham chiếu, không thể xóa.",
          );
        const [children] = await manager.query(
          "SELECT COUNT(*) AS total FROM organizational_unit_closure WHERE ancestor_id = ? AND descendant_id <> ?",
          [id, id],
        );
        if (Number(children.total))
          throw new ConflictException(
            "Đơn vị còn có đơn vị con, không thể xóa.",
          );
        // Insert triggers add a self/ancestor closure row even for unused leaf units.
        // A later FK failure rolls this deletion back together with the unit deletion.
        await manager.query(
          "DELETE FROM organizational_unit_closure WHERE descendant_id = ?",
          [id],
        );
      }
      await manager.query(`DELETE FROM ${config.table} WHERE id = ?`, [id]);
      await this.audit(
        manager,
        actor,
        "DELETE",
        config.table,
        id,
        old,
        null,
        `Xóa danh mục ${old.maDanhMuc}`,
      );
    });
  }

  private async readSettings(manager: EntityManager): Promise<Settings> {
    const rows = await manager.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'training.%'",
    );
    const settings = { ...SETTING_DEFAULTS };
    for (const row of rows) {
      const field = row.setting_key.slice("training.".length);
      if (Object.prototype.hasOwnProperty.call(settings, field))
        settings[field] = row.setting_value;
    }
    return settings;
  }

  getSettings(): Promise<Settings> {
    return this.readSettings(this.dataSource.manager);
  }

  async saveSettings(settings: Settings, actor: Actor): Promise<Settings> {
    return this.write(actor, async (manager) => {
      const old = await this.readSettings(manager);
      for (const [key, value] of Object.entries(settings)) {
        const type = key.startsWith("ngoaiNgu")
          ? "STRING"
          : key === "diemDatHocPhan"
            ? "DECIMAL"
            : "INTEGER";
        await manager.query(
          `INSERT INTO system_settings (setting_key, value_type, setting_value, updated_by)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value_type = VALUES(value_type), setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          ["training." + key, type, value, actor.id],
        );
      }
      await this.audit(
        manager,
        actor,
        "UPDATE",
        "system_settings",
        null,
        old,
        settings,
        "Cập nhật cấu hình tham số đào tạo",
      );
      return { ...settings };
    });
  }

  async listAudit(
    query: ListQuery,
    all = false,
  ): Promise<PageResult<AuditItem>> {
    const search = query.searchTerm || "";
    const action = query.selectedAction || "ALL";
    const where = ` WHERE (? = '' OR LOCATE(?, COALESCE(u.full_name, a.actor_username, '')) > 0
      OR LOCATE(?, COALESCE(a.reason, CONCAT(a.action, ' ', a.entity_type))) > 0
      OR LOCATE(?, COALESCE(a.ip_address, '')) > 0)
      AND (? = 'ALL' OR a.action = ?)`;
    const params: (string | number)[] = [
      search,
      search,
      search,
      search,
      action,
      action,
    ];
    let sql = AUDIT_SELECT + where + " ORDER BY a.created_at DESC, a.id DESC";
    if (!all) {
      sql += " LIMIT ? OFFSET ?";
      params.push(query.limit, (query.page - 1) * query.limit);
    }
    const rows = await this.dataSource.query(sql, params);
    const [count] = await this.dataSource.query(
      "SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id" +
        where,
      params.slice(0, 6),
    );
    return pageResult(
      rows.map((row) => ({
        ...row,
        id: String(row.id),
        thoiGian:
          row.thoiGian instanceof Date
            ? row.thoiGian.toISOString()
            : row.thoiGian,
      })),
      Number(count.total),
      query,
    );
  }
}
