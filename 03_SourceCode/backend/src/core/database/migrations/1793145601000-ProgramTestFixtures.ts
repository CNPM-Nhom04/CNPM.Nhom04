import { MigrationInterface, QueryRunner } from "typeorm";

/** Explicit registry, rather than hiding records by a name prefix in the UI. */
export class ProgramTestFixtures1793145601000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE program_test_fixtures (
      program_code VARCHAR(50) NOT NULL PRIMARY KEY,
      reason VARCHAR(255) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    // Backfill only fixtures whose code, title, creator and fake email match our test.
    // Real retired curricula remain visible and counted.
    await runner.query(`INSERT IGNORE INTO program_test_fixtures (program_code,reason)
      SELECT DISTINCT p.program_code,'Bản ghi tạo bởi program.integration.cjs'
      FROM training_programs p JOIN program_versions v ON v.program_id=p.id
      JOIN users u ON u.id=v.created_by
      WHERE p.program_code REGEXP '^program_smoke_[0-9]{13}$'
        AND p.program_name=CONCAT('CTĐT kiểm thử ',p.program_code)
        AND u.username=CONCAT(p.program_code,'_officer')
        AND u.email=CONCAT(u.username,'@example.invalid')
        AND u.full_name=CONCAT('Kiểm thử ',u.username)`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE program_test_fixtures");
  }
}
