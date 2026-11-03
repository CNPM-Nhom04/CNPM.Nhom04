/* Mutating checks run ONLY on a disposable clone; no source database writes. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_major_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error(
    "Use disposable ctdt_major_review_<timestamp> with MAJOR_TEST_ALLOW_WRITES=1.",
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
const base = process.env.MAJOR_TEST_URL || "http://localhost:3101",
  prefix = "/api/admin/nganh-dao-tao",
  marker = "major_" + Date.now();
let checks = 0,
  seq = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function http(
  url,
  actor,
  expected = 200,
  body,
  method = body === undefined ? "GET" : "POST",
  origin = base,
) {
  const r = await fetch(base + url, {
    method,
    headers: {
      Origin: origin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const v = await r.json().catch(() => null);
  same(
    r.status,
    expected,
    url + " " + (body?.majorCode || "") + " " + JSON.stringify(v?.message),
  );
  return v;
}
async function account(role, scope = "GLOBAL", unit) {
  const username = marker + "_" + ++seq,
    password = "MajorReview123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử ngành " + role,
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
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type,organizational_unit_id) VALUES(?,?,?)",
    [u.id, scope, unit || null],
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
const version = (item) =>
  new URLSearchParams({ expectedUpdatedAt: item.updatedAt });
const input = (code, unitId, status = "ACTIVE") => ({
  majorCode: code === "BAD" ? marker + "_BAD" : code,
  majorName: "Ngành kiểm thử " + code,
  unitId,
  status,
});
const update = (item, patch) => ({
  ...input(item.majorCode, item.unitId, item.status),
  majorName: item.majorName,
  ...patch,
  expectedUpdatedAt: item.updatedAt,
});
async function run() {
  await db.initialize();
  const admin = await account("ADMIN"),
    officer = await account("TRAINING_OFFICER", "ORG_UNIT", "1"),
    student = await account("STUDENT");
  same(
    (await http("/api/auth/profile", admin)).username,
    admin.username,
    "clone-only session before HTTP writes",
  );
  await http(prefix, null, 401);
  await http(prefix, officer, 403);
  await http(prefix, student, 403);
  await http(prefix + "/options", officer, 403);
  const initial = await http(prefix, admin);
  const [count] = await db.query("SELECT COUNT(*) total FROM majors");
  same(initial.meta.total, Number(count.total), "SQL/list parity");
  const options = await http(prefix + "/options", admin);
  assert(options.units.length);
  checks++;
  await http(prefix + "?page=0", admin, 400);
  await http(prefix + "?status=DELETED", admin, 400);
  await http(prefix + "?unitId=1%20OR%201=1", admin, 400);
  await http(prefix + "/0", admin, 404);
  await http(prefix + "/999999999999", admin, 404);
  await http(prefix, admin, 400, { ...input("BAD", "1"), majorName: "   " });
  await http(prefix, admin, 400, { ...input("BAD", "1"), majorCode: "x;DROP" });
  const extra = await http(prefix, admin, 201, {
    ...input(marker + "_EXTRA", "1"),
    description: "column not in SQL",
  });
  same(
    Object.hasOwn(extra, "description"),
    false,
    "non-schema field is not persisted or returned",
  );
  await http(prefix, admin, 400, input("BAD", "999999999999"));
  await http(
    prefix,
    admin,
    403,
    input("BAD", "1"),
    "POST",
    "https://outside.invalid",
  );
  const faculty = await http("/api/admin/master-data", admin, 201, {
    maDanhMuc: marker + "_SP",
    tenDanhMuc: "Khoa Sư phạm kiểm thử",
    loaiDanhMuc: "KHOA_QUAN_LY",
    moTa: "TEST ONLY",
    trangThai: true,
  });
  const unitId = faculty.id.split(":")[1],
    spOfficer = await account("TRAINING_OFFICER", "ORG_UNIT", unitId);
  same(
    (await http(prefix + "/options", admin)).units.some((u) => u.id === unitId),
    true,
    "new unit offered",
  );
  let item = await http(prefix, admin, 201, {
    ...input(marker + "_SP_TOAN", unitId),
    majorName: " Sư phạm Toán kiểm thử ",
  });
  same(item.majorName, "Sư phạm Toán kiểm thử", "trim Unicode");
  same(item.identityLocked, false, "unused unlocked");
  const [saved] = await db.query(
    "SELECT major_code,major_name,organizational_unit_id,status FROM majors WHERE id=?",
    [item.id],
  );
  same(saved.major_code, item.majorCode, "SQL code");
  same(String(saved.organizational_unit_id), unitId, "SQL unit");
  await http(prefix, admin, 409, input(item.majorCode.toUpperCase(), unitId));
  same(
    (await http(prefix + "?searchTerm=" + item.majorCode, admin)).meta.total,
    1,
    "search",
  );
  same(
    (await http(prefix + "?status=INACTIVE&unitId=" + unitId, admin)).meta
      .total,
    0,
    "status filter",
  );
  same(
    (await http(prefix + "?unitId=" + unitId + "&limit=1", admin)).data.length,
    1,
    "paging and unit filter",
  );
  let fresh = await http(prefix + "/" + item.id, admin);
  const edited = await http(
    prefix + "/" + item.id,
    admin,
    200,
    update(fresh, { majorName: "Ngành đã sửa" }),
    "PUT",
  );
  same(edited.id, item.id, "update preserves id");
  await http(
    prefix + "/" + item.id,
    admin,
    409,
    update(fresh, { majorName: "stale" }),
    "PUT",
  );
  await http(
    prefix + "/" + item.id + "?" + version(fresh),
    admin,
    409,
    undefined,
    "DELETE",
  );
  await http(
    prefix + "/" + item.id,
    admin,
    400,
    input(item.majorCode, unitId),
    "PUT",
  );
  await http(prefix + "/" + item.id, admin, 400, undefined, "DELETE");
  item = edited;
  let spOptions = await http("/api/chuong-trinh-dao-tao/options", spOfficer);
  same(
    spOptions.majors.some((m) => m.id === item.id),
    true,
    "SP officer sees own major",
  );
  same(
    (await http("/api/chuong-trinh-dao-tao/options", officer)).majors.some(
      (m) => m.id === item.id,
    ),
    false,
    "FIT officer cannot see SP major",
  );
  const majorBefore = await http(prefix + "/" + item.id, admin);
  let inactive = await http(
    prefix + "/" + item.id,
    admin,
    200,
    update(majorBefore, { status: "INACTIVE" }),
    "PUT",
  );
  same(
    (await http("/api/chuong-trinh-dao-tao/options", spOfficer)).majors.some(
      (m) => m.id === item.id,
    ),
    false,
    "inactive major excluded",
  );
  item = await http(
    prefix + "/" + item.id,
    admin,
    200,
    update(inactive, { status: "ACTIVE" }),
    "PUT",
  );
  const program = {
    maCTDT: marker + "_P",
    maPhienBan: marker + "_v1",
    tenCTDT: "CTĐT Sư phạm kiểm thử",
    tenTiengAnh: "",
    educationLevelId: "2",
    managingUnitId: unitId,
    majorId: item.id,
    hinhThucDaoTao: "CHINH_QUY",
    thoiGianDaoTao: "",
    khoaTuyenSinh: "2026 - 2028",
    tongTinChiYeuCau: 60,
    chuanDauRaTiengAnh: "",
    chuanDauRaTinHoc: "",
    soQuyetDinhBanHanh: "",
    moTa: "TEST ONLY",
  };
  await http("/api/chuong-trinh-dao-tao", spOfficer, 400, {
    ...program,
    managingUnitId: "1",
  });
  const created = await http(
    "/api/chuong-trinh-dao-tao",
    spOfficer,
    201,
    program,
  );
  same(created.majorId, item.id, "new program references saved major");
  item = await http(prefix + "/" + item.id, admin);
  same(item.programCount, 1, "program usage");
  same(item.identityLocked, true, "used major locked");
  await http(
    prefix + "/" + item.id,
    admin,
    409,
    update(item, { unitId: "1" }),
    "PUT",
  );
  await http(
    prefix + "/" + item.id,
    admin,
    409,
    update(item, { majorCode: marker + "_CHANGED" }),
    "PUT",
  );
  await http(
    prefix + "/" + item.id + "?" + version(item),
    admin,
    409,
    undefined,
    "DELETE",
  );
  item = await http(
    prefix + "/" + item.id,
    admin,
    200,
    update(item, { status: "INACTIVE" }),
    "PUT",
  );
  same(
    (await http("/api/chuong-trinh-dao-tao/" + created.id, spOfficer)).majorId,
    item.id,
    "history readable when major inactive",
  );
  await http("/api/chuong-trinh-dao-tao", spOfficer, 400, {
    ...program,
    maCTDT: marker + "_P2",
    maPhienBan: marker + "_v2",
  });
  item = await http(
    prefix + "/" + item.id,
    admin,
    200,
    update(item, { status: "ACTIVE" }),
    "PUT",
  );
  // An unused major may move; a referenced major may not.
  let movable = await http(prefix, admin, 201, input(marker + "_MOVE", unitId));
  movable = await http(
    prefix + "/" + movable.id,
    admin,
    200,
    update(movable, { unitId: "1" }),
    "PUT",
  );
  same(movable.unitId, "1", "unused unit move");
  same(
    (await http("/api/chuong-trinh-dao-tao/options", spOfficer)).majors.some(
      (m) => m.id === movable.id,
    ),
    false,
    "moved major no longer in old scope",
  );
  // Both other SQL references prevent deletion/moving even without a CTĐT.
  const scoped = await http(
    prefix,
    admin,
    201,
    input(marker + "_SCOPE", unitId),
  );
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type,major_id) VALUES(?,'MAJOR',?)",
    [spOfficer.id, scoped.id],
  );
  let linked = await http(prefix + "/" + scoped.id, admin);
  same(linked.userScopeCount, 1, "user scope counted");
  await http(
    prefix + "/" + linked.id + "?" + version(linked),
    admin,
    409,
    undefined,
    "DELETE",
  );
  await http(
    prefix + "/" + linked.id,
    admin,
    409,
    update(linked, { unitId: "1" }),
    "PUT",
  );
  const periodMajor = await http(
    prefix,
    admin,
    201,
    input(marker + "_PERIOD", unitId),
  );
  const [period] = await db.query(
    "SELECT id FROM registration_periods ORDER BY id LIMIT 1",
  );
  await db.query(
    "INSERT INTO registration_period_scopes(registration_period_id,major_id) VALUES(?,?)",
    [period.id, periodMajor.id],
  );
  linked = await http(prefix + "/" + periodMajor.id, admin);
  same(linked.registrationScopeCount, 1, "period scope counted");
  await http(
    prefix + "/" + linked.id + "?" + version(linked),
    admin,
    409,
    undefined,
    "DELETE",
  );
  // Inactive child unit must not expose its major through an active ancestor.
  await db.query(
    "INSERT INTO organizational_units(parent_id,unit_code,unit_name,unit_type) VALUES(?,?,?,'DEPARTMENT')",
    [unitId, marker + "_CHILD", "Bộ môn kiểm thử"],
  );
  const [child] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE unit_code=?",
    [marker + "_CHILD"],
  );
  const childMajor = await http(
    prefix,
    admin,
    201,
    input(marker + "_CHILD_MAJOR", child.id),
  );
  same(
    (await http("/api/chuong-trinh-dao-tao/options", spOfficer)).majors.some(
      (m) => m.id === childMajor.id,
    ),
    true,
    "child major visible through ancestor",
  );
  await db.query(
    "UPDATE organizational_units SET status='INACTIVE' WHERE id=?",
    [child.id],
  );
  same(
    (await http("/api/chuong-trinh-dao-tao/options", spOfficer)).majors.some(
      (m) => m.id === childMajor.id,
    ),
    false,
    "inactive owner excluded through active ancestor",
  );
  await http(prefix, admin, 400, input(marker + "_INACTIVE_UNIT", child.id));
  await http("/api/chuong-trinh-dao-tao", spOfficer, 400, {
    ...program,
    maCTDT: marker + "_P3",
    maPhienBan: marker + "_v3",
    majorId: childMajor.id,
  });
  // Audit insertion failure must roll the major INSERT back.
  await db.query(
    "CREATE TRIGGER trg_major_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.entity_type='majors' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_AUDIT_FAILURE'; END IF; END",
  );
  try {
    const failed = await http(
      prefix,
      admin,
      502,
      input(marker + "_ROLLBACK", unitId),
    );
    same(
      JSON.stringify(failed).includes("TEST_AUDIT_FAILURE"),
      false,
      "SQL error hidden",
    );
    const [c] = await db.query(
      "SELECT COUNT(*) n FROM majors WHERE major_code=?",
      [marker + "_ROLLBACK"],
    );
    same(Number(c.n), 0, "audit failure rolls back major");
  } finally {
    await db.query("DROP TRIGGER trg_major_test_audit");
  }
  await http(
    prefix + "/" + movable.id + "?" + version(movable),
    admin,
    200,
    undefined,
    "DELETE",
  );
  await http(prefix + "/" + movable.id, admin, 404);
  const [audit] = await db.query(
    "SELECT COUNT(*) n FROM audit_logs WHERE entity_type='majors' AND entity_id=? AND action='DELETE'",
    [movable.id],
  );
  same(Number(audit.n), 1, "deleted major audit retained");
  const fixture =
    process.env.MAJOR_BROWSER_FIXTURE || "/tmp/ctdt-major-browser.json";
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      database: process.env.DB_DATABASE,
      base,
      admin,
      officer,
      spOfficer,
      unitId,
      usedMajor: item,
      programId: created.id,
      marker,
    }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ checks, result: "PASS", fixture }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
