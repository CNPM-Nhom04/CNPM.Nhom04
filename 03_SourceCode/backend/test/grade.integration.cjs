/* Run only on a disposable DB clone and a backend connected to that same clone. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.GRADE_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_grade_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error(
    "Use GRADE_TEST_ALLOW_WRITES=1 and an isolated DB named ctdt_grade_review_<timestamp>.",
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
const base = process.env.GRADE_TEST_URL || "http://localhost:3101";
const proxy = process.env.GRADE_TEST_PROXY !== "0",
  prefix = (proxy ? "/api" : "") + "/quan-ly-diem";
const marker = "grade_review_" + Date.now();
let checks = 0,
  sequence = 0;
const same = (a, b, note) => {
  assert.deepEqual(a, b, note);
  checks++;
};
const day = (offset = 0) =>
  new Date(Date.now() + 7 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
async function api(route, actor, status = 200, body, extraHeaders = {}) {
  const r = await fetch(base + prefix + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      ...(actor
        ? proxy
          ? { Cookie: "ctdt_access_token=" + actor.token }
          : { Authorization: "Bearer " + actor.token }
        : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    redirect: "manual",
  });
  const result = await r.json().catch(() => null);
  same(r.status, status, route + " " + JSON.stringify(result?.message));
  return result;
}
async function actor(role, scopes) {
  const name = marker + "_" + ++sequence,
    password = "CatalogReview123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [name, name + "@example.invalid", name, await bcrypt.hash(password, 4)],
  );
  const [user] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [name],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [user.id, role],
  );
  for (const [type, target] of scopes) {
    const col = {
      ORG_UNIT: "organizational_unit_id",
      MAJOR: "major_id",
      PROGRAM: "program_id",
    }[type];
    await db.query(
      "INSERT INTO user_scopes(user_id,scope_type" +
        (col ? "," + col : "") +
        ") VALUES(?,?" +
        (col ? ",?" : "") +
        ")",
      col ? [user.id, type, target] : [user.id, type],
    );
  }
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, user.id],
  );
  return {
    id: user.id,
    username: name,
    password,
    token: new JwtService({ secret: process.env.JWT_SECRET }).sign(
      { sub: user.id, jti: sid },
      { expiresIn: "30m" },
    ),
  };
}
async function offering(status = "OPEN") {
  const code = marker + "_c" + ++sequence;
  await db.query(
    "INSERT INTO course_offerings(registration_period_id,course_version_id,class_code,capacity,status) VALUES(1,6,?,50,?)",
    [code, status],
  );
  const [c] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM course_offerings WHERE class_code=?",
    [code],
  );
  return { id: c.id, classCode: code, status };
}
async function student(unitId = "1") {
  const code = marker + "_s" + ++sequence;
  await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,organizational_unit_id) VALUES(?,?,2026,?)",
    [code, "SQL " + code, unitId],
  );
  const [s] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM students WHERE student_code=?",
    [code],
  );
  return { id: s.id, studentCode: code, studentName: "SQL " + code };
}
async function register(s, c, status = "REGISTERED") {
  await db.query(
    "INSERT INTO course_registrations(student_id,course_offering_id,status) VALUES(?,?,?)",
    [s.id, c.id, status],
  );
  const [r] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM course_registrations WHERE student_id=? AND course_offering_id=?",
    [s.id, c.id],
  );
  return { id: r.id, studentId: s.id, offeringId: c.id };
}
const reason = {
  note: "Verified official assessment documents on test copy",
  reference: "TEST-ONLY-RECORD",
};
const rules = (extra = {}) => ({
  revision: 0,
  attendanceWeight: 20,
  midtermWeight: 30,
  examWeight: 50,
  passingScore: 6.25,
  decimalPlaces: 2,
  rounding: "HALF_UP",
  reference: "TEST-ONLY-POLICY",
  ...extra,
});
const scores = (value, extra = {}) => ({
  attendanceScore: value,
  midtermScore: value,
  examScore: value,
  ...reason,
  ...extra,
});
const command = (item) => ({ revision: item.revision, ...reason });
async function passed(s) {
  const [r] = await db.query(
    "SELECT COUNT(*) total FROM vw_student_passed_courses WHERE student_id=? AND course_id=6",
    [s.id],
  );
  return Number(r.total);
}
async function race(route, actors, body) {
  const responses = await Promise.all(
    actors.map((a) =>
      fetch(base + prefix + route, {
        method: "POST",
        headers: {
          Origin: base,
          "Content-Type": "application/json",
          ...(proxy
            ? { Cookie: "ctdt_access_token=" + a.token }
            : { Authorization: "Bearer " + a.token }),
        },
        body: JSON.stringify(body),
      }),
    ),
  );
  same(
    responses.map((r) => r.status).sort(),
    [201, 409],
    "single concurrent winner: " + route,
  );
  return responses.find((r) => r.status === 201).json();
}
async function main() {
  await db.initialize();
  const admin = await actor("ADMIN", [["GLOBAL"]]),
    fit = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    fit2 = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    fbe = await actor("TRAINING_OFFICER", [["ORG_UNIT", "2"]]),
    approver = await actor("APPROVER", [["ORG_UNIT", "1"]]),
    none = await actor("TRAINING_OFFICER", []),
    major = await actor("TRAINING_OFFICER", [["MAJOR", "1"]]),
    learner = await actor("STUDENT", [["GLOBAL"]]),
    globalOfficer = await actor("TRAINING_OFFICER", [["GLOBAL"]]);
  // These sessions exist only on the clone: fail before HTTP mutations if a server points at the wrong DB.
  const initial = await api("?limit=100", admin);
  const source = await db.query(
    "SELECT CAST(id AS CHAR) id,grade,result_status resultStatus FROM student_course_results ORDER BY id DESC",
  );
  same(
    initial.data.map((r) => ({
      id: r.id,
      grade: r.grade,
      resultStatus: r.resultStatus,
    })),
    source,
    "full legacy SQL parity",
  );
  same(initial.permissions.canManage, false);
  for (const r of initial.data) {
    same(r.state, "LEGACY");
    same(r.attendanceScore, null);
    same(r.totalScore, null);
  }
  same(
    initial.data.find((r) => r.resultStatus === "EXEMPTED").grade,
    null,
    "exemption is not a fake zero",
  );
  await api("", null, 401);
  await api("", learner, 403);
  await api("", { token: "bad" }, 401);
  await api("", admin, 403, {});
  await api("", approver, 403, {});
  await api("", fit, 403, {}, { Origin: "https://invalid.example" });
  for (const a of [fbe, none, major]) same((await api("", a)).meta.total, 0);
  await api("/1", fbe, 404);
  await api("/1", none, 404);
  await api("/0", fit, proxy ? 404 : 400);
  await api("/18446744073709551616", fit, 400);
  for (const query of [
    "?page=0",
    "?limit=101",
    "?resultStatus=INVALID",
    "?state=INVALID",
  ])
    await api(query, fit, 400);
  const c = await offering(),
    s = await student(),
    reg = await register(s, c),
    canceled = await register(await student(), c, "CANCELLED"),
    foreign = await register(await student("2"), c);
  same(
    (await api("/dang-ky?searchTerm=" + s.studentCode, fit)).data[0].id,
    reg.id,
  );
  same((await api("/dang-ky?searchTerm=" + s.studentCode, fbe)).meta.total, 0);
  const allReg = await api("/dang-ky?offeringId=" + c.id, fit);
  same(
    allReg.data.some((r) => r.id === canceled.id),
    false,
  );
  same(
    allReg.data.some((r) => r.id === foreign.id),
    false,
  );
  const noPolicy = await api("/lop-hoc/" + c.id + "/quy-tac", fit);
  same(noPolicy.policy, null);
  const [configured] = await db.query(
    "SELECT setting_value FROM system_settings WHERE setting_key='training.diemDatHocPhan'",
  );
  same(
    noPolicy.configuredPassingScore,
    configured?.setting_value ? Number(configured.setting_value) : null,
    "no invented pass threshold",
  );
  await api("", fit, 409, { registrationId: reg.id, ...scores(8) });
  await api("/lop-hoc/" + c.id + "/quy-tac", admin, 403, rules());
  await api("/lop-hoc/" + c.id + "/quy-tac", fbe, 404, rules());
  for (const bad of [
    { attendanceWeight: "20" },
    { attendanceWeight: 19.99 },
    { passingScore: 0 },
    { decimalPlaces: 3 },
    { rounding: "BANKERS" },
    { reference: " " },
  ]) {
    await api("/lop-hoc/" + c.id + "/quy-tac", fit, 400, rules(bad));
  }
  const policy = await race(
    "/lop-hoc/" + c.id + "/quy-tac",
    [fit, fit2],
    rules(),
  );
  same(policy.policy.revision, 1);
  await api("/lop-hoc/" + c.id + "/quy-tac", fit, 409, rules());
  const updatedPolicy = await api(
    "/lop-hoc/" + c.id + "/quy-tac",
    fit,
    201,
    rules({ revision: policy.policy.revision }),
  );
  same(updatedPolicy.policy.revision, 2);
  for (const bad of [
    { attendanceScore: -1 },
    { attendanceScore: 10.01 },
    { attendanceScore: "8" },
    { attendanceScore: true },
    { attendanceScore: 8.001 },
    { note: "short" },
    { reference: " " },
    { registrationId: "0" },
  ])
    await api("", fit, 400, { registrationId: reg.id, ...scores(8), ...bad });
  await api("", fit, 404, { registrationId: foreign.id, ...scores(8) });
  await api("", fbe, 404, { registrationId: reg.id, ...scores(8) });
  await api("", fit, 409, { registrationId: canceled.id, ...scores(8) });
  let item = await race("", [fit, fit2], {
    registrationId: reg.id,
    ...scores(null),
    attendanceScore: 0,
    studentId: foreign.studentId,
    courseVersionId: "22",
    resultStatus: "PASSED",
    totalScore: 10,
  });
  same(item.state, "DRAFT");
  same(item.resultStatus, "INCOMPLETE");
  same(item.grade, null);
  same(item.totalScore, null);
  same(item.attendanceScore, 0);
  same(item.studentId, s.id);
  same(item.courseVersionId, "6");
  same(await passed(s), 0);
  same((await api("/dang-ky?searchTerm=" + s.studentCode, fit)).meta.total, 0);
  await api("/" + item.id + "/chot", fit, 409, command(item));
  await api(
    "/lop-hoc/" + c.id + "/quy-tac",
    fit,
    409,
    rules({ revision: updatedPolicy.policy.revision }),
  );
  same((await api("/lop-hoc/" + c.id + "/quy-tac", fit)).frozen, true);
  await db.query("UPDATE course_offerings SET status='COMPLETED' WHERE id=?", [
    c.id,
  ]);
  await api("/" + item.id + "/chot", fit, 400, command(item));
  const previous = item;
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    revision: item.revision,
    ...scores(0),
  });
  same(item.totalScore, 0);
  same(item.resultStatus, "INCOMPLETE");
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    revision: previous.revision,
    ...scores(8),
  });
  item = await race("/" + item.id + "/chot", [fit, fit2], command(item));
  same(item.resultStatus, "FAILED");
  same(item.totalScore, 0);
  same(item.grade, "0.00");
  same(item.passedAt, null);
  same(await passed(s), 0);
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    revision: item.revision,
    ...scores(6.25),
  });
  same(item.resultStatus, "PASSED");
  same(item.totalScore, 6.25);
  same(await passed(s), 1);
  const firstPassedAt = item.passedAt;
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    revision: item.revision,
    ...scores(9),
  });
  same(
    item.passedAt,
    firstPassedAt,
    "preserve original passing time while correcting another passing grade",
  );
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    revision: item.revision,
    ...scores(6.24),
  });
  same(item.resultStatus, "FAILED");
  same(item.passedAt, null);
  same(await passed(s), 0);
  await api("/" + item.id + "/cap-nhat", fit, 400, {
    revision: item.revision,
    ...scores(null),
  });
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    revision: item.revision,
    ...scores(8),
    note: "x".repeat(1000),
    reference: "r".repeat(255),
  });
  same(item.resultStatus, "PASSED");
  await api("/" + item.id + "/chot", fit, 409, command(item));
  item = await api("/" + item.id + "/huy", fit, 201, command(item));
  same(item.state, "VOIDED");
  same(item.resultStatus, "INCOMPLETE");
  same(item.grade, null);
  same(await passed(s), 0);
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    revision: item.revision,
    ...scores(8),
  });
  item = await api("/" + item.id + "/mo-lai", fit, 201, command(item));
  same(item.state, "DRAFT");
  same(item.attendanceScore, null);
  same(item.examScore, null);
  same(item.totalScore, null);
  await api("/" + item.id + "/mo-lai", fit, 409, command(item));
  await api("/" + item.id + "/dieu-chinh", fit, 409, {
    ...command(item),
    grade: "A",
    resultStatus: "PASSED",
    passedDate: "2026-01-20",
  });
  await api("/" + item.id + "/cap-nhat", approver, 403, {
    revision: item.revision,
    ...scores(9),
  });
  await api("/" + item.id + "/huy", fbe, 404, command(item));
  // A separate offering is a genuine retake, not an overwritten previous attempt.
  const retake = await offering("COMPLETED"),
    retakeReg = await register(s, retake);
  await api("/lop-hoc/" + retake.id + "/quy-tac", fit, 201, rules());
  let second = await api("", fit, 201, {
    registrationId: retakeReg.id,
    ...scores(8),
  });
  second = await api("/" + second.id + "/chot", fit, 201, command(second));
  same(second.resultStatus, "PASSED");
  same(await passed(s), 1);
  same(second.courseId, item.courseId);
  assert(second.id !== item.id);
  checks++;
  const originalCount = await db.query(
    "SELECT COUNT(*) total FROM student_course_results WHERE student_id=? AND course_id=6",
    [s.id],
  );
  same(Number(originalCount[0].total), 2);
  // Legacy corrections preserve missing components, real statuses and supplied effective dates.
  let legacy = await api("/6", fit);
  same(legacy.state, "LEGACY");
  await api("/6/dieu-chinh", fit, 400, {
    ...command(legacy),
    grade: "A",
    resultStatus: "PASSED",
  });
  await api("/6/dieu-chinh", fit, 400, {
    ...command(legacy),
    grade: "3.5",
    resultStatus: "FAILED",
    passedDate: "2026-01-20",
  });
  await api("/6/dieu-chinh", fit, 400, {
    ...command(legacy),
    grade: "8",
    resultStatus: "INCOMPLETE",
  });
  legacy = await api("/6/dieu-chinh", fit, 201, {
    ...command(legacy),
    grade: "A",
    resultStatus: "PASSED",
    passedDate: "2026-01-20",
  });
  same(legacy.grade, "A");
  same(legacy.resultStatus, "PASSED");
  same(legacy.passedDate, "2026-01-20");
  same(legacy.attendanceScore, null);
  same(legacy.passingScore, null);
  await api("/6/dieu-chinh", fit, 409, {
    revision: 0,
    ...reason,
    grade: "F",
    resultStatus: "FAILED",
  });
  legacy = await api("/6/dieu-chinh", fit, 201, {
    ...command(legacy),
    grade: null,
    resultStatus: "EXEMPTED",
    passedDate: "2026-01-20",
  });
  same(legacy.grade, null);
  same(legacy.resultStatus, "EXEMPTED");
  await api("/6/cap-nhat", fit, 409, {
    revision: legacy.revision,
    ...scores(9),
  });
  const oldSnapshot =
    typeof legacy.history[0].oldValue === "string"
      ? JSON.parse(legacy.history[0].oldValue)
      : legacy.history[0].oldValue;
  same(oldSnapshot.grade, "3.5", "original grade retained in revision history");
  await assert.rejects(
    db.query("UPDATE grade_revisions SET note='rewrite' WHERE result_id=?", [
      item.id,
    ]),
  );
  checks++;
  await assert.rejects(
    db.query("DELETE FROM grade_revisions WHERE result_id=?", [item.id]),
  );
  checks++;
  await assert.rejects(
    db.query("DELETE FROM grade_details WHERE result_id=?", [item.id]),
  );
  checks++;
  // Audit failure rolls the canonical result and detail back atomically.
  const rollbackStudent = await student(),
    rollbackClass = await offering("COMPLETED"),
    rollbackReg = await register(rollbackStudent, rollbackClass);
  await api("/lop-hoc/" + rollbackClass.id + "/quy-tac", fit, 201, rules());
  await db.query(
    "CREATE TRIGGER trg_grade_test_failure BEFORE INSERT ON grade_revisions FOR EACH ROW BEGIN IF NEW.note='forced_grade_test_failure' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='forced test audit failure'; END IF; END",
  );
  try {
    await api("", fit, 409, {
      registrationId: rollbackReg.id,
      ...scores(8),
      note: "forced_grade_test_failure",
    });
  } finally {
    await db.query("DROP TRIGGER trg_grade_test_failure");
  }
  const [rolledBack] = await db.query(
    "SELECT COUNT(*) total FROM student_course_results WHERE student_id=? AND course_offering_id=?",
    [rollbackStudent.id, rollbackClass.id],
  );
  same(
    Number(rolledBack.total),
    0,
    "no half-written result if audit insert fails",
  );
  // Revoked roster/class eligibility is checked again on writes.
  await db.query(
    "UPDATE course_registrations SET status='WITHDRAWN' WHERE id=?",
    [reg.id],
  );
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    revision: item.revision,
    ...scores(8),
  });
  await db.query("DELETE FROM user_scopes WHERE user_id=?", [fit.id]);
  await api("/" + item.id, fit, 404);
  await api("/" + item.id + "/huy", fit, 404, command(item));
  await db.query("DELETE FROM user_roles WHERE user_id=?", [fit2.id]);
  await api("", fit2, 403);
  const filtered = await api("?state=FINALIZED&resultStatus=PASSED", admin);
  same(
    filtered.data.some((r) => r.id === second.id),
    true,
  );
  const search = await api("?searchTerm=" + marker + "&limit=2", admin);
  same(search.data.length, 2);
  same(search.meta.totalPages, Math.ceil(search.meta.total / 2));
  same(
    (await api("?searchTerm=" + marker + "&page=9999", admin)).data.length,
    0,
  );
  same(
    (await api("?resultStatus=EXEMPTED", admin)).data.some((r) => r.id === "3"),
    true,
  );
  // Browser-only users and a fresh class whose rules must be entered via the UI.
  const browserOfficer = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    browserClass = await offering("COMPLETED"),
    browserStudent = await student(),
    browserReg = await register(browserStudent, browserClass);
  require("node:fs").writeFileSync(
    "/tmp/ctdt-grade-browser.json",
    JSON.stringify({
      name: process.env.DB_DATABASE,
      base,
      marker,
      officer: browserOfficer,
      admin,
      fbe,
      approver,
      student: browserStudent,
      offering: browserClass,
      registration: browserReg,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS: " +
      checks +
      " grade HTTP/frontend-proxy/SQL checks on " +
      process.env.DB_DATABASE,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
