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
  mark = "acc_" + Date.now();
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
async function file(rows) {
  const b = new Workbook(),
    s = b.addWorksheet("Hoc vien");
  s.addRow(["Mã học viên", "Họ và tên", "Email", "Tên đăng nhập"]);
  rows.forEach((r) => s.addRow(r));
  return Buffer.from(await b.xlsx.writeBuffer());
}
function form(bytes, preview, filename = "hoc-vien.xlsx") {
  const f = new FormData();
  f.append("file", new Blob([bytes]), filename);
  if (preview) {
    f.append("previewHash", preview.previewHash);
    f.append("classRevision", String(preview.classRevision));
  }
  return f;
}
async function preview(c, bytes, a, status = 201) {
  return (
    await req(api + "/" + c.id + "/import/kiem-tra", a, status, form(bytes))
  ).data;
}
async function count(sql, params = []) {
  return Number((await db.query(sql, params))[0].n);
}
async function run() {
  await db.initialize();
  const admin = await actor("ADMIN"),
    officer = await actor("TRAINING_OFFICER"),
    student = await actor("STUDENT");
  await req(api, null, 401);
  await req(api, officer, 403);
  await req(api, student, 403);
  const options = (await req(api + "/options", admin)).data;
  eq(options.limits.maxRows <= 200, true);
  eq(
    options.tracks.every((t) =>
      ["PUBLISHED", "ARCHIVED"].includes(t.versionStatus),
    ),
    true,
  );
  const track = options.tracks.find(
    (t) => t.versionCode === "MIT-2025-v1" && t.trackCode === "RESEARCH",
  );
  assert(track);
  const create = async (suffix) =>
    (
      await req(api, admin, 201, {
        code: mark + suffix,
        name: "Lớp kiểm thử " + suffix,
        trackId: track.id,
        admissionYear: 2025,
      })
    ).data;
  const c = await create("_CLASS");
  eq(c.trackId, track.id);
  eq(c.unitId, track.unitId);
  await req(api, admin, 409, {
    code: c.code,
    name: "Trùng",
    trackId: track.id,
    admissionYear: 2025,
  });
  const [draft] = await db.query(
    "SELECT t.id FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id WHERE v.status='DRAFT' LIMIT 1",
  );
  assert(draft);
  await req(api, admin, 409, {
    code: mark + "_DRAFT",
    name: "Không nhận bản nháp",
    trackId: String(draft.id),
    admissionYear: 2025,
  });
  const template = await req(api + "/" + c.id + "/import/mau-excel", admin);
  const tb = new Workbook();
  await tb.xlsx.load(template.bytes);
  eq(tb.getWorksheet("Hoc vien").getRow(1).values.slice(1), [
    "Mã học viên",
    "Họ và tên",
    "Email",
    "Tên đăng nhập",
  ]);
  eq(tb.getWorksheet("Hoc vien").rowCount, 1);
  const newCode = mark + "_NEW",
    linkCode = mark + "_LINK";
  const link = await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,status) VALUES(?,?,2025,'ACTIVE')",
    [linkCode, "Học viên liên kết"],
  );
  const linkId = String(link.insertId);
  const assignment = await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status) VALUES(?,?,'ACTIVE')",
    [linkId, track.id],
  );
  const rows = [
    [newCode, "Học viên tạo mới", mark + "_new@example.invalid", ""],
    [linkCode, "Học viên liên kết", mark + "_link@example.invalid", ""],
  ];
  const bytes = await file(rows);
  const before = await count("SELECT COUNT(*) n FROM users");
  const p = await preview(c, bytes, admin);
  eq(p.canImport, true);
  eq(
    p.rows.map((r) => r.mode),
    ["CREATE_PROFILE", "LINK_PROFILE"],
  );
  eq(
    await count("SELECT COUNT(*) n FROM users"),
    before,
    "preview has no writes",
  );
  const duplicate = await preview(c, await file([rows[0], rows[0]]), admin);
  eq(duplicate.canImport, false);
  eq(duplicate.errorRows, 2);
  const formula = await preview(
    c,
    await file([
      [mark + "_FORM", { formula: "1+1" }, mark + "_form@example.invalid", ""],
    ]),
    admin,
  );
  eq(formula.canImport, false);
  await req(
    api + "/" + c.id + "/import/kiem-tra",
    admin,
    400,
    form(Buffer.from("bad")),
  );
  await req(
    api + "/" + c.id + "/import/kiem-tra",
    admin,
    400,
    form(bytes, null, "old.xls"),
  );
  const other = await create("_OTHER");
  await req(api + "/" + other.id + "/import/luu", admin, 400, form(bytes, p));
  await req(
    api + "/" + c.id + "/import/luu",
    admin,
    400,
    form(bytes, { ...p, previewHash: "0".repeat(64) }),
  );
  const originalRows = (
    await db.query(
      "SELECT setting_value v FROM system_settings WHERE setting_key='import.max_rows'",
    )
  )[0].v;
  await db.query(
    "UPDATE system_settings SET setting_value='1' WHERE setting_key='import.max_rows'",
  );
  try {
    await req(api + "/" + c.id + "/import/luu", admin, 400, form(bytes, p));
  } finally {
    await db.query(
      "UPDATE system_settings SET setting_value=? WHERE setting_key='import.max_rows'",
      [originalRows],
    );
  }
  let updated = (
    await req(
      api + "/" + c.id,
      admin,
      200,
      {
        name: "Đã sửa tên",
        status: "ACTIVE",
        revision: c.revision,
        trackId: "99999",
        admissionYear: 2000,
      },
      "PUT",
    )
  ).data;
  eq(updated.trackId, c.trackId);
  eq(updated.admissionYear, 2025);
  await req(
    api + "/" + c.id,
    admin,
    409,
    { name: "Cũ", status: "ACTIVE", revision: c.revision },
    "PUT",
  );
  await req(api + "/" + c.id + "/import/luu", admin, 400, form(bytes, p));
  const p2 = await preview(updated, bytes, admin),
    saved = await req(
      api + "/" + c.id + "/import/luu",
      admin,
      201,
      form(bytes, p2),
    );
  eq(saved.r.headers.get("x-imported-count"), "2");
  eq(saved.r.headers.get("cache-control").includes("no-store"), true);
  const book = new Workbook();
  await book.xlsx.load(saved.bytes);
  const credentials = book
    .getWorksheet("Ban giao tai khoan")
    .getRows(2, 2)
    .map((r) => ({
      studentCode: r.getCell(3).text,
      username: r.getCell(4).text,
      password: r.getCell(6).text,
    }));
  for (const credential of credentials) {
    const [u] = await db.query(
      "SELECT u.*,CAST(s.id AS CHAR) studentId,s.student_code studentCode,s.organizational_unit_id unitId FROM users u JOIN students s ON s.user_id=u.id WHERE u.username=?",
      [credential.username],
    );
    eq(await bcrypt.compare(credential.password, u.password_hash), true);
    eq(u.must_change_password, 1);
    eq(String(u.unitId), track.unitId);
    eq(
      await count("SELECT COUNT(*) n FROM user_scopes WHERE user_id=?", [u.id]),
      0,
    );
    eq(
      (
        await db.query(
          "SELECT r.role_code role FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=?",
          [u.id],
        )
      ).map((r) => r.role),
      ["STUDENT"],
    );
    const [a] = await db.query(
      "SELECT * FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
      [u.studentId],
    );
    eq(String(a.program_version_track_id), track.id);
    if (credential.studentCode === linkCode) {
      eq(String(a.id), String(assignment.insertId));
      eq(u.studentId, linkId);
    }
    eq(
      await count(
        "SELECT COUNT(*) n FROM student_class_memberships WHERE student_id=? AND class_id=?",
        [u.studentId, c.id],
      ),
      1,
    );
    const audits = JSON.stringify(
      await db.query(
        "SELECT new_value,old_value FROM audit_logs WHERE entity_type='user' AND entity_id=?",
        [u.id],
      ),
    );
    eq(audits.includes(credential.password), false);
    eq(audits.includes(u.password_hash), false);
  }
  eq(await count("SELECT COUNT(*) n FROM users"), before + 2);
  const m = (await req(api + "/" + c.id + "/hoc-vien", admin)).data;
  eq(m.meta.total, 2);
  eq(
    m.data.every((x) => x.assignmentMatchesClass && x.mustChangePassword),
    true,
  );
  eq(JSON.stringify(m).includes("passwordHash"), false);
  const retry = await preview(c, bytes, admin);
  eq(retry.canImport, false);
  await req(api + "/" + c.id + "/import/luu", admin, 400, form(bytes, p2));
  eq(await count("SELECT COUNT(*) n FROM users"), before + 2);
  await req(
    api + "/" + c.id + "?revision=" + updated.revision,
    admin,
    409,
    undefined,
    "DELETE",
  );
  updated = (
    await req(
      api + "/" + c.id,
      admin,
      200,
      { name: "Ngừng nhận", status: "INACTIVE", revision: updated.revision },
      "PUT",
    )
  ).data;
  await preview(
    c,
    await file([
      [mark + "_BLOCK", "Không nhập", mark + "_block@example.invalid", ""],
    ]),
    admin,
    409,
  );
  eq(
    await count(
      "SELECT COUNT(*) n FROM student_class_memberships WHERE class_id=?",
      [c.id],
    ),
    2,
  );
  await req(
    api + "/" + other.id + "?revision=" + other.revision,
    admin,
    200,
    undefined,
    "DELETE",
  );
  await req(api + "/" + other.id, admin, 404);
  // Existing profiles with another assignment must never be silently reassigned.
  const conflict = await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,status) VALUES(?,?,2025,'ACTIVE')",
    [mark + "_CONFLICT", "Sai hướng"],
  );
  const application = options.tracks.find(
    (t) => t.versionCode === track.versionCode && t.trackCode === "APPLICATION",
  );
  await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id,assignment_status) VALUES(?,?,'ACTIVE')",
    [conflict.insertId, application.id],
  );
  const live = await create("_LIVE");
  const conflicted = await preview(
    live,
    await file([
      [mark + "_CONFLICT", "Sai hướng", mark + "_conflict@example.invalid", ""],
    ]),
    admin,
  );
  eq(conflicted.canImport, false);
  eq(
    conflicted.rows[0].errors.some((e) => e.includes("phân công")),
    true,
  );
  // Deliberately fail the second row's audit insert; the first account must roll back too.
  const rbRows = [
      [mark + "_RB1", "Rollback một", mark + "_rb1@example.invalid", ""],
      [mark + "_RB2", "Rollback hai", mark + "_rb2@example.invalid", ""],
    ],
    rbBytes = await file(rbRows),
    rbPreview = await preview(live, rbBytes, admin);
  const trigger = "student_account_rollback";
  await db.query(
    `CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.entity_type='user' AND JSON_UNQUOTE(JSON_EXTRACT(NEW.new_value,'$.username'))='${mark}_rb2' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='clone rollback check'; END IF; END`,
  );
  try {
    await req(
      api + "/" + live.id + "/import/luu",
      admin,
      502,
      form(rbBytes, rbPreview),
    );
  } finally {
    await db.query("DROP TRIGGER " + trigger);
  }
  eq(
    await count("SELECT COUNT(*) n FROM users WHERE username IN (?,?)", [
      mark + "_rb1",
      mark + "_rb2",
    ]),
    0,
  );
  eq(
    await count("SELECT COUNT(*) n FROM students WHERE student_code IN (?,?)", [
      mark + "_RB1",
      mark + "_RB2",
    ]),
    0,
  );
  eq(
    await count(
      "SELECT COUNT(*) n FROM student_class_memberships WHERE class_id=?",
      [live.id],
    ),
    0,
  );
  const credential = credentials[0];
  let login = await req("/api/auth/login", null, 200, {
    identifier: credential.username,
    password: credential.password,
  });
  eq(login.data.user.mustChangePassword, true);
  let imported = { cookie: login.r.headers.get("set-cookie").split(";")[0] };
  await req("/api/sinh-vien/chuong-trinh-dao-tao", imported, 403);
  const newPassword = "ChangedCloneAccount123!";
  await req("/api/auth/change-password", imported, 200, {
    oldPassword: credential.password,
    newPassword,
    confirmPassword: newPassword,
  });
  await req("/api/auth/profile", imported, 401);
  login = await req("/api/auth/login", null, 200, {
    identifier: credential.username,
    password: newPassword,
  });
  eq(login.data.user.mustChangePassword, false);
  imported = { cookie: login.r.headers.get("set-cookie").split(";")[0] };
  const own = (await req("/api/sinh-vien/chuong-trinh-dao-tao", imported)).data;
  eq(own.state, "READY");
  eq(own.student.studentCode, credential.studentCode);
  eq(own.curriculum.trackId, track.id);
  await req(api, imported, 403);
  // Remove an import permission live: an existing Admin JWT cannot keep importing.
  const permission = (
      await db.query(
        "SELECT id FROM permissions WHERE permission_code='STUDENT_ACCOUNT_IMPORT'",
      )
    )[0].id,
    role = (await db.query("SELECT id FROM roles WHERE role_code='ADMIN'"))[0]
      .id;
  await db.query(
    "DELETE FROM role_permissions WHERE role_id=? AND permission_id=?",
    [role, permission],
  );
  try {
    await req(api, admin, 403);
  } finally {
    await db.query(
      "INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)",
      [role, permission],
    );
  }
  const fixture = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "accounts.json",
  );
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      mark,
      admin,
      officer,
      student,
      track,
      credentials,
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
