/* Read-only parity; never creates graduation evidence, policy, users or check events. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm"),
  {
    MysqlGraduationRepository,
  } = require("../dist/modules/graduation/infrastructure/graduation.repository");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
let checks = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function run() {
  await db.initialize();
  const repo = new MysqlGraduationRepository(db);
  const users = await db.query(
    "SELECT CAST(id AS CHAR) id,username FROM users WHERE account_status='ACTIVE' AND deleted_at IS NULL",
  );
  for (const u of users) {
    const rows = await db.query(
      "SELECT DISTINCT p.permission_code code FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE' JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?",
      [u.id],
    );
    const permissions = rows.map((r) => r.code);
    if (!permissions.includes("GRADUATION_READ")) continue;
    const actor = { ...u, permissions, ip: "" };
    const result = await repo.list(
      { page: 1, limit: 100, assignmentStatus: "ALL", status: "ALL" },
      actor,
    );
    const expected = await db.query(
      "SELECT CAST(a.id AS CHAR) id FROM student_program_assignments a JOIN students s ON s.id=a.student_id JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id WHERE EXISTS(SELECT 1 FROM vw_user_program_access pa WHERE pa.user_id=? AND pa.program_id=v.program_id) AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id) ORDER BY a.id",
      [u.id, u.id],
    );
    same(
      result.data.map((r) => r.assignmentId),
      expected.map((r) => r.id),
      u.username + " exact assignment scope",
    );
    for (const row of result.data) {
      const detail = await repo.detail(row.assignmentId, actor),
        i = detail.input;
      const courses = await db.query(
        "SELECT CAST(cc.id AS CHAR) id,CAST(cc.course_version_id AS CHAR) versionId,cv.credits FROM curriculum_courses cc JOIN course_versions cv ON cv.id=cc.course_version_id WHERE cc.program_version_track_id=? ORDER BY cc.id",
        [i.trackId],
      );
      same(
        i.courses.map((c) => ({
          id: c.id,
          versionId: c.courseVersionId,
          credits: c.credits,
        })),
        courses.map((c) => ({ ...c, credits: Number(c.credits) })),
        "exact historical curriculum versions",
      );
      const [credits] = await db.query(
        "SELECT COALESCE(SUM(cv.credits),0) total FROM curriculum_courses cc JOIN course_versions cv ON cv.id=cc.course_version_id WHERE cc.program_version_track_id=? AND EXISTS(SELECT 1 FROM student_course_results r WHERE r.student_id=? AND r.course_version_id=cc.course_version_id AND r.result_status IN('PASSED','EXEMPTED') AND(r.passed_at IS NULL OR DATE(r.passed_at)<=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)))",
        [i.trackId, i.studentId],
      );
      same(
        detail.evaluation.rawCredits,
        Number(credits.total),
        "SQL passed/exempt credits distinct curriculum entries",
      );
      const [track] = await db.query(
        "SELECT required_total_credits FROM program_version_tracks WHERE id=?",
        [i.trackId],
      );
      same(
        detail.evaluation.requiredCredits,
        Number(track.required_total_credits),
        "no default 60/90",
      );
      const [policy] = await db.query(
        "SELECT minimum_gpa FROM graduation_policies WHERE program_version_track_id=?",
        [i.trackId],
      );
      same(
        i.policy?.minimumGpa ?? null,
        policy?.minimum_gpa == null ? null : Number(policy.minimum_gpa),
        "no default GPA",
      );
      const [evidence] = await db.query(
        "SELECT gpa FROM graduation_evidence WHERE assignment_id=?",
        [i.assignmentId],
      );
      same(
        detail.evaluation.officialGpa,
        evidence?.gpa == null ? null : Number(evidence.gpa),
        "no generated GPA from partial transcript",
      );
      same(
        row.status,
        detail.evaluation.status,
        "list/details same live result",
      );
      same(
        i.defenses.every((d) => !!d.id),
        true,
        "defense rows are persisted identities",
      );
      if (!policy)
        same(
          detail.evaluation.criteria.find((c) => c.code === "POLICY").state,
          "UNKNOWN",
          "missing policy stays unknown",
        );
      const history = await repo.history(i.assignmentId, 1, actor);
      const [count] = await db.query(
        "SELECT COUNT(*) total FROM graduation_events WHERE assignment_id=? OR(assignment_id IS NULL AND track_id=? AND event_type='POLICY')",
        [i.assignmentId, i.trackId],
      );
      same(
        history.meta.total,
        Number(count.total),
        "complete persisted history",
      );
    }
  }
  console.log("PASS " + checks + " read-only graduation SQL parity checks.");
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => (db.isInitialized ? db.destroy() : undefined));
