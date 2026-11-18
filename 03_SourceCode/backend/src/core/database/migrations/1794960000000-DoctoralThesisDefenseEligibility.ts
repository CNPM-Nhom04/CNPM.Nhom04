import { MigrationInterface, QueryRunner } from "typeorm";

export class DoctoralThesisDefenseEligibility1794960000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // Doctoral levels may be added after the original defense migration.
    // This enables topic/defense workflows, not individual student eligibility.
    await runner.query(`INSERT INTO thesis_defense_levels(education_level_id)
      SELECT e.id FROM education_levels e
      WHERE e.level_code IN ('PHD','DOCTOR','DOCTORATE') AND e.status='ACTIVE'
      AND NOT EXISTS(SELECT 1 FROM thesis_defense_levels l WHERE l.education_level_id=e.id)`);
  }

  async down(): Promise<void> {
    throw new Error(
      "Giữ cấu hình bậc tiến sĩ để không làm mất truy cập hồ sơ đề tài và bảo vệ đã tạo.",
    );
  }
}
