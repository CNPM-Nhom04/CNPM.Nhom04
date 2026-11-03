import { MigrationInterface, QueryRunner } from "typeorm";
export class StudentClasses1793700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE student_classes(
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,class_code VARCHAR(50) NOT NULL UNIQUE,
   class_name VARCHAR(255) NOT NULL,program_version_track_id BIGINT UNSIGNED NOT NULL,
   admission_year SMALLINT UNSIGNED NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',revision INT UNSIGNED NOT NULL DEFAULT 1,
   created_by BIGINT UNSIGNED NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_student_class_track FOREIGN KEY(program_version_track_id) REFERENCES program_version_tracks(id),
   CONSTRAINT fk_student_class_creator FOREIGN KEY(created_by) REFERENCES users(id),
   CONSTRAINT chk_student_class_year CHECK(admission_year BETWEEN 1900 AND 2200),
   CONSTRAINT chk_student_class_status CHECK(status IN('ACTIVE','INACTIVE')),
   CONSTRAINT chk_student_class_revision CHECK(revision>=1)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE student_class_memberships(
   student_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,class_id BIGINT UNSIGNED NOT NULL,
   created_by BIGINT UNSIGNED NOT NULL,joined_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   KEY idx_student_class_members_class(class_id,student_id),
   CONSTRAINT fk_student_class_member_student FOREIGN KEY(student_id) REFERENCES students(id),
   CONSTRAINT fk_student_class_member_class FOREIGN KEY(class_id) REFERENCES student_classes(id),
   CONSTRAINT fk_student_class_member_creator FOREIGN KEY(created_by) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`INSERT INTO permissions(permission_code,permission_name,module_code,description)
    VALUES('STUDENT_ACCOUNT_IMPORT','Nhập tài khoản học viên theo lớp','STUDENTS','Tạo tài khoản STUDENT, liên kết hồ sơ và phân công CTĐT từ Excel; không xét tuyển')`);
    await q.query(
      `INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='STUDENT_ACCOUNT_IMPORT' WHERE r.role_code='ADMIN'`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code='STUDENT_ACCOUNT_IMPORT'",
    );
    await q.query(
      "DELETE FROM permissions WHERE permission_code='STUDENT_ACCOUNT_IMPORT'",
    );
    await q.query("DROP TABLE student_class_memberships");
    await q.query("DROP TABLE student_classes");
  }
}
