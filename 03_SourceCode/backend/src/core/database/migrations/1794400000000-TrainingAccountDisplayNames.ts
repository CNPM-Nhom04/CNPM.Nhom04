import { MigrationInterface, QueryRunner } from "typeorm";

/** The two training accounts now serve AGU at school level. */
export class TrainingAccountDisplayNames1794400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "UPDATE users SET full_name=? WHERE username=? AND full_name=? AND deleted_at IS NULL",
      ["Cán bộ đào tạo", "officer.fit", "Cán bộ đào tạo Khoa CNTT"],
    );
    await q.query(
      "UPDATE users SET full_name=? WHERE username=? AND full_name=? AND deleted_at IS NULL",
      ["Lãnh đạo", "approver.fit", "Lãnh đạo Khoa CNTT"],
    );
  }

  async down(): Promise<void> {
    throw new Error("Không tự đổi tên tài khoản cấp trường về tên khoa cũ.");
  }
}
