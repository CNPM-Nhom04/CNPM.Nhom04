import { MigrationInterface, QueryRunner } from "typeorm";

/** Explicit one-time removal of the BIT/BBA demonstration data, not a business delete API. */
export class RemoveBachelorDemo1793746800000 implements MigrationInterface {
  transaction = false;
  private async targets(q: QueryRunner) {
    const levels = await q.query(
      "SELECT CAST(id AS CHAR) id FROM education_levels WHERE level_code='BACHELOR' FOR UPDATE",
    );
    if (!levels.length) return null;
    const level = levels[0].id;
    const programs = await q.query(
      "SELECT CAST(id AS CHAR) id,program_code code FROM training_programs WHERE education_level_id=? FOR UPDATE",
      [level],
    );
    if (programs.some((p) => !["BIT", "BBA"].includes(p.code)))
      throw new Error(
        "Bậc Đại học có CTĐT khác BIT/BBA; dừng để không xóa dữ liệu chưa được xác nhận.",
      );
    const versions = await q.query(
      "SELECT CAST(v.id AS CHAR) id,v.status FROM program_versions v JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=? FOR UPDATE",
      [level],
    );
    if (versions.some((v) => !["DRAFT", "RETURNED"].includes(v.status)))
      throw new Error(
        "CTĐT Đại học có phiên bản ngoài trạng thái nháp/trả về; không xóa lịch sử đã ban hành.",
      );
    const checks = [
      `SELECT COUNT(*) n FROM student_program_assignments a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM student_classes a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM approval_requests a JOIN program_versions v ON v.id=a.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM program_review_documents a JOIN program_versions v ON v.id=a.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM registration_period_scopes a LEFT JOIN program_versions v ON v.id=a.program_version_id LEFT JOIN training_programs p ON p.id=v.program_id WHERE a.education_level_id=? OR p.education_level_id=?`,
      `SELECT COUNT(*) n FROM user_scopes a JOIN training_programs p ON p.id=a.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM program_versions a JOIN program_versions v ON v.id=a.source_program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM graduation_events a JOIN program_version_tracks t ON t.id=a.track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM graduation_policies a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
      `SELECT COUNT(*) n FROM thesis_defenses a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?`,
    ];
    for (const sql of checks) {
      const [row] = await q.query(
        sql,
        sql.includes("OR p.education_level_id") ? [level, level] : [level],
      );
      if (Number(row.n))
        throw new Error(
          "Dữ liệu Đại học có học viên, hồ sơ, phân quyền hoặc lịch sử nghiệp vụ phụ thuộc; dừng xóa mẫu.",
        );
    }
    return { level, programs, versions };
  }
  async up(q: QueryRunner): Promise<void> {
    // Preflight before DDL. MariaDB commits DDL implicitly, so begin the data
    // transaction only after temporarily dropping this single delete trigger.
    const target = await this.targets(q);
    if (!target) return;
    const [trigger] = await q.query(
      "SELECT ACTION_STATEMENT statement,ACTION_TIMING timing FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='trg_program_versions_bd' AND EVENT_OBJECT_TABLE='program_versions' AND EVENT_MANIPULATION='DELETE'",
    );
    if (!trigger || trigger.timing !== "BEFORE")
      throw new Error(
        "Không tìm thấy trigger bảo vệ phiên bản đúng cấu trúc; dừng bảo trì.",
      );
    await q.query("DROP TRIGGER trg_program_versions_bd");
    try {
      await q.startTransaction();
      const locked = await this.targets(q);
      if (!locked) throw new Error("Dữ liệu đã thay đổi trong lúc bảo trì.");
      const [before] = await q.query(
        "SELECT COUNT(*) n FROM curriculum_courses cc JOIN program_version_tracks t ON t.id=cc.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE p.education_level_id=?",
        [locked.level],
      );
      // Children first; no disabling of FK checks or unrelated history triggers.
      for (const version of locked.versions) {
        const id = version.id;
        await q.query(
          `DELETE cp FROM curriculum_prerequisites cp JOIN curriculum_courses cc ON cc.id=cp.curriculum_course_id JOIN program_version_tracks t ON t.id=cc.program_version_track_id WHERE t.program_version_id=?`,
          [id],
        );
        await q.query(
          `DELETE m FROM curriculum_course_plos m JOIN curriculum_courses cc ON cc.id=m.curriculum_course_id JOIN program_version_tracks t ON t.id=cc.program_version_track_id WHERE t.program_version_id=?`,
          [id],
        );
        await q.query(
          `DELETE cc FROM curriculum_courses cc JOIN program_version_tracks t ON t.id=cc.program_version_track_id WHERE t.program_version_id=?`,
          [id],
        );
        // Remove nested knowledge groups from leaves to roots.
        while (true) {
          const groups = await q.query(
            `SELECT CAST(g.id AS CHAR) id FROM curriculum_groups g JOIN program_version_tracks t ON t.id=g.program_version_track_id WHERE t.program_version_id=? AND NOT EXISTS(SELECT 1 FROM curriculum_groups child WHERE child.parent_group_id=g.id)`,
            [id],
          );
          if (!groups.length) break;
          for (const group of groups)
            await q.query("DELETE FROM curriculum_groups WHERE id=?", [
              group.id,
            ]);
        }
        await q.query(
          "DELETE FROM program_learning_outcomes WHERE program_version_id=?",
          [id],
        );
        await q.query(
          "DELETE FROM program_ui_details WHERE program_version_id=?",
          [id],
        );
        await q.query(
          "DELETE FROM program_version_tracks WHERE program_version_id=?",
          [id],
        );
        await q.query("DELETE FROM program_versions WHERE id=?", [id]);
      }
      for (const program of locked.programs)
        await q.query("DELETE FROM training_programs WHERE id=?", [program.id]);
      await q.query(
        "DELETE FROM education_level_tracks WHERE education_level_id=?",
        [locked.level],
      );
      await q.query(
        "DELETE FROM thesis_defense_levels WHERE education_level_id=?",
        [locked.level],
      );
      // FK ON DELETE SET NULL preserves the entire contact, snapshot and consent.
      await q.query("DELETE FROM education_levels WHERE id=?", [locked.level]);
      await q.query(
        "INSERT INTO audit_logs(actor_username,action,entity_type,entity_id,new_value,reason) VALUES('system-migration','REMOVE_BACHELOR_DEMO','education_level',?,?,?)",
        [
          locked.level,
          JSON.stringify({
            programCodes: locked.programs.map((p) => p.code),
            versionIds: locked.versions.map((v) => v.id),
            curriculumCourseCount: Number(before.n),
            preservedCourses: true,
            preservedContacts: true,
          }),
          "Xóa bậc Đại học và CTĐT mẫu BIT/BBA theo xác nhận; giữ học phần gốc và liên hệ tuyển sinh.",
        ],
      );
      await q.commitTransaction();
    } catch (error) {
      if (q.isTransactionActive) await q.rollbackTransaction();
      throw error;
    } finally {
      await q.query(
        "CREATE TRIGGER trg_program_versions_bd BEFORE DELETE ON program_versions FOR EACH ROW " +
          trigger.statement,
      );
    }
  }
  async down(): Promise<void> {
    throw new Error(
      "Không tự tạo lại dữ liệu mẫu đã xóa; khôi phục từ bản sao lưu riêng nếu cần.",
    );
  }
}
