/* SQL role matrix checks. Never mutate a real database. */
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
  mark = "access_" + Date.now();
let checks = 0,
  seq = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function req(
  url,
  a,
  expected = 200,
  body,
  method = body === undefined ? "GET" : "POST",
  direct = false,
) {
  const r = await fetch((direct ? "http://127.0.0.1:3102" : base) + url, {
    method,
    redirect: "manual",
    headers: {
      Origin: base,
      ...(a
        ? direct
          ? { Authorization: "Bearer " + a.token }
          : { Cookie: a.cookie }
        : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  const bytes = Buffer.from(await r.arrayBuffer());
  try {
    data = JSON.parse(bytes.toString());
  } catch {}
  eq(
    r.status,
    expected,
    (a?.role || "ANON") + " " + url + " " + JSON.stringify(data),
  );
  return { r, data };
}
async function account(role, scope = "GLOBAL", unit = "1") {
  const username = mark + "_" + ++seq,
    password = "AccessMatrix123!";
  const u = await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,organizational_unit_id,must_change_password) VALUES(?,?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử " + role,
      await bcrypt.hash(password, 4),
      unit,
    ],
  );
  const id = String(u.insertId);
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [id, role],
  );
  if (scope)
    await db.query(
      "INSERT INTO user_scopes(user_id,scope_type,organizational_unit_id) VALUES(?,?,?)",
      [id, scope, scope === "ORG_UNIT" ? unit : null],
    );
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, id],
  );
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    {
      sub: id,
      jti: sid,
      role: "ADMIN",
      permissions: ["USER_MANAGE", "PROGRAM_EDIT"],
    },
    { expiresIn: "30m" },
  );
  const permissions = (
    await db.query(
      "SELECT DISTINCT p.permission_code FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE'",
      [id],
    )
  ).map((r) => r.permission_code);
  return {
    id,
    role,
    username,
    password,
    token,
    cookie: "ctdt_access_token=" + token,
    sid,
    permissions,
  };
}
async function run() {
  await db.initialize();
  const roles = [
    "ADMIN",
    "TRAINING_OFFICER",
    "APPROVER",
    "LECTURER",
    "STUDENT",
  ];
  const actors = [];
  for (const role of roles)
    actors.push(await account(role, role === "STUDENT" ? null : "ORG_UNIT"));
  const [admin, officer, approver, lecturer, student] = actors;
  const reads = [
    ["/api/admin/nguoi-dung", "USER_MANAGE", true],
    ["/api/admin/master-data", "MASTERDATA_MANAGE", true],
    ["/api/admin/khoa", "MASTERDATA_MANAGE", true],
    ["/api/admin/nganh-dao-tao", "MASTERDATA_MANAGE", true],
    ["/api/admin/cau-hinh", "SETTINGS_MANAGE", true],
    ["/api/admin/audit-log", "AUDIT_READ_ALL", true],
    ["/api/admin/cong-thong-tin/van-ban", "MASTERDATA_MANAGE", true],
    ["/api/admin/lop-hoc-vien", "STUDENT_ACCOUNT_IMPORT", true],
    ["/api/danh-muc-hoc-phan", "CATALOG_READ"],
    ["/api/chuong-trinh-dao-tao", "PROGRAM_READ"],
    ["/api/bao-cao", "PROGRAM_READ"],
    ["/api/so-sanh/options", "PROGRAM_COMPARE"],
    ["/api/xet-duyet", "PROGRAM_APPROVE"],
    ["/api/de-tai-luan-van", "TOPIC_READ"],
    ["/api/bao-ve-luan-van", "DEFENSE_READ"],
    ["/api/quan-ly-diem", "GRADE_READ"],
    ["/api/xet-tot-nghiep", "GRADUATION_READ"],
  ];
  for (const [url, permission, adminOnly] of reads) {
    await req(url, null, 401);
    for (const a of actors) {
      const allowed =
        a.permissions.includes(permission) &&
        (!adminOnly || a.role === "ADMIN");
      const data = (await req(url, a, allowed ? 200 : 403)).data;
      if (allowed && data?.permissions) {
        if (url === "/api/danh-muc-hoc-phan")
          eq(
            data.permissions.canManage,
            a.permissions.includes("CATALOG_MANAGE"),
          );
        if (url === "/api/chuong-trinh-dao-tao") {
          eq(data.permissions.canEdit, a.permissions.includes("PROGRAM_EDIT"));
          eq(
            data.permissions.canSubmit,
            a.permissions.includes("PROGRAM_SUBMIT"),
          );
          eq(
            data.permissions.canExport,
            a.permissions.includes("PROGRAM_EXPORT"),
          );
        }
        if (url === "/api/de-tai-luan-van") {
          eq(
            data.permissions.canManage,
            a.permissions.includes("TOPIC_MANAGE"),
          );
          eq(
            data.permissions.canApprove,
            a.permissions.includes("TOPIC_APPROVE"),
          );
        }
        if (url === "/api/quan-ly-diem")
          eq(
            data.permissions.canManage,
            a.permissions.includes("GRADE_MANAGE"),
          );
      }
    }
  }
  // Mutation routes must reject unauthorized roles before validating payloads.
  const writes = [
    ["/api/admin/nguoi-dung", "USER_MANAGE", true],
    ["/api/admin/lop-hoc-vien", "STUDENT_ACCOUNT_IMPORT", true],
    ["/api/danh-muc-hoc-phan", "CATALOG_MANAGE"],
    ["/api/chuong-trinh-dao-tao", "PROGRAM_EDIT"],
    ["/api/chuong-trinh-dao-tao/1/gui-duyet", "PROGRAM_SUBMIT"],
    ["/api/xet-duyet/1/bat-dau", "PROGRAM_APPROVE"],
    ["/api/de-tai-luan-van", "TOPIC_MANAGE"],
    ["/api/de-tai-luan-van/1/duyet", "TOPIC_APPROVE"],
    ["/api/de-tai-luan-van/1/nghiem-thu", "TOPIC_COMPLETE"],
    ["/api/bao-ve-luan-van", "DEFENSE_SCHEDULE"],
    ["/api/bao-ve-luan-van/1/ket-qua", "DEFENSE_RESULT"],
    ["/api/quan-ly-diem", "GRADE_MANAGE"],
    ["/api/xet-tot-nghiep/quy-dinh/3", "GRADUATION_POLICY"],
    ["/api/xet-tot-nghiep/4/minh-chung", "GRADUATION_EVIDENCE"],
    ["/api/xet-tot-nghiep/kiem-tra", "GRADUATION_CHECK"],
  ];
  for (const [url, permission, adminOnly] of writes)
    for (const a of actors)
      if (
        !a.permissions.includes(permission) ||
        (adminOnly && a.role !== "ADMIN")
      )
        await req(url, a, 403, {});
  const fitPrograms = (
    await db.query(
      "SELECT program_id id FROM vw_user_program_access WHERE user_id=?",
      [officer.id],
    )
  ).map((x) => String(x.id));
  const data = (await req("/api/chuong-trinh-dao-tao?limit=100", officer)).data; // parity via version IDs avoids trusting labels.
  const versions = (
    await db.query(
      "SELECT CAST(v.id AS CHAR) id FROM program_versions v WHERE EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=v.program_id)",
      [officer.id],
    )
  )
    .map((x) => x.id)
    .sort();
  eq(data.data.map((x) => String(x.id)).sort(), versions);
  const fbe = await account("TRAINING_OFFICER", "ORG_UNIT", "2");
  const fbeData = (await req("/api/chuong-trinh-dao-tao?limit=100", fbe)).data;
  const fbeVersions = (
    await db.query(
      "SELECT CAST(v.id AS CHAR) id FROM program_versions v WHERE EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=v.program_id)",
      [fbe.id],
    )
  )
    .map((x) => x.id)
    .sort();
  eq(fbeData.data.map((x) => String(x.id)).sort(), fbeVersions);
  const [foreignVersion] = await db.query(
    "SELECT CAST(v.id AS CHAR) id FROM program_versions v WHERE NOT EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=v.program_id) LIMIT 1",
    [fbe.id],
  );
  assert(foreignVersion);
  await req("/api/chuong-trinh-dao-tao/" + foreignVersion.id, fbe, 404);
  const none = await account("TRAINING_OFFICER", null);
  eq((await req("/api/chuong-trinh-dao-tao", none)).data.meta.total, 0);
  eq((await req("/api/danh-muc-hoc-phan", none)).data.meta.total, 0);
  // A student with an accidentally broad scope still cannot use management APIs.
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type) VALUES(?,'GLOBAL')",
    [student.id],
  );
  await req("/api/chuong-trinh-dao-tao", student, 403);
  await req("/api/admin/nguoi-dung", student, 403);
  await db.query("UPDATE students SET user_id=? WHERE student_code='SV003'", [
    student.id,
  ]);
  const own = (await req("/api/sinh-vien/chuong-trinh-dao-tao", student)).data;
  eq(own.student.studentCode, "SV003");
  eq(own.curriculum.trackCode, "RESEARCH");
  await req("/api/sinh-vien/chuong-trinh-dao-tao?studentId=1", student, 400);
  await req("/api/sinh-vien/chuong-trinh-dao-tao", admin, 403);
  // Read does not imply export. Both scope and the separate export grant are required.
  const comparison = "?versionA=2&trackA=3&versionB=2&trackB=4";
  await req("/api/bao-cao/xuat-excel", admin, 403);
  await req("/api/so-sanh/export" + comparison, admin, 403);
  for (const a of [officer, approver]) {
    await req("/api/bao-cao/xuat-excel", a);
    await req("/api/so-sanh/export" + comparison, a);
  }
  const exportPermission = (
      await db.query(
        "SELECT id FROM permissions WHERE permission_code='PROGRAM_EXPORT'",
      )
    )[0].id,
    officerRole = (
      await db.query("SELECT id FROM roles WHERE role_code='TRAINING_OFFICER'")
    )[0].id;
  await db.query(
    "DELETE FROM role_permissions WHERE role_id=? AND permission_id=?",
    [officerRole, exportPermission],
  );
  try {
    await req("/api/bao-cao", officer);
    await req("/api/so-sanh" + comparison, officer);
    await req("/api/bao-cao/xuat-excel", officer, 403);
    await req("/api/so-sanh/export" + comparison, officer, 403);
    await req("/api/chuong-trinh-dao-tao/2/xuat-excel?trackId=3", officer, 403);
  } finally {
    await db.query(
      "INSERT INTO role_permissions(role_id,permission_id) VALUES(?,?)",
      [officerRole, exportPermission],
    );
  }
  for (const status of ["DISABLED", "LOCKED", "PENDING"]) {
    await db.query("UPDATE users SET account_status=? WHERE id=?", [
      status,
      officer.id,
    ]);
    await req("/api/bao-cao", officer, 401);
    await db.query("UPDATE users SET account_status='ACTIVE' WHERE id=?", [
      officer.id,
    ]);
  }
  await db.query("UPDATE users SET must_change_password=1 WHERE id=?", [
    officer.id,
  ]);
  await req("/api/auth/profile", officer);
  await req("/api/bao-cao", officer, 403);
  await req("/api/chuong-trinh-dao-tao", officer, 403);
  await db.query("UPDATE users SET must_change_password=0 WHERE id=?", [
    officer.id,
  ]);
  const roleId = (
    await db.query("SELECT id FROM roles WHERE role_code='LECTURER'")
  )[0].id;
  await db.query("UPDATE roles SET status='INACTIVE' WHERE id=?", [roleId]);
  try {
    await req("/api/danh-muc-hoc-phan", lecturer, 403);
  } finally {
    await db.query("UPDATE roles SET status='ACTIVE' WHERE id=?", [roleId]);
  }
  await db.query(
    "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE id=?",
    [none.sid],
  );
  await req("/api/bao-cao", none, 401);
  const fixture = path.join(
    path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
    "access.json",
  );
  fs.writeFileSync(
    fixture,
    JSON.stringify({ database: process.env.DB_DATABASE, base, actors }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ result: "PASS", checks, roles: roles.length }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
