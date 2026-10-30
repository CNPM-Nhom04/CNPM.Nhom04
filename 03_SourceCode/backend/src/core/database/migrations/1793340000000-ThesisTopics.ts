import { MigrationInterface, QueryRunner } from "typeorm";
export class ThesisTopics1793340000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE thesis_supervisors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owning_unit_id BIGINT UNSIGNED NOT NULL,
    supervisor_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NULL,
    qualification VARCHAR(255) NULL,
    email VARCHAR(254) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_supervisor_unit_code(owning_unit_id,supervisor_code),
    CONSTRAINT fk_supervisor_unit FOREIGN KEY(owning_unit_id) REFERENCES organizational_units(id),
    CONSTRAINT fk_supervisor_creator FOREIGN KEY(created_by) REFERENCES users(id),
    CONSTRAINT chk_supervisor_status CHECK(status IN ('ACTIVE','INACTIVE'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE thesis_topics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    assignment_id BIGINT UNSIGNED NOT NULL,
    supervisor_id BIGINT UNSIGNED NOT NULL,
    student_name_snapshot VARCHAR(255) NOT NULL,
    program_name_snapshot VARCHAR(255) NOT NULL,
    supervisor_name_snapshot VARCHAR(255) NOT NULL,
    title VARCHAR(1000) NOT NULL,
    description TEXT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'CHO_DUYET',
    revision INT UNSIGNED NOT NULL DEFAULT 0,
    current_assignment BIGINT UNSIGNED GENERATED ALWAYS AS(CASE WHEN status<>'DA_HUY' THEN assignment_id END) STORED,
    created_by BIGINT UNSIGNED NOT NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(6) NULL,
    review_note VARCHAR(1000) NULL,
    decision_reference VARCHAR(255) NULL,
    completed_by BIGINT UNSIGNED NULL,
    completed_at DATETIME(6) NULL,
    completion_reference VARCHAR(255) NULL,
    completion_note VARCHAR(1000) NULL,
    cancelled_by BIGINT UNSIGNED NULL,
    cancelled_at DATETIME(6) NULL,
    cancellation_reason VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_topic_current_assignment(current_assignment),
    KEY idx_topics_status(status,id),
    CONSTRAINT fk_topic_assignment FOREIGN KEY(assignment_id) REFERENCES student_program_assignments(id),
    CONSTRAINT fk_topic_supervisor FOREIGN KEY(supervisor_id) REFERENCES thesis_supervisors(id),
    CONSTRAINT fk_topic_creator FOREIGN KEY(created_by) REFERENCES users(id),
    CONSTRAINT fk_topic_reviewer FOREIGN KEY(reviewed_by) REFERENCES users(id),
    CONSTRAINT fk_topic_completer FOREIGN KEY(completed_by) REFERENCES users(id),
    CONSTRAINT fk_topic_canceller FOREIGN KEY(cancelled_by) REFERENCES users(id),
    CONSTRAINT chk_topic_status CHECK(status IN ('CHO_DUYET','DANG_THUC_HIEN','TU_CHOI','HOAN_THANH','DA_HUY')),
    CONSTRAINT chk_topic_review CHECK(status NOT IN ('DANG_THUC_HIEN','HOAN_THANH','TU_CHOI') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by<>created_by AND CHAR_LENGTH(TRIM(review_note))>=10)),
    CONSTRAINT chk_topic_completion CHECK(status<>'HOAN_THANH' OR (completed_by IS NOT NULL AND completed_at IS NOT NULL AND CHAR_LENGTH(TRIM(completion_reference))>0 AND CHAR_LENGTH(TRIM(completion_note))>=10)),
    CONSTRAINT chk_topic_cancel CHECK(status<>'DA_HUY' OR (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL AND CHAR_LENGTH(TRIM(cancellation_reason))>=10))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TRIGGER trg_topic_bi BEFORE INSERT ON thesis_topics FOR EACH ROW
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM student_program_assignments a JOIN program_version_tracks t ON t.id=a.program_version_track_id
     JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id
     JOIN thesis_supervisors s ON s.id=NEW.supervisor_id AND s.owning_unit_id=p.managing_unit_id WHERE a.id=NEW.assignment_id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Topic supervisor must belong to the program managing unit'; END IF;
   END`);
    await q.query(`CREATE TRIGGER trg_topic_bu BEFORE UPDATE ON thesis_topics FOR EACH ROW
   BEGIN
    IF OLD.status IN ('HOAN_THANH','DA_HUY') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final topic history is immutable'; END IF;
    IF NOT(OLD.assignment_id<=>NEW.assignment_id) OR NOT(OLD.created_by<=>NEW.created_by) OR NOT(OLD.created_at<=>NEW.created_at)
      OR NOT(OLD.student_name_snapshot<=>NEW.student_name_snapshot) OR NOT(OLD.program_name_snapshot<=>NEW.program_name_snapshot)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Topic student assignment is immutable'; END IF;
    IF OLD.status='DANG_THUC_HIEN' AND (NOT(OLD.title<=>NEW.title) OR NOT(OLD.supervisor_id<=>NEW.supervisor_id) OR NOT(OLD.supervisor_name_snapshot<=>NEW.supervisor_name_snapshot) OR NOT(OLD.description<=>NEW.description))
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Approved topic content is immutable'; END IF;
    IF NOT EXISTS(SELECT 1 FROM student_program_assignments a JOIN program_version_tracks t ON t.id=a.program_version_track_id
     JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id
     JOIN thesis_supervisors s ON s.id=NEW.supervisor_id AND s.owning_unit_id=p.managing_unit_id WHERE a.id=NEW.assignment_id)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Topic supervisor must belong to the program managing unit'; END IF;
   END`);
    await q.query(
      "CREATE TRIGGER trg_topic_bd BEFORE DELETE ON thesis_topics FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Topic history cannot be deleted'",
    );
    // Nullable for historical defenses. New schedules are linked by the application.
    await q.query(
      "ALTER TABLE thesis_defenses ADD COLUMN topic_id BIGINT UNSIGNED NULL, ADD KEY idx_defense_topic(topic_id), ADD CONSTRAINT fk_defense_topic FOREIGN KEY(topic_id) REFERENCES thesis_topics(id)",
    );
    await q.query(`CREATE TRIGGER trg_defense_topic_bi BEFORE INSERT ON thesis_defenses FOR EACH ROW
   BEGIN
    IF NEW.topic_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM thesis_topics t WHERE t.id=NEW.topic_id AND t.assignment_id=NEW.assignment_id AND t.status='DANG_THUC_HIEN' AND t.title=NEW.thesis_title)
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Defense must match its approved topic'; END IF;
   END`);
    await q.query(`CREATE TRIGGER trg_defense_topic_bu BEFORE UPDATE ON thesis_defenses FOR EACH ROW
   BEGIN
    IF NOT(OLD.topic_id<=>NEW.topic_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Defense topic link is immutable'; END IF;
   END`);
    await q.query(`INSERT IGNORE INTO permissions(permission_code,permission_name,module_code) VALUES
   ('TOPIC_READ','View thesis topics and supervisor profiles','THESIS_TOPIC'),
   ('TOPIC_MANAGE','Register topics and manage supervisors','THESIS_TOPIC'),
   ('TOPIC_APPROVE','Approve or reject thesis topics','THESIS_TOPIC'),
   ('TOPIC_COMPLETE','Confirm thesis topic completion','THESIS_TOPIC')`);
    await q.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id)
   SELECT r.id,p.id FROM roles r JOIN permissions p ON
   (r.role_code='ADMIN' AND p.permission_code='TOPIC_READ')
   OR (r.role_code='TRAINING_OFFICER' AND p.permission_code IN ('TOPIC_READ','TOPIC_MANAGE'))
   OR (r.role_code='APPROVER' AND p.permission_code IN ('TOPIC_READ','TOPIC_APPROVE','TOPIC_COMPLETE'))`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TRIGGER IF EXISTS trg_defense_topic_bi");
    await q.query("DROP TRIGGER IF EXISTS trg_defense_topic_bu");
    await q.query(
      "ALTER TABLE thesis_defenses DROP FOREIGN KEY fk_defense_topic, DROP COLUMN topic_id",
    );
    await q.query("DROP TABLE thesis_topics");
    await q.query("DROP TABLE thesis_supervisors");
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.module_code='THESIS_TOPIC'",
    );
    await q.query("DELETE FROM permissions WHERE module_code='THESIS_TOPIC'");
  }
}
