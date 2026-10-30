/* Read-only: no fixture accounts, sessions, schema or data changes. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm");
const {
  MysqlCourseRepository,
} = require("../dist/modules/courses/infrastructure/course.repository");
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
const same = (a, b, note) => {
  assert.deepEqual(a, b, note);
  checks++;
};
async function main() {
  await db.initialize();
  const repository = new MysqlCourseRepository(db);
  const users = await db.query(
    "SELECT CAST(u.id AS CHAR) id,u.username FROM users u WHERE u.account_status='ACTIVE' AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code='CATALOG_READ') ORDER BY u.id",
  );
  for (const user of users) {
    const [manage] = await db.query(
      "SELECT COUNT(*) total FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE' AND p.permission_code='CATALOG_MANAGE'",
      [user.id],
    );
    const actor = { ...user, canManage: Number(manage.total) > 0, ip: "" };
    const sql = await db.query(
      "SELECT CAST(c.id AS CHAR) id,c.course_code courseCode FROM courses c WHERE EXISTS(SELECT 1 FROM user_scopes us WHERE us.user_id=? AND (us.scope_type='GLOBAL' OR (us.scope_type='ORG_UNIT' AND EXISTS(SELECT 1 FROM organizational_unit_closure oc WHERE oc.ancestor_id=us.organizational_unit_id AND oc.descendant_id=c.owning_unit_id)))) ORDER BY c.course_code,c.id",
      [user.id],
    );
    const all = [];
    let page = 1,
      result;
    do {
      result = await repository.list({ page, limit: 100 }, actor);
      same(result.meta.total, sql.length, user.username + " count");
      all.push(...result.data);
      page++;
    } while (page <= result.meta.totalPages);
    same(
      all.map((c) => ({ id: c.id, courseCode: c.courseCode })),
      sql,
      user.username + " full list",
    );
    same(
      result.permissions.canManage,
      actor.canManage,
      user.username + " permission",
    );
    for (const course of all) {
      const detail = await repository.detail(course.id, actor);
      const versions = await db.query(
        "SELECT CAST(id AS CHAR) id,version_no versionNo,course_name courseName,credits,theory_hours theoryHours,practice_hours practiceHours,status FROM course_versions WHERE course_id=? ORDER BY version_no DESC",
        [course.id],
      );
      same(
        detail.versions.map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          courseName: v.courseName,
          credits: v.credits,
          theoryHours: v.theoryHours,
          practiceHours: v.practiceHours,
          status: v.status,
        })),
        versions.map((v) => ({ ...v, credits: Number(v.credits) })),
        "version parity " + course.courseCode,
      );
      same(
        course.latestVersionId,
        versions[0]?.id || null,
        "latest " + course.courseCode,
      );
      same(
        course.activeVersionId,
        versions.find((v) => v.status === "ACTIVE")?.id || null,
        "active " + course.courseCode,
      );
    }
    console.log(
      user.username +
        ": " +
        all.length +
        " courses; canManage=" +
        actor.canManage,
    );
  }
  console.log("PASS: " + checks + " read-only catalog SQL parity checks.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
