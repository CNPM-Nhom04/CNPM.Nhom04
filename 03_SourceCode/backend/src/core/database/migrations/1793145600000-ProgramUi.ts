import { MigrationInterface, QueryRunner } from "typeorm";
export class ProgramUi1793145600000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE program_ui_details (
      program_version_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      english_name VARCHAR(255) NOT NULL DEFAULT '',
      study_form VARCHAR(30) NOT NULL DEFAULT 'CHINH_QUY',
      duration_label VARCHAR(150) NOT NULL DEFAULT '',
      cohort_label VARCHAR(50) NOT NULL,
      required_total_credits DECIMAL(6,2) NOT NULL,
      language_requirement VARCHAR(500) NOT NULL DEFAULT '',
      it_requirement VARCHAR(500) NOT NULL DEFAULT '',
      decision_number VARCHAR(150) NOT NULL DEFAULT '',
      decision_date DATE NULL,
      description TEXT NULL,
      revision INT UNSIGNED NOT NULL DEFAULT 1,
      CONSTRAINT fk_program_ui_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runner.query(`CREATE TABLE program_review_minutes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      approval_request_id BIGINT UNSIGNED NOT NULL UNIQUE,
      council_name VARCHAR(255) NOT NULL,
      chair_name VARCHAR(255) NOT NULL,
      secretary_name VARCHAR(255) NOT NULL,
      meeting_date DATE NOT NULL,
      conclusion VARCHAR(30) NOT NULL,
      comments TEXT NULL,
      minutes_number VARCHAR(150) NOT NULL DEFAULT '',
      recorded_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      CONSTRAINT fk_program_minutes_request FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id),
      CONSTRAINT fk_program_minutes_actor FOREIGN KEY (recorded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runner.query(`CREATE TABLE program_review_documents (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      program_version_id BIGINT UNSIGNED NOT NULL,
      storage_key VARCHAR(80) NOT NULL UNIQUE,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      uploaded_by BIGINT UNSIGNED NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      CONSTRAINT fk_program_documents_version FOREIGN KEY (program_version_id) REFERENCES program_versions(id),
      CONSTRAINT fk_program_documents_actor FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE program_review_documents");
    await runner.query("DROP TABLE program_review_minutes");
    await runner.query("DROP TABLE program_ui_details");
  }
}
