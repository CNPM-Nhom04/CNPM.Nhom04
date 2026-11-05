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
  mark = "forms_" + Date.now();
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
  const officer = await actor("TRAINING_OFFICER"),
    admin = await actor("ADMIN");
  await db.query("DELETE FROM user_scopes WHERE user_id=?", [officer.id]);
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type,organizational_unit_id) VALUES(?,'ORG_UNIT',1)",
    [officer.id],
  );
  const pp = "/api/chuong-trinh-dao-tao",
    cp = "/api/danh-muc-hoc-phan";
  const opts = (await req(pp + "/options", officer)).data;
  const [policy] = await db.query(
    "SELECT setting_value value FROM system_settings WHERE setting_key='training.ngoaiNguBatBuocThacSi'",
  );
  eq(opts.languageRequirements.includes(policy.value), true);
  eq(opts.languageRequirements.includes("B1"), true);
  const units = (await req(cp + "/don-vi", officer)).data;
  eq(
    units.every((u) => ["1", "3"].includes(u.id)),
    true,
  );
  const course = {
    courseCode: mark,
    unitId: "1",
    courseName: "Học phần kiểm thử giới hạn",
    credits: 1,
    theoryHours: 15,
    practiceHours: 0,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
  };
  for (const credits of [0, 0.5, 1.5, 16, 200])
    await req(cp, officer, 400, { ...course, credits });
  for (const effectiveTo of ["2025-12-31", "2026-01-01"])
    await req(cp, officer, 400, { ...course, effectiveTo });
  await req(cp, officer, 403, { ...course, unitId: "2" });
  await req(cp, admin, 403, course);
  const saved = (await req(cp, officer, 201, course)).data;
  eq(saved.credits, 1);
  eq(saved.theoryHours, 15);
  const revised = (
    await req(cp + "/" + saved.id + "/phien-ban", officer, 201, {
      ...course,
      credits: 15,
      expectedLatestVersionId: saved.latestVersionId,
    })
  ).data;
  eq(revised.credits, 15);
  await req(cp + "/" + saved.id + "/phien-ban", officer, 400, {
    ...course,
    credits: 16,
    expectedLatestVersionId: revised.latestVersionId,
  });
  const baseProgram = {
    maCTDT: mark,
    maPhienBan: "v1",
    tenCTDT: "CTĐT kiểm thử form",
    tenTiengAnh: "",
    educationLevelId: "2",
    managingUnitId: "1",
    majorId: "1",
    hinhThucDaoTao: "CHINH_QUY",
    thoiGianDaoTao: "2",
    khoaTuyenSinh: "2026 - 2028",
    tongTinChiYeuCau: 60,
    chuanDauRaTiengAnh: policy.value,
    chuanDauRaTinHoc: "Bằng CNTT",
    soQuyetDinhBanHanh: "",
    moTa: "",
  };
  for (const duration of [
    "abc",
    "0",
    "-2",
    "2.222 năm",
    "0.25 năm",
    "1.25 năm",
  ])
    await req(pp, officer, 400, { ...baseProgram, thoiGianDaoTao: duration });
  const doctoral = opts.levels.find((level) => level.code === "DOCTOR");
  assert(doctoral, "Doctoral level must exist in SQL");
  const doctorProgram = (
    await req(pp, officer, 201, {
      ...baseProgram,
      maCTDT: mark + "_PHD",
      educationLevelId: doctoral.id,
      thoiGianDaoTao: "0.5",
      tongTinChiYeuCau: 90,
    })
  ).data;
  eq(doctorProgram.educationLevelId, doctoral.id);
  eq(doctorProgram.levelName, "Tiến sĩ");
  eq(doctorProgram.thoiGianDaoTao, "0.5 năm");
  eq(
    doctorProgram.tracks.map((track) => track.code),
    ["GENERAL"],
  );
  const program = (await req(pp, officer, 201, baseProgram)).data;
  eq(program.thoiGianDaoTao, "2 năm");
  eq(program.chuanDauRaTiengAnh, policy.value);
  eq(program.chuanDauRaTinHoc, "Bằng CNTT");
  const changed = (
    await req(
      pp + "/" + program.id,
      officer,
      200,
      {
        ...baseProgram,
        thoiGianDaoTao: "1.5",
        tenCTDT: "Đã sửa phiên bản hiện tại",
        revision: program.revision,
      },
      "PUT",
    )
  ).data;
  eq(changed.id, program.id);
  eq(changed.thoiGianDaoTao, "1.5 năm");
  const [sql] = await db.query(
    "SELECT duration_label,language_requirement,it_requirement FROM program_ui_details WHERE program_version_id=?",
    [program.id],
  );
  eq(sql.duration_label, "1.5 năm");
  eq(sql.language_requirement, policy.value);
  eq(sql.it_requirement, "Bằng CNTT");
  const [versions] = await db.query(
    "SELECT COUNT(*) n FROM program_versions WHERE program_id=?",
    [program.programId],
  );
  eq(Number(versions.n), 1);
  const fixture = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "forms.json",
  );
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      mark,
      officer,
      program: changed,
      course: revised,
      language: policy.value,
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
