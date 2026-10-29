/* Read-only parity check: compare authenticated API responses to actual relational SQL data. */
const assert = require("node:assert/strict"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const { DataSource } = require("typeorm"),
  { JwtService } = require("@nestjs/jwt");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const base = process.env.FRONTEND_URL || "http://localhost:3000";
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
const sessions = new Map();
let comparisons = 0;
const same = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  comparisons++;
};
const ids = (rows) => rows.map((row) => String(row.id)).sort();
async function api(route, userId) {
  if (!sessions.has(String(userId))) {
    const id = require("node:crypto").randomUUID();
    await db.query(
      "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES (?,?,TIMESTAMPADD(MINUTE,10,UTC_TIMESTAMP(6)),10,UTC_TIMESTAMP(6))",
      [id, userId],
    );
    sessions.set(String(userId), id);
  }
  const response = await fetch(base + "/api/chuong-trinh-dao-tao" + route, {
    headers: {
      Cookie:
        "ctdt_access_token=" +
        jwt.sign(
          { sub: String(userId), jti: sessions.get(String(userId)) },
          { expiresIn: "5m" },
        ),
    },
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, 200, route + " HTTP status");
  return response.json();
}
(async () => {
  try {
    await db.initialize();
    const [admin] = await db.query(
      "SELECT CAST(u.id AS CHAR) AS id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.role_code='ADMIN' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1",
    );
    assert.ok(admin, "An active ADMIN read account is required");
    const [count] = await db.query(
      "SELECT COUNT(*) AS total FROM program_versions v JOIN training_programs p ON p.id=v.program_id",
    );
    const list = await api("?page=1&limit=100", admin.id);
    same(
      list.meta.total,
      Number(count.total),
      "Every real SQL version is counted",
    );
    const sqlVersions = await db.query(
      "SELECT CAST(v.id AS CHAR) AS id,v.version_code,v.cohort_year,v.source_program_version_id FROM program_versions v JOIN training_programs p ON p.id=v.program_id ORDER BY v.id",
    );
    const listed = [...list.data];
    for (let page = 2; page <= list.meta.totalPages; page++)
      listed.push(
        ...(await api("?page=" + page + "&limit=100", admin.id)).data,
      );
    same(ids(listed), ids(sqlVersions), "No real SQL version omitted by list");
    const totals = {
      versions: sqlVersions.length,
      tracks: 0,
      groups: 0,
      courses: 0,
      plos: 0,
      prerequisites: 0,
      ploMappings: 0,
      approvalRequests: 0,
      approvalActions: 0,
      nullSemesters: 0,
    };
    for (const version of sqlVersions) {
      const item = await api("/" + version.id, admin.id);
      same(item.maPhienBan, version.version_code, "Version code " + version.id);
      same(
        item.cohortYear,
        Number(version.cohort_year),
        "Cohort year " + version.id,
      );
      const tracks = await db.query(
        "SELECT CAST(id AS CHAR) AS id,status FROM program_version_tracks WHERE program_version_id=?",
        [version.id],
      );
      same(ids(item.tracks), ids(tracks), "All tracks " + version.id);
      totals.tracks += tracks.length;
      const outcomes = await db.query(
        "SELECT CAST(id AS CHAR) AS id FROM program_learning_outcomes WHERE program_version_id=?",
        [version.id],
      );
      same(
        ids(item.learningOutcomes || []),
        ids(outcomes),
        "All PLOs " + version.id,
      );
      totals.plos += outcomes.length;
      for (const track of item.tracks) {
        const groups = await db.query(
          "SELECT CAST(id AS CHAR) AS id,maximum_credits FROM curriculum_groups WHERE program_version_track_id=?",
          [track.id],
        );
        same(ids(track.groups), ids(groups), "All groups " + track.id);
        totals.groups += groups.length;
        for (const group of track.groups) {
          const expected = groups.find((row) => row.id === group.id);
          same(
            group.maximumCredits,
            expected.maximum_credits == null
              ? null
              : Number(expected.maximum_credits),
            "Group maximum " + group.id,
          );
        }
        const courses = await db.query(
          "SELECT CAST(cc.id AS CHAR) AS id,cc.suggested_semester,cv.theory_hours,cv.practice_hours FROM curriculum_courses cc JOIN course_versions cv ON cv.id=cc.course_version_id WHERE cc.program_version_track_id=?",
          [track.id],
        );
        same(ids(track.courses), ids(courses), "All courses " + track.id);
        totals.courses += courses.length;
        for (const course of track.courses) {
          const source = courses.find((row) => row.id === course.id);
          same(
            course.semester,
            source.suggested_semester == null
              ? null
              : Number(source.suggested_semester),
            "SQL NULL semester preserved " + course.id,
          );
          if (source.suggested_semester == null) totals.nullSemesters++;
          same(
            course.theoryHours,
            Number(source.theory_hours),
            "Theory hours " + course.id,
          );
          same(
            course.practiceHours,
            Number(source.practice_hours),
            "Practice hours " + course.id,
          );
          const prerequisites = await db.query(
            "SELECT CAST(id AS CHAR) AS id FROM curriculum_prerequisites WHERE curriculum_course_id=?",
            [course.id],
          );
          same(
            ids(course.prerequisites || []),
            ids(prerequisites),
            "All prerequisites " + course.id,
          );
          totals.prerequisites += prerequisites.length;
          const mappings = await db.query(
            "SELECT CAST(plo_id AS CHAR) AS id FROM curriculum_course_plos WHERE curriculum_course_id=?",
            [course.id],
          );
          same(
            (course.ploMappings || []).map((row) => row.ploId).sort(),
            ids(mappings),
            "All PLO mappings " + course.id,
          );
          totals.ploMappings += mappings.length;
        }
      }
      const requests = await db.query(
        "SELECT CAST(id AS CHAR) AS id FROM approval_requests WHERE program_version_id=?",
        [version.id],
      );
      same(
        ids(item.approvalHistory || []),
        ids(requests),
        "All submission cycles " + version.id,
      );
      totals.approvalRequests += requests.length;
      for (const request of item.approvalHistory || []) {
        const actions = await db.query(
          "SELECT CAST(id AS CHAR) AS id FROM approval_actions WHERE approval_request_id=?",
          [request.id],
        );
        same(
          ids(request.actions),
          ids(actions),
          "All approval actions " + request.id,
        );
        totals.approvalActions += actions.length;
      }
    }
    const baseRows = await db.query(
      "SELECT CAST(p.id AS CHAR) AS id FROM training_programs p WHERE NOT EXISTS(SELECT 1 FROM program_versions v WHERE v.program_id=p.id)",
    );
    const without = await api("/chua-co-phien-ban?limit=100", admin.id);
    same(
      ids(without.data),
      ids(baseRows),
      "Programs with no version are exposed",
    );
    const [fit] = await db.query(
      "SELECT CAST(id AS CHAR) AS id FROM users WHERE username='officer.fit' AND account_status='ACTIVE' AND deleted_at IS NULL",
    );
    if (fit) {
      const scoped = await api("?limit=100", fit.id);
      const [outOfScope] = await db.query(
        `SELECT COUNT(*) AS n FROM program_versions v JOIN training_programs p ON p.id=v.program_id
        WHERE NOT EXISTS (SELECT 1 FROM user_scopes us WHERE us.user_id=? AND (
          us.scope_type='GLOBAL' OR (us.scope_type='PROGRAM' AND us.program_id=p.id)
          OR (us.scope_type='MAJOR' AND us.major_id=p.major_id)
          OR (us.scope_type='ORG_UNIT' AND EXISTS(SELECT 1 FROM organizational_unit_closure oc
            WHERE oc.ancestor_id=us.organizational_unit_id AND oc.descendant_id=p.managing_unit_id))))`,
        [fit.id],
      );
      same(
        scoped.meta.total,
        sqlVersions.length - Number(outOfScope.n),
        "FIT scope remains enforced",
      );
    }
    console.log(
      JSON.stringify({
        parity: "passed",
        comparisons,
        totals,
        unversioned: baseRows.length,
      }),
    );
  } finally {
    if (db.isInitialized)
      for (const id of sessions.values())
        await db.query("DELETE FROM auth_sessions WHERE id=?", [id]);
    if (db.isInitialized) await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
