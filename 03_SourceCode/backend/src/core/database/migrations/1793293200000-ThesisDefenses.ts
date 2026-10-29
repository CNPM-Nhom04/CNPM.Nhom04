import { MigrationInterface, QueryRunner } from "typeorm";
export class ThesisDefenses1793293200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE thesis_defense_levels (
      education_level_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      CONSTRAINT fk_defense_level FOREIGN KEY(education_level_id) REFERENCES education_levels(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runner.query(`INSERT INTO thesis_defense_levels(education_level_id)
      SELECT id FROM education_levels WHERE level_code IN ('MASTER','PHD','DOCTOR','DOCTORATE')`);
    await runner.query(`CREATE TABLE thesis_defenses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      student_id BIGINT UNSIGNED NOT NULL,
      assignment_id BIGINT UNSIGNED NOT NULL,
      program_version_track_id BIGINT UNSIGNED NOT NULL,
      student_name_snapshot VARCHAR(255) NOT NULL,
      program_name_snapshot VARCHAR(255) NOT NULL,
      thesis_title VARCHAR(1000) NOT NULL,
      defense_date DATE NOT NULL,
      location VARCHAR(255) NOT NULL,
      council_chair VARCHAR(255) NOT NULL,
      reviewer VARCHAR(255) NOT NULL,
      secretary VARCHAR(255) NOT NULL,
      eligibility_note VARCHAR(1000) NOT NULL,
      average_score DECIMAL(4,2) NULL,
      passing_score DECIMAL(4,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'CHO_BAO_VE',
      pending_student_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='CHO_BAO_VE' THEN student_id END) STORED,
      passed_assignment_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status='DA_DAT' THEN assignment_id END) STORED,
      created_by BIGINT UNSIGNED NOT NULL,
      graded_by BIGINT UNSIGNED NULL,
      graded_at DATETIME(6) NULL,
      cancelled_by BIGINT UNSIGNED NULL,
      cancelled_at DATETIME(6) NULL,
      cancellation_reason VARCHAR(1000) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uk_defenses_pending(pending_student_id),
      UNIQUE KEY uk_defenses_passed_assignment(passed_assignment_id),
      KEY idx_defenses_date(defense_date,id),
      KEY idx_defenses_status(status,defense_date),
      CONSTRAINT fk_defenses_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_assignment FOREIGN KEY(assignment_id) REFERENCES student_program_assignments(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_track FOREIGN KEY(program_version_track_id) REFERENCES program_version_tracks(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_creator FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_grader FOREIGN KEY(graded_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_defenses_canceller FOREIGN KEY(cancelled_by) REFERENCES users(id) ON DELETE RESTRICT,
      CONSTRAINT chk_defenses_threshold CHECK(passing_score>0 AND passing_score<=10),
      CONSTRAINT chk_defenses_eligibility CHECK(CHAR_LENGTH(TRIM(eligibility_note))>=10),
      CONSTRAINT chk_defenses_result CHECK(
        (status='CHO_BAO_VE' AND average_score IS NULL AND graded_by IS NULL AND graded_at IS NULL AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
        OR (status='DA_DAT' AND average_score IS NOT NULL AND average_score>=passing_score AND average_score<=10 AND graded_by IS NOT NULL AND graded_at IS NOT NULL AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
        OR (status='CHUA_DAT' AND average_score IS NOT NULL AND average_score>=0 AND average_score<passing_score AND graded_by IS NOT NULL AND graded_at IS NOT NULL AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
        OR (status='DA_HUY' AND average_score IS NULL AND graded_by IS NULL AND graded_at IS NULL AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason))>=10)
      )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await runner.query(`CREATE TRIGGER trg_defenses_bi BEFORE INSERT ON thesis_defenses FOR EACH ROW
    BEGIN
      IF NOT EXISTS(SELECT 1 FROM student_program_assignments a WHERE a.id=NEW.assignment_id
        AND a.student_id=NEW.student_id AND a.program_version_track_id=NEW.program_version_track_id)
      THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Defense must match its exact student program assignment'; END IF;
    END`);
    await runner.query(`CREATE TRIGGER trg_defenses_bu BEFORE UPDATE ON thesis_defenses FOR EACH ROW
    BEGIN
      IF OLD.status<>'CHO_BAO_VE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final defense records are immutable'; END IF;
      IF NOT(NEW.student_id<=>OLD.student_id) OR NOT(NEW.assignment_id<=>OLD.assignment_id)
        OR NOT(NEW.program_version_track_id<=>OLD.program_version_track_id)
        OR NOT(NEW.student_name_snapshot<=>OLD.student_name_snapshot) OR NOT(NEW.program_name_snapshot<=>OLD.program_name_snapshot)
        OR NOT(NEW.thesis_title<=>OLD.thesis_title) OR NOT(NEW.defense_date<=>OLD.defense_date)
        OR NOT(NEW.location<=>OLD.location) OR NOT(NEW.council_chair<=>OLD.council_chair)
        OR NOT(NEW.reviewer<=>OLD.reviewer) OR NOT(NEW.secretary<=>OLD.secretary)
        OR NOT(NEW.passing_score<=>OLD.passing_score) OR NOT(NEW.eligibility_note<=>OLD.eligibility_note)
        OR NOT(NEW.created_by<=>OLD.created_by) OR NOT(NEW.created_at<=>OLD.created_at)
      THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancel and replace a schedule instead of rewriting it'; END IF;
    END`);
    await runner.query(`CREATE TRIGGER trg_defenses_bd BEFORE DELETE ON thesis_defenses FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Defense history cannot be deleted'`);
    await runner.query(`INSERT IGNORE INTO permissions(permission_code,permission_name,module_code) VALUES
      ('DEFENSE_READ','View thesis defenses','THESIS_DEFENSE'),
      ('DEFENSE_SCHEDULE','Schedule or cancel thesis defenses','THESIS_DEFENSE'),
      ('DEFENSE_RESULT','Record a final council result','THESIS_DEFENSE')`);
    await runner.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM roles r JOIN permissions p ON
      (r.role_code='ADMIN' AND p.permission_code='DEFENSE_READ')
      OR (r.role_code='TRAINING_OFFICER' AND p.permission_code IN ('DEFENSE_READ','DEFENSE_SCHEDULE','DEFENSE_RESULT'))
      OR (r.role_code='APPROVER' AND p.permission_code IN ('DEFENSE_READ','DEFENSE_RESULT'))`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query("DROP TRIGGER IF EXISTS trg_defenses_bi");
    await runner.query("DROP TRIGGER IF EXISTS trg_defenses_bu");
    await runner.query("DROP TRIGGER IF EXISTS trg_defenses_bd");
    await runner.query("DROP TABLE thesis_defenses");
    await runner.query("DROP TABLE thesis_defense_levels");
    await runner.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('DEFENSE_READ','DEFENSE_SCHEDULE','DEFENSE_RESULT')",
    );
    await runner.query(
      "DELETE FROM permissions WHERE permission_code IN ('DEFENSE_READ','DEFENSE_SCHEDULE','DEFENSE_RESULT')",
    );
  }
}
