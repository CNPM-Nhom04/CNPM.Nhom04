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
