import { MigrationInterface, QueryRunner } from "typeorm";
export class Grades1793350800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE student_course_results ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 0",
    );
    await q.query(`CREATE TABLE grade_policies(
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
   course_offering_id BIGINT UNSIGNED NOT NULL,
   attendance_weight DECIMAL(5,2) NOT NULL,
   midterm_weight DECIMAL(5,2) NOT NULL,
   exam_weight DECIMAL(5,2) NOT NULL,
   passing_score DECIMAL(4,2) NOT NULL,
   decimal_places TINYINT UNSIGNED NOT NULL,
   rounding VARCHAR(20) NOT NULL,
   reference VARCHAR(255) NOT NULL,
   revision INT UNSIGNED NOT NULL DEFAULT 0,
   updated_by BIGINT UNSIGNED NOT NULL,
   updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
   UNIQUE KEY uk_grade_policy_offering(course_offering_id),
   CONSTRAINT fk_grade_policy_offering FOREIGN KEY(course_offering_id) REFERENCES course_offerings(id),
   CONSTRAINT fk_grade_policy_actor FOREIGN KEY(updated_by) REFERENCES users(id),
   CONSTRAINT chk_grade_weights CHECK(attendance_weight>=0 AND midterm_weight>=0 AND exam_weight>=0 AND attendance_weight+midterm_weight+exam_weight=100),
   CONSTRAINT chk_grade_pass CHECK(passing_score>0 AND passing_score<=10),
   CONSTRAINT chk_grade_precision CHECK(decimal_places<=2 AND rounding IN ('HALF_UP','TRUNCATE'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE grade_details(
   result_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
   registration_id BIGINT UNSIGNED NOT NULL,
   policy_id BIGINT UNSIGNED NOT NULL,
   attendance_score DECIMAL(4,2) NULL,
   midterm_score DECIMAL(4,2) NULL,
   exam_score DECIMAL(4,2) NULL,
   total_score DECIMAL(4,2) NULL,
   state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
   finalized_at DATETIME(6) NULL,
   UNIQUE KEY uk_grade_registration(registration_id),
   CONSTRAINT fk_grade_detail_result FOREIGN KEY(result_id) REFERENCES student_course_results(id),
   CONSTRAINT fk_grade_detail_registration FOREIGN KEY(registration_id) REFERENCES course_registrations(id),
   CONSTRAINT fk_grade_detail_policy FOREIGN KEY(policy_id) REFERENCES grade_policies(id),
   CONSTRAINT chk_grade_scores CHECK(
    (attendance_score IS NULL OR attendance_score BETWEEN 0 AND 10) AND
    (midterm_score IS NULL OR midterm_score BETWEEN 0 AND 10) AND
    (exam_score IS NULL OR exam_score BETWEEN 0 AND 10) AND
    (total_score IS NULL OR total_score BETWEEN 0 AND 10)),
   CONSTRAINT chk_grade_state CHECK(state IN ('DRAFT','FINALIZED','VOIDED') AND
    ((state='FINALIZED' AND total_score IS NOT NULL AND finalized_at IS NOT NULL) OR
     (state<>'FINALIZED' AND finalized_at IS NULL)))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE grade_revisions(
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
   result_id BIGINT UNSIGNED NOT NULL,
   revision INT UNSIGNED NOT NULL,
   action VARCHAR(40) NOT NULL,
   actor_id BIGINT UNSIGNED NOT NULL,
   note VARCHAR(1000) NOT NULL,
   reference VARCHAR(255) NOT NULL,
   old_value JSON NULL,
   new_value JSON NOT NULL,
   created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   UNIQUE KEY uk_grade_revision(result_id,revision),
   CONSTRAINT fk_grade_history_result FOREIGN KEY(result_id) REFERENCES student_course_results(id),
   CONSTRAINT fk_grade_history_actor FOREIGN KEY(actor_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TRIGGER trg_grade_detail_bi BEFORE INSERT ON grade_details FOR EACH ROW
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM student_course_results r JOIN course_registrations cr ON cr.id=NEW.registration_id
     JOIN course_offerings co ON co.id=cr.course_offering_id JOIN grade_policies p ON p.id=NEW.policy_id
     WHERE r.id=NEW.result_id AND cr.student_id=r.student_id AND cr.course_offering_id=r.course_offering_id
      AND co.course_version_id=r.course_version_id AND p.course_offering_id=co.id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grade detail must match exact registration, offering, version and policy'; END IF;
   END`);
    await q.query(`CREATE TRIGGER trg_grade_detail_bu BEFORE UPDATE ON grade_details FOR EACH ROW
   BEGIN
    IF NOT(NEW.result_id<=>OLD.result_id) OR NOT(NEW.registration_id<=>OLD.registration_id) OR NOT(NEW.policy_id<=>OLD.policy_id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grade detail identity is immutable'; END IF;
   END`);
    await q.query(`CREATE TRIGGER trg_grade_policy_bu BEFORE UPDATE ON grade_policies FOR EACH ROW
   BEGIN
    IF NOT(OLD.course_offering_id<=>NEW.course_offering_id) OR EXISTS(SELECT 1 FROM grade_details d WHERE d.policy_id=OLD.id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grading policy is frozen once grade entries exist'; END IF;
   END`);
    await q.query(
      "CREATE TRIGGER trg_grade_detail_bd BEFORE DELETE ON grade_details FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grade detail history cannot be deleted'",
    );
    await q.query(
      "CREATE TRIGGER trg_grade_history_bu BEFORE UPDATE ON grade_revisions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grade revisions are immutable'",
    );
    await q.query(
      "CREATE TRIGGER trg_grade_history_bd BEFORE DELETE ON grade_revisions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Grade revisions cannot be deleted'",
    );
    await q.query(`INSERT IGNORE INTO permissions(permission_code,permission_name,module_code) VALUES
   ('GRADE_READ','View course results in scope','GRADES'),('GRADE_MANAGE','Record and correct course results','GRADES')`);
    await q.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON
   (r.role_code IN ('ADMIN','APPROVER','TRAINING_OFFICER') AND p.permission_code='GRADE_READ')
   OR (r.role_code='TRAINING_OFFICER' AND p.permission_code='GRADE_MANAGE')`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TRIGGER IF EXISTS trg_grade_policy_bu");
    await q.query("DROP TABLE grade_revisions");
    await q.query("DROP TABLE grade_details");
    await q.query("DROP TABLE grade_policies");
    await q.query("ALTER TABLE student_course_results DROP COLUMN revision");
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.module_code='GRADES'",
    );
    await q.query("DELETE FROM permissions WHERE module_code='GRADES'");
  }
}
