import { MigrationInterface, QueryRunner } from "typeorm";
export class ThesisDefenses1793059201000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE thesis_defenses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT UNSIGNED NOT NULL,
      program_version_track_id BIGINT UNSIGNED NOT NULL,
      student_name_snapshot VARCHAR(255) NOT NULL,
      program_name_snapshot VARCHAR(255) NOT NULL,
      thesis_title VARCHAR(1000) NOT NULL,
      defense_date DATE NOT NULL,
      location VARCHAR(255) NOT NULL,
      council_chair VARCHAR(255) NOT NULL,
      reviewer VARCHAR(255) NULL,
      secretary VARCHAR(255) NULL,
      average_score DECIMAL(4,2) NULL,
      passing_score DECIMAL(4,2) NOT NULL DEFAULT 5.50,
      status VARCHAR(20) NOT NULL DEFAULT 'CHO_BAO_VE',
      pending_student_id BIGINT UNSIGNED GENERATED ALWAYS AS
        (CASE WHEN status = 'CHO_BAO_VE' THEN student_id END) STORED,
      created_by BIGINT UNSIGNED NOT NULL,
      graded_by BIGINT UNSIGNED NULL,
      graded_at DATETIME(6) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uk_thesis_defenses_pending (pending_student_id),
      KEY idx_thesis_defenses_date (defense_date, id),
      KEY idx_thesis_defenses_status (status, defense_date),
      CONSTRAINT fk_defenses_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_track FOREIGN KEY (program_version_track_id) REFERENCES program_version_tracks(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_grader FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT chk_defenses_result CHECK (
        (status = 'CHO_BAO_VE' AND average_score IS NULL AND graded_by IS NULL AND graded_at IS NULL)
        OR (status = 'DA_DAT' AND average_score IS NOT NULL AND average_score >= passing_score AND average_score <= 10 AND graded_by IS NOT NULL AND graded_at IS NOT NULL)
        OR (status = 'CHUA_DAT' AND average_score IS NOT NULL AND average_score >= 0 AND average_score < passing_score AND graded_by IS NOT NULL AND graded_at IS NOT NULL)
      ),
      CONSTRAINT chk_defenses_threshold CHECK (passing_score BETWEEN 0 AND 10)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TABLE thesis_defenses");
  }
}
