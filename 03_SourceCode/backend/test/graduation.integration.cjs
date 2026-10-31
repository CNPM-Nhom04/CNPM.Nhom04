/* Integration writes only on a disposable clone; uses real JWT sessions and the Next proxy. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.GRADUATION_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_graduation_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error(
    "Use GRADUATION_TEST_ALLOW_WRITES=1 and disposable ctdt_graduation_review_<timestamp> DB.",
  );
const { DataSource } = require("typeorm"),
  { JwtService } = require("@nestjs/jwt"),
  bcrypt = require("bcryptjs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const base = process.env.GRADUATION_TEST_URL || "http://localhost:3101",
  prefix = "/api/xet-tot-nghiep",
  marker = "grad_" + Date.now();
const day = (offset = 0) =>
  new Date(Date.now() + 7 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
let checks = 0,
  sequence = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function http(path, actor, status = 200, body, origin = base) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const value = await response.json().catch(() => null);
  same(response.status, status, path + " " + JSON.stringify(value?.message));
  return value;
}
async function account(role, scope = "GLOBAL", target) {
  const username = marker + "_" + ++sequence,
    password = "GraduationTest123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử " + role,
      await bcrypt.hash(password, 4),
    ],
  );
  const [u] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [username],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [u.id, role],
  );
  const column = { ORG_UNIT: "organizational_unit_id", PROGRAM: "program_id" }[
    scope
  ];
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type" +
      (column ? "," + column : "") +
      ") VALUES(?,?" +
      (column ? ",?" : "") +
      ")",
    column ? [u.id, scope, target] : [u.id, scope],
  );
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, u.id],
  );
  return {
    ...u,
    username,
    password,
    cookie:
      "ctdt_access_token=" +
      new JwtService({ secret: process.env.JWT_SECRET }).sign(
        { sub: u.id, jti: sid },
        { expiresIn: "30m" },
      ),
  };
}
async function student(track, unit, officer) {
  const code = marker + "_S" + ++sequence;
  await db.query(
    "INSERT INTO students(organizational_unit_id,student_code,full_name,admission_year) VALUES(?,?,?,2026)",
    [unit, code, "Học viên kiểm thử " + code],
  );
  const [s] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM students WHERE student_code=?",
    [code],
  );
  await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assigned_by) VALUES(?,?,?)",
    [s.id, track, officer.id],
  );
  const [a] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM student_program_assignments WHERE student_id=?",
    [s.id],
  );
  return { id: s.id, code, assignmentId: a.id };
}
const policy = (revision, extra = {}) => ({
  revision,
  requireGpa: false,
  minimumGpa: null,
  requireLanguage: false,
  languageRule: null,
  requireDefense: false,
  otherRequirements: null,
  reference: "TEST-ONLY-POLICY",
  ...extra,
});
const evidence = (revision, policyRevision, extra = {}) => ({
  revision,
  policyRevision,
  gpa: null,
  gpaReference: null,
  languageState: "UNKNOWN",
  languageReference: null,
  languageValidUntil: null,
  languageNoExpiry: false,
  otherState: "UNKNOWN",
  otherReference: null,
  ...extra,
});
async function run() {
  await db.initialize();
  const officer = await account("TRAINING_OFFICER"),
    reviewer = await account("APPROVER"),
    admin = await account("ADMIN"),
    studentUser = await account("STUDENT");
  same(
    (await http("/api/auth/profile", officer)).username,
    officer.username,
    "clone-only server probe before HTTP writes",
  );
  await http(prefix, null, 401);
  await http(prefix, { cookie: "ctdt_access_token=bad" }, 401);
  await http(prefix, studentUser, 403);
  const [track] = await db.query(
    "SELECT CAST(t.id AS CHAR) id,CAST(p.id AS CHAR) programId,CAST(p.managing_unit_id AS CHAR) unitId,CAST(p.education_level_id AS CHAR) levelId FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE v.status IN('PUBLISHED','ARCHIVED') ORDER BY t.id LIMIT 1",
  );
  const [other] = await db.query(
    "SELECT CAST(u.id AS CHAR) id FROM organizational_units u WHERE NOT EXISTS(SELECT 1 FROM organizational_unit_closure c WHERE c.ancestor_id=u.id AND c.descendant_id=?) ORDER BY u.id LIMIT 1",
    [track.unitId],
  );
  const foreign = await account("TRAINING_OFFICER", "ORG_UNIT", other.id),
    programOnly = await account("TRAINING_OFFICER", "PROGRAM", track.programId);
  const s = await student(track.id, track.unitId, officer),
    otherStudent = await student(track.id, track.unitId, officer);
  let detail = await http(prefix + "/" + s.assignmentId, officer);
  same(detail.input.policy, null, "no policy seeded");
  same(detail.evaluation.officialGpa, null, "no GPA fabricated");
  same(detail.evaluation.status, "THIEU_THONG_TIN", "missing policy unknown");
  await http(prefix + "/" + s.assignmentId, foreign, 404);
  same(
    (await http(prefix, programOnly)).meta.total,
    0,
    "program scope alone does not grant student identity",
  );
  await http(prefix + "/quy-dinh/" + track.id, foreign, 404);
  await http(prefix + "/quy-dinh/" + track.id, officer, 403, policy(0));
  await http(prefix + "/quy-dinh/" + track.id, admin, 403, policy(0));
  await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    reviewer,
    403,
    evidence(0, 1),
  );
  await http(prefix + "/" + s.assignmentId + "/kiem-tra", admin, 403, {});
  await http(prefix + "?page=0", officer, 400);
  await http(prefix + "?status=GRADUATED", officer, 400);
  await http(prefix + "/kiem-tra", officer, 400, {
    educationLevelId: track.levelId,
    limit: 101,
  });
  await http(
    prefix + "/" + s.assignmentId + "/kiem-tra",
    officer,
    403,
    {},
    "https://invalid.example",
  );
  await http(
    prefix + "/quy-dinh/" + track.id,
    reviewer,
    400,
    policy(0, { requireGpa: true }),
  );
  await http(
    prefix + "/quy-dinh/" + track.id,
    reviewer,
    400,
    policy(0, { requireLanguage: true }),
  );
  let p = await http(
    prefix + "/quy-dinh/" + track.id,
    reviewer,
    201,
    policy(0),
  );
  same(
    p.policy.minimumGpa,
    null,
    "explicit not-required policy remains nullable",
  );
  const courseRows = await db.query(
    "SELECT CAST(cc.course_id AS CHAR) courseId,CAST(cc.course_version_id AS CHAR) versionId FROM curriculum_courses cc WHERE cc.program_version_track_id=? ORDER BY cc.id",
    [track.id],
  );
  for (const [i, c] of courseRows.entries())
    await db.query(
      "INSERT INTO student_course_results(student_id,course_id,course_version_id,result_status,grade,passed_at,recorded_by) VALUES(?,?,?,?,?,UTC_TIMESTAMP(6),?)",
      [
        s.id,
        c.courseId,
        c.versionId,
        i === 0 ? "EXEMPTED" : "PASSED",
        i === 0 ? null : "8.0",
        officer.id,
      ],
    );
  await db.query(
    "INSERT INTO student_course_results(student_id,course_id,course_version_id,result_status,grade,passed_at,recorded_by) VALUES(?,?,?,'PASSED','9.0',UTC_TIMESTAMP(6),?)",
    [s.id, courseRows[0].courseId, courseRows[0].versionId, officer.id],
  );
  detail = await http(prefix + "/" + s.assignmentId, officer);
  same(
    detail.evaluation.status,
    "DU_DIEN_KIEN",
    "SQL credits meet explicitly configured requirements",
  );
  const raw = detail.evaluation.rawCredits;
  same(
    detail.evaluation.courses.filter((c) => c.passed).length,
    courseRows.length,
    "duplicate retake not counted twice",
  );
  detail = await http(
    prefix + "/" + s.assignmentId + "/kiem-tra",
    officer,
    201,
    {},
  );
  same(
    detail.changedSinceCheck,
    false,
    "fresh fingerprint matches current data",
  );
  await db.query(
    "UPDATE student_course_results SET result_status='INCOMPLETE',grade=NULL,passed_at=NULL WHERE student_id=? AND course_version_id=?",
    [s.id, courseRows[0].versionId],
  );
  detail = await http(prefix + "/" + s.assignmentId, officer);
  same(
    detail.changedSinceCheck,
    true,
    "live data change flagged after snapshot",
  );
  same(
    detail.evaluation.status,
    "CHUA_DU_DIEN_KIEN",
    "live result not stale eligible",
  );
  await db.query(
    "UPDATE student_course_results SET result_status='EXEMPTED',grade=NULL,passed_at=UTC_TIMESTAMP(6) WHERE student_id=? AND course_version_id=?",
    [s.id, courseRows[0].versionId],
  );
  p = await http(
    prefix + "/quy-dinh/" + track.id,
    reviewer,
    201,
    policy(1, {
      requireGpa: true,
      minimumGpa: 7.3,
      requireLanguage: true,
      languageRule: "TEST-LANGUAGE",
      requireDefense: true,
      otherRequirements: "TEST-ADMINISTRATIVE-CLEARANCE",
    }),
  );
  await http(prefix + "/quy-dinh/" + track.id, reviewer, 409, policy(1));
  await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    officer,
    409,
    evidence(0, 1),
  );
  await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    officer,
    400,
    evidence(0, 2, { gpa: 8 }),
  );
  await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    officer,
    400,
    evidence(0, 2, { languageState: "MET", languageReference: "TEST" }),
  );
  const e = evidence(0, 2, {
    gpa: 0,
    gpaReference: "TEST-TRANSCRIPT",
    languageState: "MET",
    languageReference: "TEST-LANGUAGE-CERT",
    languageValidUntil: day(-1),
    otherState: "MET",
    otherReference: "TEST-CLEARANCE",
  });
  detail = await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    officer,
    201,
    e,
  );
  same(
    detail.evaluation.officialGpa,
    0,
    "official GPA zero distinct from absent",
  );
  same(
    detail.evaluation.criteria.find((c) => c.code === "LANGUAGE").state,
    "NOT_MET",
    "expired language proof",
  );
  detail = await http(
    prefix + "/" + s.assignmentId + "/minh-chung",
    officer,
    201,
    { ...e, revision: 1, gpa: 8.2, languageValidUntil: day(30) },
  );
  same(
    detail.evaluation.criteria.find((c) => c.code === "DEFENSE").state,
    "NOT_MET",
    "no invented defense",
  );
  async function defense(target) {
    await db.query(
      "INSERT INTO thesis_defenses(student_id,assignment_id,program_version_track_id,student_name_snapshot,program_name_snapshot,thesis_title,defense_date,location,council_chair,reviewer,secretary,eligibility_note,passing_score,created_by) VALUES(?,?,?,?,?,?,?,'TEST','TEST A','TEST B','TEST C','TEST ONLY verified eligibility',8,?)",
      [
        target.id,
        target.assignmentId,
        track.id,
        "Test student",
        "Test program",
        "TEST-LEGACY-DEFENSE",
        day(),
        officer.id,
      ],
    );
    const [d] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM thesis_defenses WHERE assignment_id=? ORDER BY id DESC LIMIT 1",
      [target.assignmentId],
    );
    await db.query(
      "UPDATE thesis_defenses SET status='DA_DAT',average_score=8.5,graded_by=?,graded_at=UTC_TIMESTAMP(6) WHERE id=?",
      [reviewer.id, d.id],
    );
  }
  await defense(otherStudent);
  same(
    (
      await http(prefix + "/" + s.assignmentId, officer)
    ).evaluation.criteria.find((c) => c.code === "DEFENSE").state,
    "NOT_MET",
    "other assignment defense does not count",
  );
  await defense(s);
  detail = await http(prefix + "/" + s.assignmentId, officer);
  same(detail.evaluation.status, "DU_DIEN_KIEN", "all recorded criteria met");
  const before = Number(
    (
      await db.query(
        "SELECT COUNT(*) n FROM graduation_events WHERE assignment_id=?",
        [s.assignmentId],
      )
    )[0].n,
  );
  await db.query(
    "CREATE TRIGGER test_grad_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='GRADUATION_CHECK' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST rollback'; END IF; END",
  );
  try {
    await http(prefix + "/" + s.assignmentId + "/kiem-tra", officer, 409, {});
  } finally {
    await db.query("DROP TRIGGER test_grad_audit_failure");
  }
  same(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM graduation_events WHERE assignment_id=?",
          [s.assignmentId],
        )
      )[0].n,
    ),
    before,
    "audit failure rolls back check event",
  );
  detail = await http(
    prefix + "/" + s.assignmentId + "/kiem-tra",
    officer,
    201,
    {},
  );
  const [state] = await db.query("SELECT status FROM students WHERE id=?", [
    s.id,
  ]);
  same(
    state.status,
    "ACTIVE",
    "eligibility check never awards degree/changes student state",
  );
  const h = await http(prefix + "/" + s.assignmentId + "/lich-su", officer);
  assert(
    h.data.some(
      (v) =>
        v.eventType === "CHECK" && v.data.evaluation.status === "DU_DIEN_KIEN",
    ),
  );
  checks++;
  await assert.rejects(
    db.query("UPDATE graduation_events SET data='{}' WHERE assignment_id=?", [
      s.assignmentId,
    ]),
  );
  checks++;
  await assert.rejects(
    db.query("DELETE FROM graduation_events WHERE assignment_id=?", [
      s.assignmentId,
    ]),
  );
  checks++;
  const current = detail.input.evidence;
  const race = await Promise.all(
    [1, 2].map(() =>
      fetch(base + prefix + "/" + s.assignmentId + "/minh-chung", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: officer.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...e,
          revision: current.revision,
          gpa: 8.2,
          languageValidUntil: day(30),
        }),
      }),
    ),
  );
  same(
    race.map((r) => r.status).sort(),
    [201, 409],
    "concurrent evidence revision",
  );
  p = await http(
    prefix + "/quy-dinh/" + track.id,
    reviewer,
    201,
    policy(2, {
      requireGpa: true,
      minimumGpa: 7.3,
      requireLanguage: true,
      languageRule: "TEST-LANGUAGE-UPDATED",
      requireDefense: true,
      otherRequirements: "TEST-ADMINISTRATIVE-CLEARANCE",
    }),
  );
  detail = await http(prefix + "/" + s.assignmentId, officer);
  same(
    detail.evaluation.status,
    "THIEU_THONG_TIN",
    "policy update requires evidence re-verification",
  );
  let cursor,
    total = 0,
    seen = new Set();
  do {
    const r = await http(prefix + "/kiem-tra", officer, 201, {
      educationLevelId: track.levelId,
      afterId: cursor,
      limit: 1,
    });
    total += r.checked;
    if (!r.hasMore) break;
    assert(r.nextAfterId && !seen.has(r.nextAfterId));
    seen.add(r.nextAfterId);
    cursor = r.nextAfterId;
  } while (true);
  const [count] = await db.query(
    "SELECT COUNT(*) n FROM student_program_assignments a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE a.assignment_status='ACTIVE' AND p.education_level_id=?",
    [track.levelId],
  );
  same(
    total,
    Number(count.n),
    "all active assignments via cursor exactly once",
  );
  await db.query("UPDATE students SET status='SUSPENDED' WHERE id=?", [s.id]);
  await http(prefix + "/" + s.assignmentId + "/minh-chung", officer, 409, {
    ...e,
    revision: current.revision + 1,
    policyRevision: 3,
  });
  await db.query("UPDATE students SET status='ACTIVE' WHERE id=?", [s.id]);
  await db.query("DELETE FROM user_roles WHERE user_id=?", [programOnly.id]);
  await http(prefix, programOnly, 403);
  fs.writeFileSync(
    process.env.GRADUATION_BROWSER_FIXTURE ||
      "/tmp/ctdt-graduation-browser.json",
    JSON.stringify({
      name: process.env.DB_DATABASE,
      base,
      officer,
      reviewer,
      admin,
      foreign,
      s,
      track,
      raw,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS " +
      checks +
      " graduation JWT/proxy/SQL checks; disposable browser fixture ready.",
  );
}
run()
  .catch((e) => {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  })
  .finally(() => (db.isInitialized ? db.destroy() : undefined));
