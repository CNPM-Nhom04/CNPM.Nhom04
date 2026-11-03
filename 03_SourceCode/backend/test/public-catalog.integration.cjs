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
  mark = "catalog_" + Date.now();
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

async function run() {
  await db.initialize();
  const prefix = "/api/public/chuong-trinh-dao-tao";
  async function viewer(role, unit) {
    const a = await actor(role);
    await db.query("UPDATE users SET organizational_unit_id=? WHERE id=?", [
      unit,
      a.id,
    ]);
    return a;
  }
  const admin = await viewer("ADMIN", null),
    fit = await viewer("TRAINING_OFFICER", "1"),
    fbe = await viewer("TRAINING_OFFICER", "2"),
    teacher = await viewer("LECTURER", "3"),
    student = await viewer("STUDENT", "1"),
    none = await viewer("STUDENT", null),
    fallback = await viewer("STUDENT", null);
  await db.query("DELETE FROM user_scopes WHERE user_id IN(?,?,?)", [
    student.id,
    none.id,
    fallback.id,
  ]);
  await db.query(
    "INSERT INTO students(user_id,organizational_unit_id,student_code,full_name,admission_year,status) VALUES(?,2,?,?,2026,'ACTIVE')",
    [fallback.id, mark + "_FALLBACK", "Học viên khoa kinh tế"],
  );
  const doctorate = (
    await db.query(
      "SELECT CAST(id AS CHAR) id FROM education_levels WHERE level_code IN('DOCTOR','PHD') AND status='ACTIVE' LIMIT 1",
    )
  )[0].id;
  async function seed(code, unit, level, published = true) {
    const p = await db.query(
      "INSERT INTO training_programs(major_id,education_level_id,managing_unit_id,program_code,program_name) VALUES(?,?,?,?,?)",
      [
        unit === "1" ? "1" : "2",
        level,
        unit,
        mark + "_" + code,
        "TEST CTĐT " + code + " " + mark,
      ],
    );
    const v = await db.query(
      "INSERT INTO program_versions(program_id,version_code,program_name_snapshot,search_text,cohort_year,created_by) VALUES(?,?,?,?,2026,?)",
      [p.insertId, "v1", "TEST CTĐT " + code + " " + mark, mark, fit.id],
    );
    if (published)
      for (const status of ["SUBMITTED", "REVIEWING", "PUBLISHED"])
        await db.query(
          "UPDATE program_versions SET status=?,submitted_at=UTC_TIMESTAMP(6),published_at=IF(?='PUBLISHED',UTC_TIMESTAMP(6),NULL),locked_at=IF(?='PUBLISHED',UTC_TIMESTAMP(6),NULL) WHERE id=?",
          [status, status, status, v.insertId],
        );
    return String(v.insertId);
  }
  const fitIds = [];
  for (let i = 0; i < 10; i++) fitIds.push(await seed("FIT_M_" + i, "1", "2"));
  const fbeMaster = await seed("FBE_M", "2", "2"),
    fitDoctor = await seed("FIT_D", "1", doctorate),
    fbeDoctor = await seed("FBE_D", "2", doctorate),
    draft = await seed("PRIVATE_DRAFT", "2", "2", false);
  const guest = (await req(prefix + "?search=" + mark + "&limit=100")).data;
  eq(guest.meta.total, 13);
  eq(guest.view.mode, "PUBLIC");
  eq(
    guest.data.some((p) => p.id === draft),
    false,
  );
  eq(guest.data.filter((p) => p.levelCode === "MASTER").length, 11);
  const doctors = (await req(prefix + "?levelCode=DOCTOR&search=" + mark)).data;
  eq(doctors.meta.total, 2);
  eq(
    doctors.data.every((p) => ["DOCTOR", "PHD"].includes(p.levelCode)),
    true,
  );
  for (const [a, faculty, expected] of [
    [fit, "1", 11],
    [teacher, "1", 11],
    [student, "1", 11],
    [fbe, "2", 2],
    [fallback, "2", 2],
  ]) {
    const result = await req(prefix + "?search=" + mark + "&limit=100", a);
    eq(result.data.meta.total, expected);
    eq(result.data.view.facultyId, faculty);
    eq(result.data.view.mode, "FACULTY");
    eq(result.r.headers.get("cache-control").includes("private"), true);
    eq(result.r.headers.get("vary").includes("Cookie"), true);
    const allowed = faculty === "1" ? fitDoctor : fbeDoctor,
      foreign = faculty === "1" ? fbeDoctor : fitDoctor;
    eq((await req(prefix + "/" + allowed, a)).data.view.facultyId, faculty);
    await req(prefix + "/" + foreign, a, 404);
  }
  eq(
    (await req(prefix + "?search=" + mark, none)).data.view.mode,
    "UNASSIGNED",
  );
  eq((await req(prefix + "?search=" + mark, none)).data.meta.total, 0);
  await req(prefix + "/" + fitDoctor, none, 404);
  eq(
    (await req(prefix + "?search=" + mark, admin)).data.view.mode,
    "ADMIN_ALL",
  );
  eq(
    (await req(prefix + "?search=" + mark + "&limit=100", admin)).data.meta
      .total,
    13,
  );
  await req(prefix + "/" + draft, null, 404);
  await req(prefix + "/" + draft, fbe, 404);
  await req(prefix + "?levelCode=BACHELOR", null, 400);
  const first = (
      await req(prefix + "?levelCode=MASTER&search=" + mark + "&limit=8&page=1")
    ).data,
    second = (
      await req(prefix + "?levelCode=MASTER&search=" + mark + "&limit=8&page=2")
    ).data;
  eq(first.data.length, 8);
  eq(second.data.length, 3);
  eq(new Set([...first.data, ...second.data].map((p) => p.id)).size, 11);
  // Query parameters cannot substitute the signed-in user's faculty.
  const escaped = (
    await req(
      prefix + "?search=" + mark + "&unitId=2&facultyId=2&userId=" + fbe.id,
      fit,
    )
  ).data;
  eq(escaped.view.facultyId, "1");
  eq(
    escaped.data.some((p) => p.id === fbeMaster),
    false,
  );
  // Existing tokens must use the current SQL work unit, not a cached login profile.
  await db.query("UPDATE users SET organizational_unit_id=2 WHERE id=?", [
    fit.id,
  ]);
  eq((await req(prefix + "?search=" + mark, fit)).data.view.facultyId, "2");
  await db.query("UPDATE users SET organizational_unit_id=1 WHERE id=?", [
    fit.id,
  ]);
  const invalid = { cookie: "ctdt_access_token=invalid" };
  await req(prefix, invalid, 401);
  await req(prefix + "/" + fitDoctor, invalid, 401);
  await db.query("UPDATE users SET must_change_password=1 WHERE id=?", [
    none.id,
  ]);
  await req(prefix, none, 403);
  await db.query("UPDATE users SET must_change_password=0 WHERE id=?", [
    none.id,
  ]);
  await db.query("UPDATE users SET account_status='DISABLED' WHERE id=?", [
    none.id,
  ]);
  await req(prefix, none, 401);
  await db.query("UPDATE users SET account_status='ACTIVE' WHERE id=?", [
    none.id,
  ]);
  // SSR detail and home use the same credential-aware backend path.
  const html = await fetch(base + "/chuong-trinh-dao-tao/" + fbeDoctor, {
    headers: { Cookie: fit.cookie },
  }).then((r) => r.text());
  eq(html.includes("Chưa thể hiển thị chương trình"), true);
  eq(html.includes("TEST CTĐT FBE_D " + mark), false);
  const filename = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "catalog.json",
  );
  fs.writeFileSync(
    filename,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      mark,
      admin,
      fit,
      fbe,
      teacher,
      student,
      none,
      fallback,
      fitDoctor,
      fbeDoctor,
      fitIds,
      fbeMaster,
      draft,
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
