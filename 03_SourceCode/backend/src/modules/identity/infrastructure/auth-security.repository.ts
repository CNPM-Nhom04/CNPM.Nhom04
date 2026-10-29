import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { User } from "../domain/user.entity";
import {
  AuthPolicy,
  AuthSecurityRepository,
  AccountAccess,
} from "../domain/auth-security.repository";

@Injectable()
export class MysqlAuthSecurityRepository extends AuthSecurityRepository {
  constructor(private readonly db: DataSource) {
    super();
  }

  private async transaction<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.transaction("READ COMMITTED", async (manager) => {
          await manager.query("SET time_zone = '+00:00'");
          return callback(manager);
        });
      } catch (error) {
        const code = error.driverError?.code || error.code;
        if (
          attempt >= 2 ||
          ![
            "ER_LOCK_DEADLOCK",
            "ER_LOCK_WAIT_TIMEOUT",
            "ER_CHECKREAD",
          ].includes(code)
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
      }
    }
  }

  async policy(): Promise<AuthPolicy> {
    const rows = await this.db.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('account.lock_threshold','account.lock_minutes','session.timeout_minutes','account.reset_token_minutes','account.password_min_length')",
    );
    const values = Object.fromEntries(
      rows.map((row) => [row.setting_key, row.setting_value]),
    );
    const number = (
      key: string,
      fallback: number,
      min: number,
      max: number,
    ) => {
      const value = values[key] == null ? fallback : Number(values[key]);
      if (!Number.isInteger(value) || value < min || value > max)
        throw new ServiceUnavailableException(
          "Tham số xác thực trong database không hợp lệ: " + key,
        );
      return value;
    };
    return {
      lockThreshold: number("account.lock_threshold", 5, 1, 100),
      lockMinutes: number("account.lock_minutes", 15, 1, 1440),
      sessionMinutes: number("session.timeout_minutes", 30, 1, 1440),
      resetMinutes: number("account.reset_token_minutes", 30, 1, 1440),
      passwordMinLength: number("account.password_min_length", 10, 10, 72),
    };
  }

  async access(userId: string): Promise<AccountAccess> {
    const roles = await this.db.query(
      "SELECT r.role_code, r.role_name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.status='ACTIVE' ORDER BY r.id",
      [userId],
    );
    const permissions = await this.db.query(
      "SELECT DISTINCT p.permission_code FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE' ORDER BY p.permission_code",
      [userId],
    );
    const [org] = await this.db.query(
      "SELECT o.unit_name FROM users u LEFT JOIN organizational_units o ON o.id=u.organizational_unit_id WHERE u.id=?",
      [userId],
    );
    return {
      roles: roles.map((r) => r.role_code),
      roleNames: roles.map((r) => r.role_name),
      permissions: permissions.map((p) => p.permission_code),
      orgUnitName: org?.unit_name || null,
    };
  }

  private lockedUser(manager: EntityManager, id: string) {
    return manager
      .getRepository(User)
      .findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
  }
  private async audit(
    manager: EntityManager,
    user: User,
    action: string,
    reason: string,
    ip?: string,
  ) {
    await manager.query(
      "INSERT INTO audit_logs (actor_id,actor_username,actor_role,action,entity_type,entity_id,reason,ip_address) VALUES (?,?,(SELECT LEFT(COALESCE(GROUP_CONCAT(r.role_name ORDER BY r.id SEPARATOR ', '),'Chua cap vai tro'),150) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.status='ACTIVE'),?,'user',?,?,?)",
      [user.id, user.username, user.id, action, user.id, reason, ip || null],
    );
  }
  async recordFailure(
    id: string,
    expectedHash: string,
    policy: AuthPolicy,
    ip?: string,
  ) {
    await this.transaction(async (m) => {
      const user = await this.lockedUser(m, id);
      const now = new Date();
      if (
        !user ||
        user.accountStatus !== "ACTIVE" ||
        user.passwordHash !== expectedHash ||
        (user.lockedUntil && user.lockedUntil > now)
      )
        return;
      const failures = (user.lockedUntil ? 0 : user.failedLoginCount) + 1;
      await m.update(User, id, {
        failedLoginCount: failures,
        lockedUntil:
          failures >= policy.lockThreshold
            ? new Date(now.getTime() + policy.lockMinutes * 60000)
            : null,
      });
      await this.audit(m, user, "LOGIN_FAILED", "Đăng nhập thất bại", ip);
    });
  }
  async completeLogin(
    id: string,
    expectedHash: string,
    sessionId: string,
    minutes: number,
    ip?: string,
  ) {
    return this.transaction(async (m) => {
      const user = await this.lockedUser(m, id);
      const now = new Date();
      if (
        !user ||
        user.accountStatus !== "ACTIVE" ||
        user.passwordHash !== expectedHash ||
        (user.lockedUntil && user.lockedUntil > now)
      )
        return null;
      await m.update(User, id, {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      });
      await m.query(
        "INSERT INTO auth_sessions (id,user_id,expires_at,last_seen_at,timeout_minutes) VALUES (?,?,?,?,?)",
        [
          sessionId,
          id,
          new Date(now.getTime() + minutes * 60000),
          now,
          minutes,
        ],
      );
      await this.audit(m, user, "LOGIN_SUCCESS", "Đăng nhập thành công", ip);
      return user;
    });
  }
  async validSession(userId: string, sessionId: string) {
    const result = await this.db.query(
      "UPDATE auth_sessions SET last_seen_at=UTC_TIMESTAMP(6) WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6) AND last_seen_at>TIMESTAMPADD(MINUTE,-timeout_minutes,UTC_TIMESTAMP(6))",
      [sessionId, userId],
    );
    return result.affectedRows === 1;
  }
  async revokeSession(userId: string, sessionId: string) {
    await this.transaction(async (m) => {
      const user = await this.lockedUser(m, userId);
      if (!user) return;
      const result = await m.query(
        "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE id=? AND user_id=? AND revoked_at IS NULL",
        [sessionId, userId],
      );
      if (result.affectedRows) await this.audit(m, user, "LOGOUT", "Đăng xuất");
    });
  }
  private async replacePassword(
    m: EntityManager,
    user: User,
    newHash: string,
    action: string,
  ) {
    await m.update(User, user.id, {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    await m.query(
      "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
      [user.id],
    );
    await m.query(
      "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
      [user.id],
    );
    await this.audit(
      m,
      user,
      action,
      action === "CHANGE_PASSWORD" ? "Đổi mật khẩu" : "Đặt lại mật khẩu",
    );
  }
  async changePassword(id: string, oldHash: string, newHash: string) {
    return this.transaction(async (m) => {
      const user = await this.lockedUser(m, id);
      if (
        !user ||
        user.accountStatus !== "ACTIVE" ||
        user.passwordHash !== oldHash
      )
        return false;
      await this.replacePassword(m, user, newHash, "CHANGE_PASSWORD");
      return true;
    });
  }
  async createReset(
    id: string,
    tokenHash: string,
    expiresAt: Date,
    ip?: string,
  ) {
    return this.transaction(async (m) => {
      const user = await this.lockedUser(m, id);
      if (!user || user.accountStatus !== "ACTIVE") return false;
      const [recent] = await m.query(
        "SELECT id FROM password_reset_tokens WHERE user_id=? AND created_at>TIMESTAMPADD(SECOND,-60,UTC_TIMESTAMP(6)) LIMIT 1",
        [id],
      );
      if (recent) return false;
      await m.query(
        "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
        [id],
      );
      await m.query(
        "INSERT INTO password_reset_tokens (user_id,token_hash,expires_at,requested_ip,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6))",
        [id, tokenHash, expiresAt, ip || null],
      );
      await this.audit(
        m,
        user,
        "RESET_REQUEST",
        "Yêu cầu đặt lại mật khẩu",
        ip,
      );
      return true;
    });
  }
  async consumeReset(tokenHash: string, newHash: string) {
    return this.transaction(async (m) => {
      const [ref] = await m.query(
        "SELECT CAST(user_id AS CHAR) userId FROM password_reset_tokens WHERE token_hash=?",
        [tokenHash],
      );
      if (!ref) return false;
      // All password mutations lock the user before token rows to avoid deadlocks.
      const user = await this.lockedUser(m, ref.userId);
      if (!user || user.accountStatus !== "ACTIVE") return false;
      const [token] = await m.query(
        "SELECT id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE",
        [tokenHash],
      );
      if (!token) return false;
      await this.replacePassword(m, user, newHash, "RESET_PASSWORD");
      return true;
    });
  }
}
 
