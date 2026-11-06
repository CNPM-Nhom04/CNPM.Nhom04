import { MigrationInterface, QueryRunner } from "typeorm";

/** Remove only the registration settings explicitly retired from the product. */
export class TrainingSettingsScope1794300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "DELETE FROM system_settings WHERE setting_key IN ('training.maxTinChiHocKy','training.thoiHanDangKyToiDa')",
    );
  }
  async down(): Promise<void> {
    throw new Error(
      "Không tự bật lại đăng ký học phần đã bỏ khỏi phạm vi hệ thống.",
    );
  }
}
