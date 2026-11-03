import { MigrationInterface, QueryRunner } from "typeorm";
export class PublicPortal1793653200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE public_documents (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
   title VARCHAR(255) NOT NULL, category VARCHAR(20) NOT NULL,
   summary VARCHAR(2000) NOT NULL, document_url VARCHAR(2000) NOT NULL,
   reference_number VARCHAR(150) NULL, issued_on DATE NULL,
   status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',revision INT UNSIGNED NOT NULL DEFAULT 1,
   updated_by BIGINT UNSIGNED NOT NULL,
   created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_public_document_actor FOREIGN KEY(updated_by) REFERENCES users(id),
   CONSTRAINT chk_public_document_category CHECK(category IN('REGULATION','ADMISSION','GUIDE')),
   CONSTRAINT chk_public_document_status CHECK(status IN('DRAFT','PUBLISHED')),
   CONSTRAINT chk_public_document_revision CHECK(revision>=1),
   KEY idx_public_document_list(status,category,issued_on,id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await q.query(`CREATE TABLE admission_subscriptions (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
   fingerprint CHAR(64) NOT NULL UNIQUE,
   family_name VARCHAR(150) NOT NULL,given_name VARCHAR(100) NOT NULL,
   email VARCHAR(255) NOT NULL,phone VARCHAR(30) NOT NULL,gender VARCHAR(20) NULL,
   education_level_id BIGINT UNSIGNED NULL,level_name_snapshot VARCHAR(150) NOT NULL,
   major_id BIGINT UNSIGNED NULL,major_name_snapshot VARCHAR(255) NULL,
   previous_major VARCHAR(255) NULL,graduation_year SMALLINT UNSIGNED NULL,
   message VARCHAR(2000) NULL,consented_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   status VARCHAR(20) NOT NULL DEFAULT 'NEW',revision INT UNSIGNED NOT NULL DEFAULT 1,
   created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
   updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
   CONSTRAINT fk_admission_level FOREIGN KEY(education_level_id) REFERENCES education_levels(id) ON DELETE SET NULL,
   CONSTRAINT fk_admission_major FOREIGN KEY(major_id) REFERENCES majors(id) ON DELETE SET NULL,
   CONSTRAINT chk_admission_gender CHECK(gender IS NULL OR gender IN('MALE','FEMALE','OTHER')),
   CONSTRAINT chk_admission_status CHECK(status IN('NEW','CONTACTED')),
   KEY idx_admission_status(status,created_at,id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("DROP TABLE admission_subscriptions");
    await q.query("DROP TABLE public_documents");
  }
}
