import { MigrationInterface, QueryRunner } from "typeorm";
export class DoctoralEducationLevel1793743200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Preserve BACHELOR identifiers and historical curricula. Unknown doctoral
    // credit/elective thresholds stay NULL until configured from an actual rule.
    await q.query(`INSERT INTO education_levels(level_code,level_name,status)
      SELECT 'DOCTOR','Tiến sĩ','ACTIVE' WHERE NOT EXISTS(
        SELECT 1 FROM education_levels WHERE level_code IN('DOCTOR','PHD'))`);
    await q.query(`INSERT INTO education_level_tracks(education_level_id,study_track_id,display_order)
      SELECT e.id,t.id,1 FROM education_levels e JOIN study_tracks t ON t.track_code='GENERAL' AND t.status='ACTIVE'
      WHERE e.level_code IN('DOCTOR','PHD') AND e.status='ACTIVE'
      AND NOT EXISTS(SELECT 1 FROM education_level_tracks x WHERE x.education_level_id=e.id)`);
  }
  async down(): Promise<void> {
    // Removing the level can break curricula created after deployment.
    throw new Error(
      "Giữ bậc Tiến sĩ và tham chiếu CTĐT; không tự xóa dữ liệu danh mục khi rollback.",
    );
  }
}
