/* Read-only parity on the configured database; no test accounts or sessions. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm"),
  {
    MysqlTopicRepository,
  } = require("../dist/modules/thesis-topic/infrastructure/thesis-topic.repository");
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
  const repo = new MysqlTopicRepository(db);
  const users = await db.query(
    "SELECT CAST(id AS CHAR) id,username FROM users WHERE account_status='ACTIVE' AND deleted_at IS NULL ORDER BY id",
  );
  for (const u of users) {
    const rows = await db.query(
      "SELECT DISTINCT p.permission_code code FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE'",
      [u.id],
    );
    const a = { ...u, permissions: rows.map((r) => r.code), ip: "" };
    if (!a.permissions.includes("TOPIC_READ")) continue;
    const all = [];
    let page = 1,
      result;
    do {
      result = await repo.list({ page, limit: 100 }, a);
      all.push(...result.data);
      page++;
    } while (page <= result.meta.totalPages);
    const expected = await db.query(
      "SELECT CAST(x.id AS CHAR) id FROM thesis_topics x JOIN student_program_assignments a ON a.id=x.assignment_id JOIN students s ON s.id=a.student_id JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE EXISTS(SELECT 1 FROM vw_user_program_access pa WHERE pa.user_id=? AND pa.program_id=p.id) AND EXISTS(SELECT 1 FROM vw_user_student_access sa WHERE sa.user_id=? AND sa.student_id=s.id) ORDER BY x.id DESC",
      [u.id, u.id],
    );
    same(
      all.map((x) => x.id),
      expected.map((x) => x.id),
      u.username + " topics",
    );
    same(result.meta.total, expected.length, u.username + " total");
    same(
      result.permissions.canManage,
      a.permissions.includes("TOPIC_MANAGE"),
      u.username + " manage",
    );
    const students = await repo.students({ page: 1, limit: 100 }, a);
    for (const s of students.data) {
      const [row] = await db.query(
        "SELECT CAST(a.id AS CHAR) id,s.full_name name FROM student_program_assignments a JOIN students s ON s.id=a.student_id WHERE a.id=? AND a.assignment_status='ACTIVE'",
        [s.assignmentId],
      );
      same(s.studentName, row.name, u.username + " student identity");
    }
    console.log(
      u.username +
        ": topics=" +
        all.length +
        ", eligibleStudents=" +
        students.meta.total +
        ", manage=" +
        result.permissions.canManage,
    );
  }
  console.log("PASS: " + checks + " read-only topic SQL parity checks.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
