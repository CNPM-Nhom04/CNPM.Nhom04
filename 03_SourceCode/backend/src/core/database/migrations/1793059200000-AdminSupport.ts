import { MigrationInterface, QueryRunner } from "typeorm";

export class AdminSupport1793059200000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    for (const table of ["organizational_units", "education_levels"]) {
      if (!(await runner.hasColumn(table, "description"))) {
        await runner.query(
          `ALTER TABLE ${table} ADD COLUMN description VARCHAR(1000) NULL`,
        );
      }
    }
    if (!(await runner.hasColumn("audit_logs", "actor_role"))) {
      await runner.query(
        "ALTER TABLE audit_logs ADD COLUMN actor_role VARCHAR(150) NULL",
      );
    }
    await runner.query(`CREATE TABLE IF NOT EXISTS knowledge_blocks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      block_code VARCHAR(50) NOT NULL UNIQUE,
      block_name VARCHAR(255) NOT NULL,
      description VARCHAR(1000) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      CONSTRAINT chk_knowledge_blocks_status CHECK (status IN ('ACTIVE','INACTIVE'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runner.query(`INSERT INTO roles (role_code, role_name, description)
      SELECT 'LECTURER', 'Giảng viên', 'Giảng viên xem danh mục đào tạo'
      WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_code = 'LECTURER')`);
    await runner.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p ON p.permission_code = 'CATALOG_READ'
      WHERE r.role_code = 'LECTURER'`);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE knowledge_blocks");
    await runner.query(
      "ALTER TABLE organizational_units DROP COLUMN description",
    );
    await runner.query("ALTER TABLE education_levels DROP COLUMN description");
    await runner.query("ALTER TABLE audit_logs DROP COLUMN actor_role");
    // Keep LECTURER and existing assignments; removing an assigned role would lose access data.
  }
}
