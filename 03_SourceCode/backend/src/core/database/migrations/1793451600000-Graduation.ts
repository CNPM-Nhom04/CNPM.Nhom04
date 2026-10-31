import { MigrationInterface, QueryRunner } from "typeorm";
export class Graduation1793451600000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE graduation_policies(
   program_version_track_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,revision INT UNSIGNED NOT NULL,
   require_gpa BOOLEAN NOT NULL,minimum_gpa DECIMAL(4,2) NULL,require_language BOOLEAN NOT NULL,
   language_rule VARCHAR(2000) NULL,require_defense BOOLEAN NOT NULL,other_requirements VARCHAR(2000) NULL,
   reference VARCHAR(255) NOT NULL,updated_by BIGINT UNSIGNED NOT NULL,updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_grad_policy_track FOREIGN KEY(program_version_track_id) REFERENCES program_version_tracks(id),
   CONSTRAINT fk_grad_policy_actor FOREIGN KEY(updated_by) REFERENCES users(id),
   CONSTRAINT chk_grad_policy_revision CHECK(revision>=1),
   CONSTRAINT chk_grad_policy_flags CHECK(require_gpa IN(0,1) AND require_language IN(0,1) AND require_defense IN(0,1)),
   CONSTRAINT chk_grad_policy_gpa CHECK((require_gpa=1 AND minimum_gpa IS NOT NULL AND minimum_gpa>0 AND minimum_gpa<=10) OR(require_gpa=0 AND minimum_gpa IS NULL)),
   CONSTRAINT chk_grad_policy_language CHECK(require_language=0 OR(language_rule IS NOT NULL AND CHAR_LENGTH(TRIM(language_rule))>0)),
   CONSTRAINT chk_grad_policy_reference CHECK(CHAR_LENGTH(TRIM(reference))>0)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE graduation_evidence(
   assignment_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,revision INT UNSIGNED NOT NULL,policy_revision INT UNSIGNED NOT NULL,
   gpa DECIMAL(4,2) NULL,gpa_reference VARCHAR(255) NULL,
   language_state VARCHAR(20) NOT NULL,language_reference VARCHAR(255) NULL,language_valid_until DATE NULL,language_no_expiry BOOLEAN NOT NULL,
   other_state VARCHAR(20) NOT NULL,other_reference VARCHAR(255) NULL,
   verified_by BIGINT UNSIGNED NOT NULL,verified_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_grad_evidence_assignment FOREIGN KEY(assignment_id) REFERENCES student_program_assignments(id),
   CONSTRAINT fk_grad_evidence_actor FOREIGN KEY(verified_by) REFERENCES users(id),
   CONSTRAINT chk_grad_evidence_revision CHECK(revision>=1 AND policy_revision>=1),
   CONSTRAINT chk_grad_evidence_gpa CHECK((gpa IS NULL AND gpa_reference IS NULL) OR(gpa IS NOT NULL AND gpa>=0 AND gpa<=10 AND gpa_reference IS NOT NULL AND CHAR_LENGTH(TRIM(gpa_reference))>0)),
   CONSTRAINT chk_grad_evidence_state CHECK(language_state IN('UNKNOWN','MET','NOT_MET') AND other_state IN('UNKNOWN','MET','NOT_MET')),
   CONSTRAINT chk_grad_evidence_expiry CHECK(language_no_expiry IN(0,1) AND(language_no_expiry=0 OR language_valid_until IS NULL)),
   CONSTRAINT chk_grad_evidence_language CHECK(language_state='UNKNOWN' OR(language_reference IS NOT NULL AND CHAR_LENGTH(TRIM(language_reference))>0)),
   CONSTRAINT chk_grad_evidence_met CHECK(language_state<>'MET' OR(language_no_expiry=1 OR language_valid_until IS NOT NULL)),
   CONSTRAINT chk_grad_evidence_other CHECK(other_state='UNKNOWN' OR(other_reference IS NOT NULL AND CHAR_LENGTH(TRIM(other_reference))>0))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE graduation_events(
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,assignment_id BIGINT UNSIGNED NULL,track_id BIGINT UNSIGNED NOT NULL,
   event_type VARCHAR(20) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,data JSON NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   KEY idx_grad_events_assignment(assignment_id,event_type,id),KEY idx_grad_events_track(track_id,id),
   CONSTRAINT fk_grad_event_assignment FOREIGN KEY(assignment_id) REFERENCES student_program_assignments(id),
   CONSTRAINT fk_grad_event_track FOREIGN KEY(track_id) REFERENCES program_version_tracks(id),
   CONSTRAINT fk_grad_event_actor FOREIGN KEY(actor_id) REFERENCES users(id),
   CONSTRAINT chk_grad_event_type CHECK(event_type IN('POLICY','EVIDENCE','CHECK')),
   CONSTRAINT chk_grad_event_identity CHECK((event_type='POLICY' AND assignment_id IS NULL) OR(event_type IN('EVIDENCE','CHECK') AND assignment_id IS NOT NULL))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    for (const action of ["UPDATE", "DELETE"])
      await q.query(
        `CREATE TRIGGER trg_grad_events_${action.toLowerCase()} BEFORE ${action} ON graduation_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: graduation history is append-only'`,
      );
    await q.query(`CREATE TRIGGER trg_grad_event_identity BEFORE INSERT ON graduation_events FOR EACH ROW
   BEGIN IF NEW.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM student_program_assignments a WHERE a.id=NEW.assignment_id AND a.program_version_track_id=NEW.track_id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_GRAD_ASSIGNMENT: track mismatch'; END IF; END`);
    await q.query(`INSERT IGNORE INTO permissions(permission_code,permission_name,module_code) VALUES
   ('GRADUATION_READ','Xem điều kiện tốt nghiệp','GRADUATION'),('GRADUATION_CHECK','Kiểm tra điều kiện tốt nghiệp','GRADUATION'),
   ('GRADUATION_EVIDENCE','Xác minh hồ sơ tốt nghiệp','GRADUATION'),('GRADUATION_POLICY','Cấu hình quy định xét tốt nghiệp','GRADUATION')`);
    await q.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON
   (r.role_code='ADMIN' AND p.permission_code='GRADUATION_READ')
   OR(r.role_code='TRAINING_OFFICER' AND p.permission_code IN('GRADUATION_READ','GRADUATION_CHECK','GRADUATION_EVIDENCE'))
   OR(r.role_code='APPROVER' AND p.permission_code IN('GRADUATION_READ','GRADUATION_CHECK','GRADUATION_POLICY'))`);
  }
  async down(q: QueryRunner): Promise<void> {
    for (const name of [
      "trg_grad_events_update",
      "trg_grad_events_delete",
      "trg_grad_event_identity",
    ])
      await q.query("DROP TRIGGER IF EXISTS " + name);
    for (const table of [
      "graduation_events",
      "graduation_evidence",
      "graduation_policies",
    ])
      await q.query("DROP TABLE " + table);
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN('GRADUATION_READ','GRADUATION_CHECK','GRADUATION_EVIDENCE','GRADUATION_POLICY')",
    );
    await q.query(
      "DELETE FROM permissions WHERE permission_code IN('GRADUATION_READ','GRADUATION_CHECK','GRADUATION_EVIDENCE','GRADUATION_POLICY')",
    );
  }
}
