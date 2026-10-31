import { MigrationInterface, QueryRunner } from "typeorm";
export class Approvals1793448000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      "ALTER TABLE approval_requests ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 0",
    );
    await runner.query(`ALTER TABLE program_review_documents ADD COLUMN approval_request_id BIGINT UNSIGNED NULL,
   ADD KEY idx_review_documents_request(approval_request_id),
   ADD CONSTRAINT fk_review_documents_request FOREIGN KEY(approval_request_id) REFERENCES approval_requests(id) ON DELETE RESTRICT`);
    // No backfill: old version-level documents do not establish a specific review cycle.
    await runner.query(`CREATE TRIGGER trg_review_documents_request_bi BEFORE INSERT ON program_review_documents FOR EACH ROW
   BEGIN IF NEW.approval_request_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM approval_requests r WHERE r.id=NEW.approval_request_id AND r.program_version_id=NEW.program_version_id AND r.current_status='PENDING')
    THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_REVIEW_DOCUMENT_REQUEST: pending request/version mismatch'; END IF; END`);
    for (const [table, prefix] of [
      ["program_review_documents", "review_documents"],
      ["program_review_minutes", "review_minutes"],
    ]) {
      await runner.query(`CREATE TRIGGER trg_${prefix}_bu BEFORE UPDATE ON ${table} FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: review evidence is append-only'`);
      await runner.query(`CREATE TRIGGER trg_${prefix}_bd BEFORE DELETE ON ${table} FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: review evidence is append-only'`);
    }
    await runner.query(`CREATE TRIGGER trg_approval_request_history_bu BEFORE UPDATE ON approval_requests FOR EACH ROW
   BEGIN
    IF NOT(NEW.program_version_id <=> OLD.program_version_id) OR NOT(NEW.request_no <=> OLD.request_no)
     OR NOT(NEW.requested_by <=> OLD.requested_by) OR NOT(NEW.requested_at <=> OLD.requested_at)
     THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: request identity is immutable'; END IF;
    IF OLD.current_status <> 'PENDING' AND (
     NOT(NEW.current_status <=> OLD.current_status) OR NOT(NEW.completed_at <=> OLD.completed_at)
     OR NOT(NEW.review_started_at <=> OLD.review_started_at) OR NOT(NEW.reviewing_by <=> OLD.reviewing_by)
     OR NOT(NEW.latest_comment <=> OLD.latest_comment) OR NOT(NEW.revision <=> OLD.revision))
     THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: completed request is immutable'; END IF;
   END`);
    await runner.query(`CREATE TRIGGER trg_approval_request_history_bd BEFORE DELETE ON approval_requests FOR EACH ROW
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='E_ROW_IMMUTABLE: approval requests retain business history'`);
  }
  async down(runner: QueryRunner): Promise<void> {
    for (const trigger of [
      "trg_approval_request_history_bd",
      "trg_approval_request_history_bu",
      "trg_review_documents_request_bi",
      "trg_review_documents_bu",
      "trg_review_documents_bd",
      "trg_review_minutes_bu",
      "trg_review_minutes_bd",
    ])
      await runner.query("DROP TRIGGER IF EXISTS " + trigger);
    await runner.query(
      "ALTER TABLE program_review_documents DROP FOREIGN KEY fk_review_documents_request, DROP INDEX idx_review_documents_request, DROP COLUMN approval_request_id",
    );
    await runner.query("ALTER TABLE approval_requests DROP COLUMN revision");
  }
}
