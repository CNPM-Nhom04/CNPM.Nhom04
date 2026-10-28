import { MigrationInterface, QueryRunner } from "typeorm";

export class AuthSessions1793208000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE auth_sessions (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME(6) NOT NULL,
      last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      timeout_minutes INT UNSIGNED NOT NULL,
      revoked_at DATETIME(6) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      KEY idx_auth_sessions_user (user_id, revoked_at),
      KEY idx_auth_sessions_expiry (expires_at),
      CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE auth_sessions");
  }
}
