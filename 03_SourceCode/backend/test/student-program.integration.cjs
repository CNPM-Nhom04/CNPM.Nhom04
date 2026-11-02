/* These identity/assignment checks may mutate ONLY a disposable SQL clone. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_major_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error("Disposable clone required");
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
const base = process.env.MAJOR_TEST_URL || "http://localhost:3101",
  prefix = "/api/sinh-vien/chuong-trinh-dao-tao",
  mark = "own_" + Date.now();
let checks = 0,
  seq = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function request(
  url,
  actor,
  expected = 200,
  body,
  method = body === undefined ? "GET" : "POST",
  direct = false,
) {
  const response = await fetch(
    (direct ? "http://127.0.0.1:3102" : base) + url,
    {
      method,
      headers: {
        Origin: base,
        ...(actor
          ? direct
            ? { Authorization: "Bearer " + actor.token }
            : { Cookie: actor.cookie }
          : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    },
  );
  const data = await response.json().catch(() => null);
  eq(response.status, expected, url + " " + JSON.stringify(data));
  return { data, response };
}
async function account(role) {
  const username = mark + "_" + ++seq,
    password = "OwnProgram123!";
  const result = await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử " + role,
      await bcrypt.hash(password, 4),
    ],
  );
  const id = String(result.insertId);
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [id, role],
  );
  // Global scope deliberately must NOT let a student read another student's curriculum.
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type) VALUES(?,'GLOBAL')",
    [id],
  );
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, id],
  );
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: id, jti: sid },
    { expiresIn: "30m" },
  );
  return {
    id,
    username,
    password,
    sid,
    token,
    cookie: "ctdt_access_token=" + token,
  };
}
async function own(actor) {
  return (await request(prefix, actor)).data;
}
async function run() {
  await db.initialize();
  const admin = await account("ADMIN"),
    officer = await account("TRAINING_OFFICER"),
    a = await account("STUDENT"),
    b = await account("STUDENT"),
    c = await account("STUDENT"),
    unlinked = await account("STUDENT"),
    unassigned = await account("STUDENT");
  await db.query("UPDATE students SET user_id=? WHERE student_code=?", [
    a.id,
    "SV001",
  ]);
  await db.query("UPDATE students SET user_id=? WHERE student_code=?", [
    b.id,
    "SV002",
  ]);
  await db.query("UPDATE students SET user_id=? WHERE student_code=?", [
    c.id,
    "SV003",
  ]);
  await request(prefix, null, 401);
  await request(prefix, admin, 403);
  await request(prefix, officer, 403);
  await request(prefix + "?userId=" + b.id, a, 400);
  await request(prefix + "?studentId=2", a, 400);
  await request(prefix + "?assignmentId=2", a, 400);
  await request(
    "/sinh-vien/chuong-trinh-dao-tao?userId=" + b.id,
    a,
    400,
    undefined,
    "GET",
    true,
  );
  await request(prefix + "/2", a, 404);
  await request(prefix, a, 405, {});
  const first = await own(a),
    second = await own(b),
    third = await own(c);
  eq(first.student.studentCode, "SV001");
  eq(second.student.studentCode, "SV002");
  eq(third.student.studentCode, "SV003");
  eq(first.curriculum.versionCode, "MIT-2024-v1");
  eq(first.curriculum.versionStatus, "ARCHIVED");
  eq(first.curriculum.trackCode, "RESEARCH");
  eq(second.curriculum.versionCode, "MIT-2025-v1");
  eq(second.curriculum.trackCode, "APPLICATION");
  eq(third.curriculum.assignmentId, "4");
  eq(
    third.curriculum.trackCode,
    "RESEARCH",
    "ENDED application assignment must not win",
  );
  for (const [actor, data] of [
    [a, first],
    [b, second],
    [c, third],
  ]) {
    eq(data.state, "READY");
    eq(Object.hasOwn(data.curriculum, "assignedBy"), false);
    eq(Object.hasOwn(data.curriculum, "requestedBy"), false);
    const sql = await db.query(
      "SELECT CAST(curriculum_course_id AS CHAR) id,CAST(course_version_id AS CHAR) versionId,course_code code,course_name name,credits,requirement_type requirementType FROM vw_student_curriculum WHERE user_id=? ORDER BY curriculum_course_id",
      [actor.id],
    );
    eq(
      data.curriculum.courses
        .map((x) => [
          x.id,
          x.courseVersionId,
          x.code,
          x.name,
          x.credits,
          x.requirementType,
        ])
        .sort(),
      sql
        .map((x) => [
          x.id,
          x.versionId,
          x.code,
          x.name,
          Number(x.credits),
          x.requirementType,
        ])
        .sort(),
    );
    const [quota] = await db.query(
      "SELECT required_total_credits credits FROM program_version_tracks WHERE id=?",
      [data.curriculum.trackId],
    );
    eq(data.curriculum.requiredCredits, Number(quota.credits));
    const groups = await db.query(
      "SELECT CAST(id AS CHAR) id,group_code code,minimum_credits credits,maximum_credits max FROM curriculum_groups WHERE program_version_track_id=? ORDER BY display_order,id",
      [data.curriculum.trackId],
    );
    eq(
      data.curriculum.groups.map((g) => [
        g.id,
        g.code,
        g.minimumCredits,
        g.maximumCredits,
      ]),
      groups.map((g) => [
        g.id,
        g.code,
        Number(g.credits),
        g.max == null ? null : Number(g.max),
      ]),
    );
    const pre = await db.query(
      "SELECT CAST(cp.curriculum_course_id AS CHAR) ownerId,CAST(cp.prerequisite_curriculum_course_id AS CHAR) preId,cp.minimum_grade grade FROM curriculum_prerequisites cp JOIN curriculum_courses cc ON cc.id=cp.curriculum_course_id WHERE cc.program_version_track_id=? ORDER BY cp.id",
      [data.curriculum.trackId],
    );
    eq(
      data.curriculum.courses
        .flatMap((x) =>
          x.prerequisites.map((p) => [x.id, p.courseEntryId, p.minimumGrade]),
        )
        .sort(),
      pre.map((p) => [p.ownerId, p.preId, p.grade]).sort(),
    );
  }
  const cache = (await request(prefix, a)).response.headers.get(
    "cache-control",
  );
  eq(cache.includes("private") && cache.includes("no-store"), true);
  eq((await own(b)).student.studentCode, "SV002");
  eq(
    (await own(a)).student.studentCode,
    "SV001",
    "no cross-user cached response",
  );
  eq((await own(unlinked)).state, "UNLINKED");
  await db.query("UPDATE students SET student_code=? WHERE id=1", [
    unlinked.username,
  ]);
  try {
    eq(
      (await own(unlinked)).state,
      "UNLINKED",
      "never infer identity from username matching studentCode",
    );
  } finally {
    await db.query("UPDATE students SET student_code='SV001' WHERE id=1");
  }
  await db.query(
    "INSERT INTO students(user_id,student_code,full_name,admission_year,status) VALUES(?,?,?,2026,'ACTIVE')",
    [unassigned.id, mark + "_EMPTY", "Học viên chưa gán"],
  );
  eq((await own(unassigned)).state, "UNASSIGNED");
  const [emptyStudent] = await db.query(
    "SELECT id FROM students WHERE user_id=?",
    [unassigned.id],
  );
  const [draftTrack] = await db.query(
    "SELECT t.id FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id WHERE v.status='DRAFT' LIMIT 1",
  );
  assert(draftTrack);
  const inserted = await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status) VALUES(?,?,'ACTIVE')",
    [emptyStudent.id, draftTrack.id],
  );
  const unavailable = await own(unassigned);
  eq(unavailable.state, "UNAVAILABLE");
  eq(unavailable.curriculum, null, "draft curriculum must not be exposed");
  await db.query("DELETE FROM student_program_assignments WHERE id=?", [
    inserted.insertId,
  ]);
  // Latest course versions do not replace snapshots used in the student's curriculum.
  const original = third.curriculum.courses[0],
    cv = (
      await db.query(
        "SELECT CAST(course_id AS CHAR) courseId FROM course_versions WHERE id=?",
        [original.courseVersionId],
      )
    )[0];
  const course = (
    await request("/api/danh-muc-hoc-phan/" + cv.courseId, officer)
  ).data;
  await request(
    "/api/danh-muc-hoc-phan/" + cv.courseId + "/phien-ban",
    officer,
    201,
    {
      expectedLatestVersionId: course.latestVersionId,
      courseName: "LATEST MUST NOT REPLACE",
      credits: 99,
      theoryHours: 0,
      practiceHours: 0,
      effectiveFrom: "2026-01-01",
    },
  );
  const after = (await own(c)).curriculum.courses.find(
    (x) => x.id === original.id,
  );
  eq(
    [after.courseVersionId, after.name, after.credits],
    [original.courseVersionId, original.name, original.credits],
  );
  // Live role/account/session changes take effect on every request.
  const studentRole = (
    await db.query("SELECT id FROM roles WHERE role_code='STUDENT'")
  )[0].id;
  await db.query("DELETE FROM user_roles WHERE user_id=? AND role_id=?", [
    a.id,
    studentRole,
  ]);
  await request(prefix, a, 403);
  await db.query("INSERT INTO user_roles(user_id,role_id) VALUES(?,?)", [
    a.id,
    studentRole,
  ]);
  await db.query("UPDATE users SET account_status='DISABLED' WHERE id=?", [
    a.id,
  ]);
  await request(prefix, a, 401);
  await db.query("UPDATE users SET account_status='ACTIVE' WHERE id=?", [a.id]);
  await db.query("UPDATE users SET must_change_password=1 WHERE id=?", [b.id]);
  await request(prefix, b, 403);
  await db.query("UPDATE users SET must_change_password=0 WHERE id=?", [b.id]);
  await db.query(
    "UPDATE auth_sessions SET expires_at=TIMESTAMPADD(MINUTE,-1,UTC_TIMESTAMP(6)) WHERE id=?",
    [a.sid],
  );
  await request(prefix, a, 401);
  const old = (
    await db.query(
      "SELECT ended_at FROM student_program_assignments WHERE id=3",
    )
  )[0].ended_at;
  await db.query(
    "UPDATE student_program_assignments SET assignment_status='ENDED',ended_at=UTC_TIMESTAMP(6) WHERE id=4",
  );
  await db.query(
    "UPDATE student_program_assignments SET assignment_status='ACTIVE',ended_at=NULL WHERE id=3",
  );
  try {
    eq(
      (await own(c)).curriculum.trackCode,
      "APPLICATION",
      "reload honors current SQL assignment",
    );
  } finally {
    await db.query(
      "UPDATE student_program_assignments SET assignment_status='ENDED',ended_at=? WHERE id=3",
      [old],
    );
    await db.query(
      "UPDATE student_program_assignments SET assignment_status='ACTIVE',ended_at=NULL WHERE id=4",
    );
  }
  const fixture = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "own.json",
  );
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      a,
      b,
      c,
      unlinked,
      unassigned,
      admin,
      officer,
    }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ result: "PASS", checks, fixture }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
