/* Run only on a disposable DB clone and a backend connected to that same clone. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.TOPIC_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_topic_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error(
    "Use TOPIC_TEST_ALLOW_WRITES=1 and an isolated DB named ctdt_topic_review_<timestamp>.",
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
const base = process.env.TOPIC_TEST_URL || "http://localhost:3101";
const proxy = process.env.TOPIC_TEST_PROXY !== "0",
  prefix = (proxy ? "/api" : "") + "/de-tai-luan-van";
const marker = "topic_review_" + Date.now();
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
async function newStudent(trackId, unitId = "1") {
  const code = marker + "_s" + ++sequence;
  await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,organizational_unit_id) VALUES(?,?,2026,?)",
    [code, "SQL student " + code, unitId],
  );
  const [s] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM students WHERE student_code=?",
    [code],
  );
  await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id) VALUES(?,?)",
    [s.id, trackId],
  );
  const [a] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
    [s.id],
  );
  return {
    id: s.id,
    assignmentId: a.id,
    studentCode: code,
    studentName: "SQL student " + code,
  };
}
async function defense(route, a, status = 200, body) {
  const r = await fetch(
    base + (proxy ? "/api" : "") + "/bao-ve-luan-van" + route,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: base,
        ...(proxy
          ? { Cookie: "ctdt_access_token=" + a.token }
          : { Authorization: "Bearer " + a.token }),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    },
  );
  const data = await r.json();
  same(
    r.status,
    status,
    "defense " + route + " " + JSON.stringify(data?.message),
  );
  return data;
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
    "one concurrent winner",
  );
  return responses.find((r) => r.status === 201).json();
}
const proposal = (s, h, extra = {}) => ({
  assignmentId: s.assignmentId,
  supervisorId: h.id,
  title: marker + " research " + ++sequence,
  description: "Actual fixture on isolated database",
  ...extra,
});
const decision = (item) => ({
  revision: item.revision,
  note: "Verified actual documents in isolated test",
  reference: "TEST-ONLY-DOC",
});
async function main() {
  await db.initialize();
  const admin = await actor("ADMIN", [["GLOBAL"]]),
    fit = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    fit2 = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    fbe = await actor("TRAINING_OFFICER", [["ORG_UNIT", "2"]]),
    approver = await actor("APPROVER", [["ORG_UNIT", "1"]]),
    reviewer2 = await actor("APPROVER", [["ORG_UNIT", "1"]]),
    none = await actor("TRAINING_OFFICER", []),
    major = await actor("TRAINING_OFFICER", [["MAJOR", "1"]]),
    learner = await actor("STUDENT", [["GLOBAL"]]);
  // The unique session exists only on this clone. Probe before making HTTP mutations.
  const list = await api("", admin);
  same(list.permissions, {
    canManage: false,
    canApprove: false,
    canComplete: false,
  });
  await api("", null, 401);
  await api("", learner, 403);
  await api("", { token: "invalid" }, 401);
  await api("", fit, 403, {}, { Origin: "https://invalid.example" });
  await api("", admin, 403, {});
  await api("", approver, 403, {});
  same((await api("/don-vi", fit)).map((u) => u.id).sort(), ["1", "3"]);
  same((await api("/don-vi", none)).length, 0);
  const hInput = {
    unitId: "1",
    code: marker + "_gv",
    fullName: "Actual supervisor SQL",
    institution: "Actual institution",
    qualification: "",
    email: "test@example.invalid",
  };
  const h = await api("/giang-vien", fit, 201, hInput);
  const foreign = await api("/giang-vien", fbe, 201, {
    ...hInput,
    unitId: "2",
  });
  same(
    (await api("/giang-vien?searchTerm=" + marker, fit)).data.map((x) => x.id),
    [h.id],
  );
  same(
    (await api("/giang-vien?searchTerm=" + marker, fbe)).data.map((x) => x.id),
    [foreign.id],
  );
  await api("/giang-vien", fit, 409, {
    ...hInput,
    code: hInput.code.toLowerCase(),
  });
  await api("/giang-vien", fit, 403, { ...hInput, unitId: "2" });
  await api("/giang-vien", none, 403, { ...hInput, code: marker + "_no" });
  await api("/giang-vien", admin, 403, hInput);
  for (const bad of [
    { fullName: " " },
    { unitId: 1 },
    { code: " " },
    { email: "bad-address" },
  ])
    await api("/giang-vien", fit, 400, { ...hInput, ...bad });
  for (const q of [
    "?page=0",
    "?limit=101",
    "?page=1.5",
    "?selectedStatus=INVALID",
  ])
    await api(q, fit, 400);
  await api("/0", fit, proxy ? 404 : 400);
  await api("/18446744073709551616", fit, 400);
  const [track] = await db.query(
    "SELECT CAST(t.id AS CHAR) id FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE v.status='PUBLISHED' AND p.managing_unit_id=1 AND p.education_level_id IN (SELECT education_level_id FROM thesis_defense_levels) AND t.status='ACTIVE' LIMIT 1",
  );
  const [archived] = await db.query(
    "SELECT CAST(t.id AS CHAR) id FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id WHERE v.status='ARCHIVED' LIMIT 1",
  );
  const s = await newStudent(track.id),
    body = proposal(s, h);
  const choices = await api("/hoc-vien?searchTerm=" + s.studentCode, fit);
  same(choices.meta.total, 1);
  same(choices.data[0].studentName, s.studentName);
  same((await api("/hoc-vien?searchTerm=" + s.studentCode, fbe)).meta.total, 0);
  same((await api("/hoc-vien", major)).meta.total, 0);
  for (const bad of [
    { title: " " },
    { assignmentId: "0" },
    { supervisorId: "x" },
    { title: "x".repeat(1001) },
  ])
    await api("", fit, 400, { ...body, ...bad });
  await api("", fbe, 404, body);
  await api("", none, 404, body);
  await api("", fit, 404, { ...body, supervisorId: foreign.id });
  let item = await race("", [fit, fit2], {
    ...body,
    studentName: "Spoof",
    programName: "Spoof",
    status: "HOAN_THANH",
  });
  same(item.status, "CHO_DUYET");
  same(item.studentName, s.studentName);
  same(item.supervisorName, h.fullName);
  same((await api("/hoc-vien?searchTerm=" + s.studentCode, fit)).meta.total, 0);
  await api("", fit, 409, body);
  await api("/" + item.id, fbe, 404);
  await api("/" + item.id, major, 404);
  await api("/" + item.id + "/duyet", fit, 403, decision(item));
  await api("/" + item.id + "/duyet", admin, 403, decision(item));
  await api("/" + item.id + "/duyet", fbe, 403, decision(item));
  await api("/" + item.id + "/duyet", approver, 400, {
    ...decision(item),
    reference: " ",
  });
  await api("/" + item.id + "/tu-choi", approver, 400, {
    revision: item.revision,
    note: "short",
  });
  // Temporarily grant the submitting officer approval: self-review is still forbidden.
  const creator = item.createdBy;
  await db.query(
    "INSERT IGNORE INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='APPROVER'",
    [creator],
  );
  const creatorActor = creator === fit.id ? fit : fit2;
  await api("/" + item.id + "/duyet", creatorActor, 403, decision(item));
  await db.query(
    "DELETE ur FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.role_code='APPROVER'",
    [creator],
  );
  const rejected = await api("/" + item.id + "/tu-choi", approver, 201, {
    revision: item.revision,
    note: "Please correct the actual research proposal",
  });
  same(rejected.status, "TU_CHOI");
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    supervisorId: h.id,
    title: "updated",
    revision: item.revision,
  });
  item = await api("/" + item.id + "/cap-nhat", fit, 201, {
    supervisorId: h.id,
    title: marker + " revised",
    description: "Revised actual proposal",
    revision: rejected.revision,
  });
  same(item.status, "CHO_DUYET");
  same(item.reviewedBy, null);
  same(item.history.length, 3);
  await api("/giang-vien/" + h.id + "/trang-thai", fit, 201, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  await api("/" + item.id + "/duyet", approver, 404, decision(item));
  await api("/giang-vien/" + h.id + "/trang-thai", fit, 409, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  await api("/giang-vien/" + h.id + "/trang-thai", fbe, 404, {
    status: "ACTIVE",
    expectedStatus: "INACTIVE",
  });
  await api("/giang-vien/" + h.id + "/trang-thai", fit, 201, {
    status: "ACTIVE",
    expectedStatus: "INACTIVE",
  });
  item = await race(
    "/" + item.id + "/duyet",
    [approver, reviewer2],
    decision(item),
  );
  same(item.status, "DANG_THUC_HIEN");
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    supervisorId: h.id,
    title: "cannot rewrite approved title",
    revision: item.revision,
  });
  await api("/" + item.id + "/nghiem-thu", fit, 403, decision(item));
  await api("/" + item.id + "/nghiem-thu", approver, 409, decision(item));
  const noTopic = await newStudent(track.id);
  const policy = await defense("/policy", fit);
  const defenseInput = (student) => ({
    maHocVien: student.studentCode,
    assignmentId: student.assignmentId,
    tenDeTai: "Forged client title ignored",
    ngayBaoVe: policy.today,
    diaDiem: "Actual test room",
    chuTichHoidong: "Actual Chair",
    phanBien: "Actual Reviewer",
    thuKy: "Actual Secretary",
    eligibilityConfirmed: true,
    eligibilityNote: "Reviewed actual evidence on isolated test",
    diemDat: policy.passingScore ?? 6.5,
  });
  await defense("", fit, 409, defenseInput(noTopic));
  const ready = await defense("/hoc-vien?searchTerm=" + s.studentCode, fit);
  same(ready.data[0].topicTitle, item.title);
  let scheduled = await defense("", fit, 201, defenseInput(s));
  same(scheduled.tenDeTai, item.title);
  same(scheduled.topicId, item.id);
  await api("/" + item.id + "/huy", fit, 409, {
    revision: item.revision,
    note: "Cancel should be blocked by pending defense",
  });
  await api("/" + item.id + "/nghiem-thu", approver, 409, decision(item));
  await defense("/" + scheduled.id + "/ket-qua", approver, 201, {
    diemTrungBinh: 0,
  });
  await api("/" + item.id + "/nghiem-thu", approver, 409, decision(item));
  scheduled = await defense("", fit, 201, defenseInput(s));
  await defense("/" + scheduled.id + "/ket-qua", approver, 201, {
    diemTrungBinh: defenseInput(s).diemDat,
  });
  await api("/" + item.id + "/huy", fit, 409, {
    revision: item.revision,
    note: "Cancel should be blocked by passed defense",
  });
  const finished = await api(
    "/" + item.id + "/nghiem-thu",
    approver,
    201,
    decision(item),
  );
  same(finished.status, "HOAN_THANH");
  same(finished.defenses.length, 2);
  same(finished.defenses[1].score, 0);
  await api("/" + item.id + "/nghiem-thu", approver, 409, decision(finished));
  await api("/" + item.id + "/cap-nhat", fit, 409, {
    supervisorId: h.id,
    title: "final immutable",
    revision: finished.revision,
  });
  await assert.rejects(
    db.query("DELETE FROM thesis_topics WHERE id=?", [item.id]),
  );
  checks++;
  await assert.rejects(
    db.query("UPDATE thesis_topics SET title='changed' WHERE id=?", [item.id]),
  );
  checks++;
  // Historical enrollment in an archived published version remains eligible.
  const historical = await newStudent(archived.id);
  const oldTopic = await api("", fit, 201, proposal(historical, h));
  same(oldTopic.assignmentId, historical.assignmentId);
  const cancelled = await api("/" + oldTopic.id + "/huy", fit, 201, {
    revision: oldTopic.revision,
    note: "Cancelled after checking actual documents",
  });
  same(cancelled.status, "DA_HUY");
  const recreated = await api("", fit, 201, proposal(historical, h));
  same(recreated.assignmentId, cancelled.assignmentId);
  await db.query(
    "UPDATE student_program_assignments SET assignment_status='ENDED',ended_at=UTC_TIMESTAMP(6) WHERE id=?",
    [historical.assignmentId],
  );
  await api("/" + recreated.id + "/duyet", approver, 404, decision(recreated));
  await api("/" + recreated.id + "/huy", fit, 201, {
    revision: recreated.revision,
    note: "Assignment ended, retain cancelled topic history",
  });
  // Read/write scope and role changes take effect with the same token.
  const pending = await api("", fit, 201, proposal(noTopic, h));
  await db.query("DELETE FROM user_scopes WHERE user_id=?", [fit.id]);
  await api("/" + pending.id, fit, 404);
  await api("/" + pending.id + "/huy", fit, 404, {
    revision: pending.revision,
    note: "should not cancel off scope",
  });
  await db.query("DELETE FROM user_roles WHERE user_id=?", [fit2.id]);
  await api("", fit2, 403);
  const found = await api(
    "?searchTerm=" + marker + "&selectedStatus=HOAN_THANH",
    admin,
  );
  same(
    found.data.some((x) => x.id === finished.id),
    true,
  );
  const [count] = await db.query(
    "SELECT COUNT(*) total FROM thesis_topics WHERE title LIKE ?",
    [marker + "%"],
  );
  same(
    (await api("?searchTerm=" + marker, admin)).meta.total,
    Number(count.total),
  );
  same(
    (await api("?searchTerm=" + marker + "&page=9999", admin)).data.length,
    0,
  );
  // Fresh browser-only users and untouched fixture for manual UI actions in the isolated browser test.
  const browserOfficer = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    browserReviewer = await actor("APPROVER", [["ORG_UNIT", "1"]]);
  const browserStudent = await newStudent(track.id);
  require("node:fs").writeFileSync(
    "/tmp/ctdt-topic-browser.json",
    JSON.stringify({
      name: process.env.DB_DATABASE,
      base,
      officer: browserOfficer,
      reviewer: browserReviewer,
      admin,
      fbe,
      student: browserStudent,
      supervisor: h,
      marker,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS: " +
      checks +
      " topic/frontend proxy/defense SQL integration checks on " +
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
