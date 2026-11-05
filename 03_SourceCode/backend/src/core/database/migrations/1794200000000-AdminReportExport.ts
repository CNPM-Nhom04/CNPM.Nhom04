import { MigrationInterface, QueryRunner } from "typeorm";
/** Administrators can download the same report they can already read. */
export class AdminReportExport1794200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='PROGRAM_EXPORT'
      WHERE r.role_code='ADMIN' AND r.status='ACTIVE'`);
  }
  async down(): Promise<void> {
    throw new Error(
      "Không tự thu hồi quyền Admin đã có; điều chỉnh quyền theo chính sách hiện tại khi rollback.",
    );
  }
}
