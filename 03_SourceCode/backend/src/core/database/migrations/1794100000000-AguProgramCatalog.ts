import { MigrationInterface, QueryRunner } from "typeorm";
/** Provenance and removal from active catalog; preserve historical student/grade foreign keys. */
export class AguProgramCatalog1794100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn("training_programs", "deleted_at")))
      await q.query(
        "ALTER TABLE training_programs ADD COLUMN deleted_at DATETIME(6) NULL",
      );
    await q.query(
      "ALTER TABLE program_versions MODIFY cohort_year SMALLINT UNSIGNED NULL",
    );
    await q.query(
      "ALTER TABLE program_ui_details MODIFY required_total_credits DECIMAL(6,2) NULL",
    );
    await q.query(`CREATE TABLE IF NOT EXISTS program_catalog_sources (
   program_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, source_major_id INT UNSIGNED NOT NULL UNIQUE,
   source_url VARCHAR(500) NOT NULL, institution_name VARCHAR(255) NOT NULL, original_major_code VARCHAR(50) NULL,
   retrieved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_catalog_source_program FOREIGN KEY(program_id) REFERENCES training_programs(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE IF NOT EXISTS program_version_sources (
   program_version_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, source_programme_id INT UNSIGNED NOT NULL UNIQUE,
   source_url VARCHAR(500) NOT NULL, document_url VARCHAR(500) NULL, source_hash CHAR(64) NOT NULL,
   content_text MEDIUMTEXT NULL, total_credits DECIMAL(6,2) NULL,
   retrieved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_version_source_program FOREIGN KEY(program_version_id) REFERENCES program_versions(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(): Promise<void> {
    throw new Error(
      "Giữ nguồn AGU và lịch sử CTĐT; khôi phục dữ liệu từ bản sao lưu khi cần.",
    );
  }
}
