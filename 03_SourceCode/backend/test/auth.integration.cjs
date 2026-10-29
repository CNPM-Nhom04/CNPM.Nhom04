/* Full auth/RBAC/SQL regression test. Run only against an isolated database copy.
   Creates marked test users, temporarily changes copied policy/grants, and restores them. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
if (process.env.AUTH_TEST_ALLOW_WRITES !== "1")
  throw new Error(
    "Use an isolated database and set AUTH_TEST_ALLOW_WRITES=1 before running this integration test.",
  );
const { DataSource } = require("typeorm");
const { JwtService } = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const { Workbook } = require("exceljs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  entities: [require(root + "/dist/modules/identity/domain/user.entity").User],
});
const base = process.env.FRONTEND_URL || "http://localhost:3000";
const marker = "auth_smoke_" + Date.now();
const password = "AuthTestPassword123!",
  nextPassword = "AuthNewPassword456!";
const userIds = [];
let checks = 0,
  adminCookie,
  policyBefore,
  removedReadGrant = false,
  grantSnapshot = null;
async function call(
  route,
  expected = 200,
  { cookie = adminCookie, method = "GET", body, origin = base } = {},
) {
  const response = await fetch(base + route, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (response.status !== expected)
    throw new Error(
      `${method} ${route}: expected ${expected}, received ${response.status}: ${JSON.stringify(await response.json().catch(() => ({})))}`,
    );
  checks++;
  return response;
}
async function json(route, status, options) {
  return (await call(route, status, options)).json();
}
async function account(suffix, role, mustChange = false) {
  const username = marker + "_" + suffix;
  await db.query(
    "INSERT INTO users (username,email,password_hash,full_name,account_status,organizational_unit_id,must_change_password) VALUES (?,?,?,?,'ACTIVE',1,?)",
    [
      username,
      username + "@example.invalid",
      await bcrypt.hash(password, 4),
      username,
      mustChange,
    ],
  );
  const [user] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [username],
  );
  userIds.push(user.id);
  await db.query(
    "INSERT INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [user.id, role],
  );
  return { id: user.id, username, password };
}
async function login(user, pass = user.password) {
  const r = await call("/api/auth/login", 200, {
    method: "POST",
    cookie: "",
    body: { identifier: user.username, password: pass },
  });
  const cookie = r.headers.get("set-cookie");
  assert.ok(/HttpOnly/i.test(cookie));
  assert.ok(
    !(await r.json()).access_token,
    "Browser JSON must not expose bearer tokens",
  );
  return cookie.split(";")[0];
}
async function rawToken(userId, expired = false) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES (?,?,?)",
    [
      userId,
      crypto.createHash("sha256").update(token).digest("hex"),
      new Date(Date.now() + (expired ? -60000 : 60000)),
    ],
  );
  return token;
}
(async () => {
  try {
    await db.initialize();
    const admin = await account("admin", "ADMIN");
    const student = await account("student", "STUDENT");
    const officer = await account("officer", "TRAINING_OFFICER", true);
    await db.query(
      "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
      [admin.id],
    );
    adminCookie = await login(admin);
    const studentCookie = await login(student);
    let staffCookie = await login(officer);
    for (const route of [
      "/api/admin/nguoi-dung",
      "/api/bao-cao",
      "/api/auth/profile",
    ])
      await call(route, 401, { cookie: "" });
    await call("/api/admin/nguoi-dung", 403, { cookie: studentCookie });
    await call("/api/bao-cao", 403, { cookie: studentCookie });
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const studentClaims = jwt.decode(studentCookie.split("=")[1]);
    const forged =
      "ctdt_access_token=" +
      jwt.sign(
        { sub: student.id, jti: studentClaims.jti, role: "ADMIN" },
        { expiresIn: "5m" },
      );
    await call("/api/admin/nguoi-dung", 403, { cookie: forged });
    await call("/api/bao-cao", 403, { cookie: forged });
    const legacy =
      "ctdt_access_token=" +
      jwt.sign({ sub: admin.id, role: "ADMIN" }, { expiresIn: "5m" });
    await call("/api/admin/nguoi-dung", 401, { cookie: legacy });
    const expired =
      "ctdt_access_token=" +
      jwt.sign(
        { sub: admin.id, jti: jwt.decode(adminCookie.split("=")[1]).jti },
        { expiresIn: -1 },
      );
    await call("/api/auth/profile", 401, { cookie: expired });

    await call("/api/bao-cao", 403, { cookie: staffCookie });
    assert.equal(
      (await json("/api/auth/profile", 200, { cookie: staffCookie }))
        .mustChangePassword,
      true,
    );
    await call("/api/auth/change-password", 400, {
      method: "POST",
      cookie: staffCookie,
      body: {
        oldPassword: password,
        newPassword: nextPassword,
        confirmPassword: "MismatchPassword123!",
      },
    });
    await call("/api/auth/change-password", 400, {
      method: "POST",
      cookie: staffCookie,
      body: {
        oldPassword: "wrong",
        newPassword: nextPassword,
        confirmPassword: nextPassword,
      },
    });
    await call("/api/auth/change-password", 400, {
      method: "POST",
      cookie: staffCookie,
      body: {
        oldPassword: password,
        newPassword: "weak",
        confirmPassword: "weak",
      },
    });
    await call("/api/auth/change-password", 403, {
      method: "POST",
      cookie: staffCookie,
      origin: "https://invalid.example",
      body: {
        oldPassword: password,
        newPassword: nextPassword,
        confirmPassword: nextPassword,
      },
    });
    const change = await call("/api/auth/change-password", 200, {
      method: "POST",
      cookie: staffCookie,
      body: {
        oldPassword: password,
        newPassword: nextPassword,
        confirmPassword: nextPassword,
      },
    });
    assert.ok(/Max-Age=0/i.test(change.headers.get("set-cookie")));
    await call("/api/auth/profile", 401, { cookie: staffCookie });
    staffCookie = await login(officer, nextPassword);
    assert.equal(
      (await json("/api/auth/profile", 200, { cookie: staffCookie }))
        .mustChangePassword,
      false,
    );
    assert.equal(
      (await json("/api/bao-cao", 200, { cookie: staffCookie })).meta.total,
      0,
    );

    const [total] = await db.query("SELECT COUNT(*) n FROM training_programs");
    await db.query(
      "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
      [officer.id],
    );
    let report = await json("/api/bao-cao?limit=100", 200, {
      cookie: staffCookie,
    });
    assert.equal(report.meta.total, Number(total.n));
    const [students] = await db.query(
      "SELECT COUNT(DISTINCT a.student_id) n FROM student_program_assignments a JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id WHERE a.assignment_status='ACTIVE'",
    );
    assert.equal(report.summary.tongHocVien, Number(students.n));
    for (const mode of ["ORG_UNIT", "MAJOR", "PROGRAM"]) {
      await db.query("DELETE FROM user_scopes WHERE user_id=?", [officer.id]);
      const column = {
        ORG_UNIT: "organizational_unit_id",
        MAJOR: "major_id",
        PROGRAM: "program_id",
      }[mode];
      await db.query(
        `INSERT INTO user_scopes (user_id,scope_type,${column}) VALUES (?,?,1)`,
        [officer.id, mode],
      );
      report = await json("/api/bao-cao?limit=100", 200, {
        cookie: staffCookie,
      });
      const where =
        mode === "ORG_UNIT"
          ? "p.managing_unit_id IN (SELECT descendant_id FROM organizational_unit_closure WHERE ancestor_id=1)"
          : mode === "MAJOR"
            ? "p.major_id=1"
            : "p.id=1";
      const expected = await db.query(
        "SELECT CAST(p.id AS CHAR) id FROM training_programs p WHERE " + where,
      );
      assert.deepEqual(
        report.data.map((x) => x.id).sort(),
        expected.map((x) => x.id).sort(),
        mode + " scope",
      );
      const excel = await call("/api/bao-cao/xuat-excel", 200, {
        cookie: staffCookie,
      });
      const wb = new Workbook();
      await wb.xlsx.load(Buffer.from(await excel.arrayBuffer()));
      assert.equal(wb.worksheets[0].rowCount, expected.length + 1);
    }
    await db.query(
      "DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code='TRAINING_OFFICER' AND p.permission_code='PROGRAM_READ'",
    );
    removedReadGrant = true;
    await call("/api/bao-cao", 403, { cookie: staffCookie });
    await db.query(
      "INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='PROGRAM_READ' WHERE r.role_code='TRAINING_OFFICER'",
    );
    removedReadGrant = false;

    const unionReader = await account("union_reader", "LECTURER");
    await db.query(
      "INSERT INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE role_code='LECTURER'",
      [admin.id],
    );
    grantSnapshot = await db.query(
      "SELECT rp.role_id,rp.permission_id FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code IN ('ADMIN','LECTURER') AND p.permission_code='USER_MANAGE'",
    );
    await db.query(
      "DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code IN ('ADMIN','LECTURER') AND p.permission_code='USER_MANAGE'",
    );
    await db.query(
      "INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='USER_MANAGE' WHERE r.role_code='LECTURER'",
    );
    await call("/api/admin/nguoi-dung", 200);
    const unionCookie = await login(unionReader);
    await call("/api/admin/nguoi-dung", 403, { cookie: unionCookie });
    await db.query(
      "DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code IN ('ADMIN','LECTURER') AND p.permission_code='USER_MANAGE'",
    );
    for (const row of grantSnapshot)
      await db.query(
        "INSERT INTO role_permissions (role_id,permission_id) VALUES (?,?)",
        [row.role_id, row.permission_id],
      );
    grantSnapshot = null;

    const lockUser = await account("lock", "STUDENT");
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        call("/api/auth/login", 401, {
          method: "POST",
          cookie: "",
          body: {
            identifier: lockUser.username,
            password: "IncorrectPassword123!",
          },
        }),
      ),
    );
    assert.equal(attempts.length, 5);
    let [locked] = await db.query(
      "SELECT failed_login_count,locked_until FROM users WHERE id=?",
      [lockUser.id],
    );
    assert.equal(locked.failed_login_count, 5);
    assert.ok(locked.locked_until > new Date());
    await call("/api/auth/login", 401, {
      method: "POST",
      cookie: "",
      body: { identifier: lockUser.username, password },
    });
    await db.query(
      "UPDATE users SET locked_until=TIMESTAMPADD(SECOND,-1,UTC_TIMESTAMP(6)) WHERE id=?",
      [lockUser.id],
    );
    await call("/api/auth/login", 401, {
      method: "POST",
      cookie: "",
      body: {
        identifier: lockUser.username,
        password: "IncorrectPassword123!",
      },
    });
    [locked] = await db.query(
      "SELECT failed_login_count,locked_until FROM users WHERE id=?",
      [lockUser.id],
    );
    assert.equal(locked.failed_login_count, 1);
    assert.equal(locked.locked_until, null);
    await login(lockUser);
    const [clean] = await db.query(
      "SELECT failed_login_count FROM users WHERE id=?",
      [lockUser.id],
    );
    assert.equal(clean.failed_login_count, 0);

    const policyRows = await db.query(
      "SELECT setting_key,setting_value FROM system_settings WHERE setting_key='account.password_min_length'",
    );
    policyBefore = policyRows;
    await db.query(
      "UPDATE system_settings SET setting_value='12' WHERE setting_key='account.password_min_length'",
    );
    assert.equal(
      (await json("/api/auth/password-policy")).passwordMinLength,
      12,
    );
    await db.query(
      "UPDATE system_settings SET setting_value=? WHERE setting_key='account.password_min_length'",
      [policyRows[0].setting_value],
    );
    policyBefore = null;
    const security = new (require(
      root + "/dist/modules/identity/infrastructure/auth-security.repository",
    ).MysqlAuthSecurityRepository)(db);
    const resetOne = crypto.randomBytes(32).toString("hex"),
      resetTwo = crypto.randomBytes(32).toString("hex");
    const hash = (value) =>
      crypto.createHash("sha256").update(value).digest("hex");
    assert.equal(
      await security.createReset(
        officer.id,
        hash(resetOne),
        new Date(Date.now() + 60000),
      ),
      true,
    );
    assert.equal(
      await security.createReset(
        officer.id,
        hash(resetTwo),
        new Date(Date.now() + 60000),
      ),
      false,
    );
    const [issued] = await db.query(
      "SELECT TIMESTAMPDIFF(SECOND,created_at,UTC_TIMESTAMP()) age FROM password_reset_tokens WHERE token_hash=?",
      [hash(resetOne)],
    );
    assert.ok(Math.abs(issued.age) < 5, "Reset token timestamps use UTC");
    await db.query(
      "UPDATE password_reset_tokens SET created_at=TIMESTAMPADD(SECOND,-61,UTC_TIMESTAMP()) WHERE token_hash=?",
      [hash(resetOne)],
    );
    assert.equal(
      await security.createReset(
        officer.id,
        hash(resetTwo),
        new Date(Date.now() + 60000),
      ),
      true,
    );
    await call("/api/auth/reset-password", 400, {
      method: "POST",
      cookie: "",
      body: {
        token: resetOne,
        newPassword: "ThirdPassword789!",
        confirmPassword: "ThirdPassword789!",
      },
    });
    const unknownReset = await json("/api/auth/forgot-password", 200, {
      method: "POST",
      cookie: "",
      body: { email: marker + "_missing@example.invalid" },
    });
    await db.query("UPDATE users SET account_status='DISABLED' WHERE id=?", [
      lockUser.id,
    ]);
    const disabledReset = await json("/api/auth/forgot-password", 200, {
      method: "POST",
      cookie: "",
      body: { email: lockUser.username + "@example.invalid" },
    });
    assert.deepEqual(unknownReset, disabledReset);
    await call("/api/auth/forgot-password", 400, {
      method: "POST",
      cookie: "",
      body: { email: "invalid-email" },
    });

    const oldStudentCookie = await login(student);
    let token = await rawToken(student.id, true);
    await call("/api/auth/reset-password", 400, {
      method: "POST",
      cookie: "",
      body: { token, newPassword: nextPassword, confirmPassword: nextPassword },
    });
    token = await rawToken(student.id);
    await call("/api/auth/reset-password", 400, {
      method: "POST",
      cookie: "",
      body: {
        token,
        newPassword: nextPassword,
        confirmPassword: "DifferentConfirmation123!",
      },
    });
    const outcomes = await Promise.all(
      [0, 1].map(() =>
        fetch(base + "/api/auth/reset-password", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            newPassword: nextPassword,
            confirmPassword: nextPassword,
          }),
        }),
      ),
    );
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 400]);
    checks += 2;
    await call("/api/auth/reset-password", 400, {
      method: "POST",
      cookie: "",
      body: {
        token,
        newPassword: "AnotherPassword123!",
        confirmPassword: "AnotherPassword123!",
      },
    });
    await call("/api/auth/profile", 401, { cookie: oldStudentCookie });
    await call("/api/auth/login", 401, {
      method: "POST",
      cookie: "",
      body: { identifier: student.username, password },
    });
    const resetCookie = await login(student, nextPassword);
    const [stored] = await db.query(
      "SELECT password_hash,must_change_password FROM users WHERE id=?",
      [student.id],
    );
    assert.ok(await bcrypt.compare(nextPassword, stored.password_hash));
    assert.equal(stored.must_change_password, 0);
    const logout = await call("/api/auth/logout", 200, {
      method: "POST",
      cookie: resetCookie,
      body: {},
    });
    assert.ok(/Max-Age=0/i.test(logout.headers.get("set-cookie")));
    await call("/api/auth/profile", 401, { cookie: resetCookie });

    const input = {
      username: marker + "_created",
      password,
      confirmPassword: password,
      hoTen: marker,
      email: marker + "_created@example.invalid",
      donViId: "1",
      vaiTro: "CAN_BO_DAO_TAO",
      trangThai: true,
      scopeMode: "UNIT",
    };
    const created = await json("/api/admin/nguoi-dung", 201, {
      method: "POST",
      body: input,
    });
    userIds.push(created.id);
    const [scope] = await db.query(
      "SELECT scope_type,organizational_unit_id FROM user_scopes WHERE user_id=?",
      [created.id],
    );
    assert.equal(scope.scope_type, "ORG_UNIT");
    assert.equal(String(scope.organizational_unit_id), "1");
    const temporary = await login({ username: input.username, password });
    assert.equal(
      (await json("/api/auth/profile", 200, { cookie: temporary }))
        .mustChangePassword,
      true,
    );
    const profile = {
      hoTen: input.hoTen,
      email: input.email,
      donViId: "1",
      vaiTro: input.vaiTro,
      trangThai: false,
      scopeMode: "KEEP",
    };
    await call("/api/admin/nguoi-dung/" + created.id, 200, {
      method: "PUT",
      body: profile,
    });
    await call("/api/auth/profile", 401, { cookie: temporary });
    await call("/api/admin/nguoi-dung/" + created.id, 200, {
      method: "PUT",
      body: { ...profile, trangThai: true },
    });
    await call("/api/auth/profile", 401, { cookie: temporary });

    const users = await json("/api/admin/nguoi-dung?limit=100");
    const sqlUsers = await db.query(
      "SELECT CAST(id AS CHAR) id,username,full_name,email FROM users WHERE deleted_at IS NULL ORDER BY id DESC",
    );
    assert.equal(users.meta.total, sqlUsers.length);
    for (const user of sqlUsers) {
      const item = users.data.find((row) => row.id === user.id);
      assert.equal(item.username, user.username);
      assert.equal(item.hoTen, user.full_name);
      assert.equal(item.email, user.email || "");
      assert.ok(!("password_hash" in item) && !("passwordHash" in item));
    }
    const categories = await json("/api/admin/master-data?limit=100");
    const expectedCategories = await db.query(
      "SELECT CONCAT('KHOA_QUAN_LY:',id) id FROM organizational_units UNION ALL SELECT CONCAT('BAC_DAO_TAO:',id) id FROM education_levels UNION ALL SELECT CONCAT('KHOI_KIEN_THUC:',id) id FROM knowledge_blocks",
    );
    assert.deepEqual(
      categories.data.map((x) => x.id).sort(),
      expectedCategories.map((x) => x.id).sort(),
    );
    const reports = await json("/api/bao-cao?limit=100");
    const expectedReports = await db.query(
      "SELECT CAST(p.id AS CHAR) id,p.program_code,COALESCE(v.program_name_snapshot,p.program_name) program_name,e.level_name,u.unit_name FROM training_programs p JOIN education_levels e ON e.id=p.education_level_id JOIN organizational_units u ON u.id=p.managing_unit_id LEFT JOIN program_versions v ON v.id=(SELECT vv.id FROM program_versions vv WHERE vv.program_id=p.id ORDER BY vv.cohort_year DESC,vv.created_at DESC,vv.id DESC LIMIT 1)",
    );
    for (const row of expectedReports) {
      const item = reports.data.find((x) => x.id === row.id);
      assert.equal(item.maCTDT, row.program_code);
      assert.equal(item.tenCTDT, row.program_name);
      assert.equal(item.bacDaoTao, row.level_name);
      assert.equal(item.khoaQuanLy, row.unit_name);
    }
    await call("/api/admin/nguoi-dung/" + admin.id, 200, {
      method: "PUT",
      body: {
        hoTen: admin.username,
        email: marker + "_admin_changed@example.invalid",
        donViId: "",
        vaiTro: "QUAN_TRI",
        trangThai: true,
        scopeMode: "KEEP",
      },
    });
    await call("/api/auth/profile", 401, { cookie: adminCookie });
    adminCookie = await login(admin);
    const adminProfile = await json("/api/auth/profile");
    assert.equal(adminProfile.orgUnitId, null);

    const audits = await db.query(
      "SELECT reason,old_value,new_value FROM audit_logs WHERE actor_id IN (" +
        userIds.map(() => "?").join(",") +
        ")",
      userIds,
    );
    const auditText = JSON.stringify(audits);
    assert.ok(
      !auditText.includes(password) &&
        !auditText.includes(nextPassword) &&
        !auditText.includes(token),
    );
    console.log(
      JSON.stringify({
        integration: "auth-rbac-report-sql passed",
        checks,
        audits: audits.length,
        marker,
      }),
    );
  } finally {
    if (db.isInitialized) {
      if (grantSnapshot) {
        await db.query(
          "DELETE rp FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code IN ('ADMIN','LECTURER') AND p.permission_code='USER_MANAGE'",
        );
        for (const row of grantSnapshot)
          await db.query(
            "INSERT INTO role_permissions (role_id,permission_id) VALUES (?,?)",
            [row.role_id, row.permission_id],
          );
      }
      if (policyBefore)
        for (const row of policyBefore)
          await db.query(
            "UPDATE system_settings SET setting_value=? WHERE setting_key=?",
            [row.setting_value, row.setting_key],
          );
      if (removedReadGrant)
        await db.query(
          "INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p ON p.permission_code='PROGRAM_READ' WHERE r.role_code='TRAINING_OFFICER'",
        );
      for (const id of userIds) {
        await db.query(
          "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
          [id],
        );
        await db.query("DELETE FROM user_scopes WHERE user_id=?", [id]);
        await db.query("DELETE FROM user_roles WHERE user_id=?", [id]);
        await db.query(
          "UPDATE users SET deleted_at=UTC_TIMESTAMP(6),account_status='DISABLED' WHERE id=?",
          [id],
        );
      }
      await db.destroy();
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
 
