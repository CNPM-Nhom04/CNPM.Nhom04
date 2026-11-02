/* Writes are restricted to a disposable clone; never run against a working database. */
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
  throw Error("Disposable SQL clone required");
const { DataSource } = require("typeorm"),
  { JwtService } = require("@nestjs/jwt"),
  bcrypt = require("bcryptjs"),
  { Workbook } = require("exceljs");
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
  api = "/api/admin/lop-hoc-vien",
  mark = "link_" + Date.now();
let checks = 0,
  seq = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function req(
  url,
  actor,
  status = 200,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  const form = body instanceof FormData,
    r = await fetch(base + url, {
      method,
      redirect: "manual",
      headers: {
        Origin: base,
        ...(actor ? { Cookie: actor.cookie } : {}),
        ...(!form && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  const bytes = Buffer.from(await r.arrayBuffer());
  let data;
  try {
    data = JSON.parse(bytes.toString());
  } catch {
    data = null;
  }
  eq(r.status, status, url + " " + (data ? JSON.stringify(data) : r.status));
  return { r, data, bytes };
}
async function actor(role) {
  const username = mark + "_" + ++seq,
    password = "CloneAccount123!";
  const u = await db.query(
      "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
      [
        username,
        username + "@example.invalid",
        "Kiểm thử " + role,
        await bcrypt.hash(password, 4),
      ],
    ),
    id = String(u.insertId);
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [id, role],
  );
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
  return { id, username, password, cookie: "ctdt_access_token=" + token };
}

async function count(sql, params = []) {
  return Number((await db.query(sql, params))[0].n);
}
async function run() {
  await db.initialize();
  const admin = await actor("ADMIN"),
    officer = await actor("TRAINING_OFFICER");
  const options = (await req(api + "/options", admin)).data;
  const track = options.tracks.find(
    (t) => t.versionCode === "MIT-2025-v1" && t.trackCode === "RESEARCH",
  );
  assert(track);
  const c = (
    await req(api, admin, 201, {
      code: mark + "_CLASS",
      name: "Lớp liên kết thử",
      trackId: track.id,
      admissionYear: 2025,
    })
  ).data;
  const url = api + "/" + c.id + "/lien-ket",
    accountsUrl = url + "/tai-khoan",
    profilesUrl = url + "/ho-so";
  const student = async () => {
    const a = await actor("STUDENT");
    await db.query("DELETE FROM user_scopes WHERE user_id=?", [a.id]);
    return a;
  };
  const a = await student();
  const snapshot = async (id) =>
    JSON.stringify({
      user: (
        await db.query(
          "SELECT username,email,password_hash,must_change_password,account_status FROM users WHERE id=?",
          [id],
        )
      )[0],
      roles: await db.query(
        "SELECT role_id FROM user_roles WHERE user_id=? ORDER BY role_id",
        [id],
      ),
      scopes: await db.query(
        "SELECT * FROM user_scopes WHERE user_id=? ORDER BY id",
        [id],
      ),
    });
  const original = await snapshot(a.id);
  eq(
    (await req("/api/sinh-vien/chuong-trinh-dao-tao", a)).data.state,
    "UNLINKED",
  );
  await req(accountsUrl, null, 401);
  await req(accountsUrl, officer, 403);
  await req(profilesUrl, a, 403);
  await req(url, a, 403, {});
  await req(url, officer, 403, {});
  const candidates = (
    await req(accountsUrl + "?searchTerm=" + a.username, admin)
  ).data;
  eq(candidates.meta.total, 1);
  eq(candidates.data[0].studentId, null);
  eq(
    (await req(accountsUrl + "?searchTerm=" + officer.username, admin)).data
      .meta.total,
    0,
  );
  const body = {
    userId: a.id,
    studentCode: mark + "_NEW",
    revision: c.revision,
    confirmed: true,
    reason: "TEST: xác minh tài khoản và danh sách lớp",
  };
  await req(url, admin, 400, { ...body, confirmed: false });
  await req(url, admin, 400, { ...body, reason: " " });
  await req(url, admin, 400, { ...body, studentId: "1" });
  await req(url, admin, 409, { ...body, revision: 99 });
  await req(url, admin, 400, { ...body, studentCode: undefined });
  const created = (await req(url, admin, 201, body)).data;
  eq(
    await snapshot(a.id),
    original,
    "link must preserve password, username, email, role, scopes",
  );
  const sid = created.studentId;
  const [profile] = await db.query("SELECT * FROM students WHERE id=?", [sid]);
  eq(profile.student_code, body.studentCode);
  eq(profile.full_name, "Kiểm thử STUDENT");
  eq(Number(profile.admission_year), 2025);
  eq(String(profile.organizational_unit_id), track.unitId);
  eq(String(profile.user_id), a.id);
  const [assignment] = await db.query(
    "SELECT * FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
    [sid],
  );
  eq(String(assignment.program_version_track_id), track.id);
  eq(
    await count(
      "SELECT COUNT(*) n FROM student_class_memberships WHERE student_id=? AND class_id=?",
      [sid, c.id],
    ),
    1,
  );
  const own = (await req("/api/sinh-vien/chuong-trinh-dao-tao", a)).data;
  eq(own.state, "READY");
  eq(own.student.studentCode, body.studentCode);
  eq(own.curriculum.trackId, track.id);
  await req(url, admin, 409, {
    ...body,
    studentCode: undefined,
    studentId: sid,
  });
  // Explicitly verified existing identity: preserve source profile name and assignment.
  const b = await student();
  const p = await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,status) VALUES(?,?,2025,'ACTIVE')",
    [mark + "_EXIST", "Học viên hồ sơ gốc"],
  );
  const pid = String(p.insertId);
  const ar = await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status) VALUES(?,?,'ACTIVE')",
    [pid, track.id],
  );
  const result = (
    await req(profilesUrl + "?searchTerm=" + mark + "_EXIST", admin)
  ).data;
  eq(result.meta.total, 1);
  const beforeB = await snapshot(b.id);
  await req(url, admin, 201, {
    ...body,
    userId: b.id,
    studentCode: undefined,
    studentId: pid,
  });
  eq(await snapshot(b.id), beforeB);
  eq(
    (await db.query("SELECT full_name FROM students WHERE id=?", [pid]))[0]
      .full_name,
    "Học viên hồ sơ gốc",
  );
  eq(
    (
      await db.query(
        "SELECT CAST(id AS CHAR) id FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
        [pid],
      )
    )[0].id,
    String(ar.insertId),
  );
  eq(
    (await req(profilesUrl + "?searchTerm=" + mark + "_EXIST", admin)).data.meta
      .total,
    0,
  );
  eq(
    (await req(accountsUrl + "?searchTerm=" + b.username, admin)).data.meta
      .total,
    0,
  );
  const d = await student();
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: undefined,
    studentId: pid,
  });
  await db.query("UPDATE users SET organizational_unit_id=2 WHERE id=?", [
    d.id,
  ]);
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: mark + "_FOREIGN",
  });
  await db.query("UPDATE users SET organizational_unit_id=NULL WHERE id=?", [
    d.id,
  ]);
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: body.studentCode,
  });
  const wrong = await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,status,organizational_unit_id) VALUES(?,?,2026,'ACTIVE',1)",
    [mark + "_WRONG", "Sai khóa"],
  );
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: undefined,
    studentId: String(wrong.insertId),
  });
  await db.query(
    "UPDATE students SET admission_year=2025,organizational_unit_id=2 WHERE id=?",
    [wrong.insertId],
  );
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: undefined,
    studentId: String(wrong.insertId),
  });
  await db.query("UPDATE students SET organizational_unit_id=1 WHERE id=?", [
    wrong.insertId,
  ]);
  const other = options.tracks.find(
    (t) => t.versionCode === track.versionCode && t.trackCode === "APPLICATION",
  );
  await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status) VALUES(?,?,'ACTIVE')",
    [wrong.insertId, other.id],
  );
  await req(url, admin, 409, {
    ...body,
    userId: d.id,
    studentCode: undefined,
    studentId: String(wrong.insertId),
  });
  eq(
    (await req(profilesUrl + "?searchTerm=" + mark + "_WRONG", admin)).data.meta
      .total,
    0,
  );
  // A student already linked to a profile can join the matching class without replacing identity.
  const e = await student();
  const ep = await db.query(
    "INSERT INTO students(user_id,student_code,full_name,admission_year,status,organizational_unit_id) VALUES(?,?,?,2025,'ACTIVE',1)",
    [e.id, mark + "_PRELINK", "Đã có hồ sơ"],
  );
  const epid = String(ep.insertId);
  await req(url, admin, 409, {
    ...body,
    userId: e.id,
    studentCode: undefined,
    studentId: pid,
  });
  await req(url, admin, 201, {
    ...body,
    userId: e.id,
    studentCode: undefined,
    studentId: epid,
  });
  eq(
    (await req("/api/sinh-vien/chuong-trinh-dao-tao", e)).data.student
      .studentCode,
    mark + "_PRELINK",
  );
  // Mixed staff/student role is not eligible for this administrative student-only workflow.
  const mixed = await student();
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='LECTURER'",
    [mixed.id],
  );
  await req(url, admin, 409, {
    ...body,
    userId: mixed.id,
    studentCode: mark + "_MIXED",
  });
  eq(
    (await req(accountsUrl + "?searchTerm=" + mixed.username, admin)).data.meta
      .total,
    0,
  );
  // If audit fails, every newly created profile, assignment, member and unit update rolls back.
  const rb = await student(),
    rbCode = mark + "_ROLLBACK";
  await db.query(
    `CREATE TRIGGER account_link_rollback BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='LINK_STUDENT_ACCOUNT' AND JSON_UNQUOTE(JSON_EXTRACT(NEW.new_value,'$.userId'))='${rb.id}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='clone rollback check'; END IF; END`,
  );
  try {
    await req(url, admin, 502, { ...body, userId: rb.id, studentCode: rbCode });
  } finally {
    await db.query("DROP TRIGGER account_link_rollback");
  }
  eq(
    await count("SELECT COUNT(*) n FROM students WHERE student_code=?", [
      rbCode,
    ]),
    0,
  );
  eq(
    (
      await db.query(
        "SELECT organizational_unit_id unitId FROM users WHERE id=?",
        [rb.id],
      )
    )[0].unitId,
    null,
  );
  const inactive = (
    await req(
      api + "/" + c.id,
      admin,
      200,
      { name: c.name, status: "INACTIVE", revision: c.revision },
      "PUT",
    )
  ).data;
  await req(url, admin, 409, {
    ...body,
    userId: rb.id,
    studentCode: rbCode,
    revision: inactive.revision,
  });
  const live = (
    await req(api, admin, 201, {
      code: mark + "_LIVE",
      name: "Lớp kiểm thử liên kết trên giao diện",
      trackId: track.id,
      admissionYear: 2025,
    })
  ).data;
  const ui = await student(),
    uiNew = await student();
  const uiProfile = await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,status) VALUES(?,?,2025,'ACTIVE')",
    [mark + "_UI", "Hồ sơ đã xác minh"],
  );
  // Preserve current security settings and force-change flag during linkage.
  await db.query("UPDATE users SET must_change_password=1 WHERE id=?", [
    uiNew.id,
  ]);
  const fixture = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "link.json",
  );
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      mark,
      admin,
      officer,
      a,
      ui,
      uiNew,
      uiProfileId: String(uiProfile.insertId),
      live,
    }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ result: "PASS", checks }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
