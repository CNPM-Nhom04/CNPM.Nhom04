import { MigrationInterface, QueryRunner } from "typeorm";
export class LecturerGradeRead1794000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='GRADE_READ' WHERE r.role_code='LECTURER'`);
    await q.query(
      `DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code='LECTURER' AND p.permission_code='GRADE_MANAGE'`,
    );
  }
  async down(): Promise<void> {
    /* Preserve explicit read access and never re-grant point edits. */
  }
}
