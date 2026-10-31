/* Read-only parity against the configured SQL database, without fixture users or sessions. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm"),
  {
    MysqlGradeRepository,
  } = require("../dist/modules/grades/infrastructure/grade.repository");
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
function same(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function main() {
  await db.initialize();
  const repo = new MysqlGradeRepository(db);
  const users = await db.query(
    "SELECT CAST(id AS CHAR) id,username FROM users WHERE account_status='ACTIVE' AND deleted_at IS NULL ORDER BY id",
  );
  for (const u of users) {
    const permissions = await db.query(
      "SELECT DISTINCT p.permission_code code FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE'",
      [u.id],
    );
    if (!permissions.some((p) => p.code === "GRADE_READ")) continue;
    const a = {
      ...u,
      canManage: permissions.some((p) => p.code === "GRADE_MANAGE"),
      ip: "",
    };
    const rows = [];
    let page = 1,
      result;
    do {
      result = await repo.list({ page, limit: 100 }, a);
      rows.push(...result.data);
      page++;
    } while (page <= result.meta.totalPages);
    const expected = await db.query(
      "SELECT CAST(r.id AS CHAR) id,r.grade,r.result_status resultStatus,CAST(r.course_version_id AS CHAR) courseVersionId,s.student_code studentCode,v.course_name courseName FROM student_course_results r JOIN students s ON s.id=r.student_id JOIN courses c ON c.id=r.course_id JOIN course_versions v ON v.id=r.course_version_id WHERE EXISTS(SELECT 1 FROM vw_user_course_access ca WHERE ca.user_id=? AND ca.course_id=c.id) AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id) ORDER BY r.id DESC",
      [u.id, u.id],
    );
    same(
      rows.map((r) => ({
        id: r.id,
        grade: r.grade,
        resultStatus: r.resultStatus,
        courseVersionId: r.courseVersionId,
        studentCode: r.studentCode,
        courseName: r.courseName,
      })),
      expected,
      u.username + " SQL results",
    );
    same(result.meta.total, expected.length, u.username + " total");
    same(
      result.permissions.canManage,
      a.canManage,
      u.username + " role permission",
    );
    for (const row of rows) {
      const item = await repo.detail(row.id, a);
      const [detail] = await db.query(
        "SELECT attendance_score a,midterm_score m,exam_score e,total_score t,state FROM grade_details WHERE result_id=?",
        [row.id],
      );
      same(item.state, detail?.state || "LEGACY", row.id + " lifecycle");
      same(
        [
          item.attendanceScore,
          item.midtermScore,
          item.examScore,
          item.totalScore,
        ],
        detail
          ? [detail.a, detail.m, detail.e, detail.t].map((x) =>
              x == null ? null : Number(x),
            )
          : [null, null, null, null],
        row.id + " zero/null parity",
      );
      const [history] = await db.query(
        "SELECT COUNT(*) total FROM grade_revisions WHERE result_id=?",
        [row.id],
      );
      same(
        item.history.length,
        Number(history.total),
        row.id + " complete history",
      );
    }
    const regs = await repo.registrations({ page: 1, limit: 100 }, a);
    const [count] = await db.query(
      "SELECT COUNT(*) total FROM course_registrations cr JOIN course_offerings co ON co.id=cr.course_offering_id JOIN course_versions v ON v.id=co.course_version_id WHERE cr.status='REGISTERED' AND co.status IN ('OPEN','CLOSED','CONFIRMED','COMPLETED') AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=cr.student_id) AND EXISTS(SELECT 1 FROM vw_user_course_access ca WHERE ca.user_id=? AND ca.course_id=v.course_id) AND NOT EXISTS(SELECT 1 FROM student_course_results r WHERE r.student_id=cr.student_id AND r.course_offering_id=co.id)",
      [u.id, u.id],
    );
    same(
      regs.meta.total,
      Number(count.total),
      u.username + " real eligible registrations",
    );
    console.log(
      u.username +
        ": results=" +
        rows.length +
        ", registrations=" +
        regs.meta.total +
        ", canManage=" +
        a.canManage,
    );
  }
  console.log("PASS: " + checks + " read-only grading SQL parity checks.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
