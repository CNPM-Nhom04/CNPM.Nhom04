/* Local development integration test. Creates one temporary officer account and marked defenses.
   Removes only its own defense rows, soft-deletes its account, and retains immutable audit rows. */
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const { DataSource } = require("typeorm");
const { JwtService } = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const base = process.env.FRONTEND_URL || "http://localhost:3000";
const marker = "defense_smoke_" + Date.now();
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const jwt = new JwtService({ secret: process.env.JWT_SECRET });
let checks = 0,
  actorId,
  adminCookie,
  staffCookie;
const createdIds = new Set();
async function call(
  url,
  expected = 200,
  { method = "GET", body, cookie = staffCookie, origin = base } = {},
) {
  const response = await fetch(base + url, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (response.status !== expected) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      method +
        " " +
        url +
        ": expected " +
        expected +
        ", got " +
        response.status +
        " " +
        JSON.stringify(payload),
    );
  }
  checks++;
  return response;
}
async function json(url, status, options) {
  return (await call(url, status, options)).json();
}
async function create(body) {
  const item = await json("/api/bao-ve-luan-van", 201, {
    method: "POST",
    body,
  });
  createdIds.add(item.id);
  return item;
}
(async () => {
  try {
    await db.initialize();
    const [admin] = await db.query(`SELECT CAST(u.id AS CHAR) AS id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
      WHERE r.role_code = 'ADMIN' AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL LIMIT 1`);
    assert.ok(admin, "Need an existing active ADMIN");
    adminCookie =
      "ctdt_access_token=" + jwt.sign({ sub: admin.id }, { expiresIn: "10m" });
    const options = await json("/api/bao-ve-luan-van/hoc-vien", 200, {
      cookie: adminCookie,
    });
    assert.ok(
      options.data.length,
      "Need an eligible ACTIVE postgraduate student without a pending defense",
    );
    const student = options.data[0];
    const password = "DefenseSmokePassword123!";
    await db.query(
      "INSERT INTO users (username, email, password_hash, full_name, account_status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [
        marker,
        marker + "@example.invalid",
        await bcrypt.hash(password, 4),
        "Test " + marker,
      ],
    );
    // Retrieve by the unique marker because DataSource.query uses a connection pool.
    [{ id: actorId }] = await db.query(
      "SELECT CAST(id AS CHAR) AS id FROM users WHERE username = ?",
      [marker],
    );
    await db.query(
      "INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE role_code = 'TRAINING_OFFICER'",
      [actorId],
    );
    await db.query(
      "INSERT INTO user_scopes (user_id, scope_type) VALUES (?, 'GLOBAL')",
      [actorId],
    );
    await call("/dang-nhap", 200, { cookie: "" });
    await call("/dashboard/bao-ve-luan-van", 200, { cookie: "" });
    await call("/api/bao-ve-luan-van", 401, { cookie: "" });
    await call("/api/bao-ve-luan-van", 401, {
      cookie: "ctdt_access_token=invalid",
    });
    await call("/api/bao-ve-luan-van", 403, {
      method: "POST",
      body: {},
      cookie: adminCookie,
      origin: "https://invalid.example",
    });
    const login = await call("/api/auth/login", 200, {
      method: "POST",
      cookie: "",
      body: { identifier: marker, password },
    });
    const cookieHeader = login.headers
      .getSetCookie()
      .find((value) => value.startsWith("ctdt_access_token="));
    assert.ok(cookieHeader && /HttpOnly/i.test(cookieHeader));
    staffCookie = cookieHeader.split(";")[0];
    const empty = await json("/api/bao-ve-luan-van?searchTerm=" + marker, 200);
    assert.equal(empty.meta.total, 0);
    await call("/api/bao-ve-luan-van?page=0", 400);
    await call("/api/bao-ve-luan-van?selectedStatus=INVALID", 400);
    await call("/api/bao-ve-luan-van/bad-id", 404);
    const body = {
      maHocVien: student.maHocVien,
      tenDeTai: marker,
      ngayBaoVe: "2000-01-01",
      diaDiem: "Phòng test",
      chuTichHoidong: "Chủ tịch test",
      phanBien: "Phản biện test",
      thuKy: "Thư ký test",
    };
    await call("/api/bao-ve-luan-van", 400, {
      method: "POST",
      body: { ...body, ngayBaoVe: "2026-02-30" },
    });
    await call("/api/bao-ve-luan-van", 400, {
      method: "POST",
      body: { ...body, tenDeTai: "   " },
    });
    await call("/api/bao-ve-luan-van", 404, {
      method: "POST",
      body: { ...body, maHocVien: "__no_such_student__" },
    });
    // Two simultaneous scheduling attempts must not both succeed.
    const attempts = await Promise.all(
      [0, 1].map(() =>
        fetch(base + "/api/bao-ve-luan-van", {
          method: "POST",
          headers: {
            Origin: base,
            Cookie: staffCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, hoTen: "Spoofed name" }),
        }),
      ),
    );
    assert.deepEqual(
      attempts.map((response) => response.status).sort(),
      [201, 409],
    );
    checks += 2;
    const created = await attempts
      .find((response) => response.status === 201)
      .json();
    createdIds.add(created.id);
    assert.equal(created.hoTen, student.hoTen);
    assert.equal(created.chuyenNganh, student.chuyenNganh);
    assert.equal(created.diemTrungBinh, null);
    const detail = await json("/api/bao-ve-luan-van/" + created.id, 200);
    assert.equal(detail.phanBien, body.phanBien);
    assert.equal(detail.thuKy, body.thuKy);
    // Scope removal must take effect even while the JWT is still valid.
    await db.query("DELETE FROM user_scopes WHERE user_id = ?", [actorId]);
    assert.equal((await json("/api/bao-ve-luan-van", 200)).meta.total, 0);
    assert.equal(
      (await json("/api/bao-ve-luan-van/hoc-vien", 200)).meta.total,
      0,
    );
    await call("/api/bao-ve-luan-van/" + created.id, 404);
    await call("/api/bao-ve-luan-van/" + created.id + "/ket-qua", 404, {
      method: "POST",
      body: { diemTrungBinh: 8 },
    });
    await db.query(
      "INSERT INTO user_scopes (user_id, scope_type) VALUES (?, 'GLOBAL')",
      [actorId],
    );
    for (const score of [-1, 10.01, 8.666, null, "8.6"]) {
      await call("/api/bao-ve-luan-van/" + created.id + "/ket-qua", 400, {
        method: "POST",
        body: { diemTrungBinh: score },
      });
    }
    const resultAttempts = await Promise.all(
      [0, 1].map(() =>
        fetch(base + "/api/bao-ve-luan-van/" + created.id + "/ket-qua", {
          method: "POST",
          headers: {
            Origin: base,
            Cookie: staffCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ diemTrungBinh: 5.5 }),
        }),
      ),
    );
    assert.deepEqual(
      resultAttempts.map((response) => response.status).sort(),
      [201, 409],
    );
    checks += 2;
    const passed = await json("/api/bao-ve-luan-van/" + created.id, 200);
    assert.equal(passed.trangThai, "DA_DAT");
    await call("/api/bao-ve-luan-van/" + created.id + "/ket-qua", 409, {
      method: "POST",
      body: { diemTrungBinh: 9 },
    });
    const failed = await create(body);
    const zero = await json(
      "/api/bao-ve-luan-van/" + failed.id + "/ket-qua",
      201,
      { method: "POST", body: { diemTrungBinh: 0 } },
    );
    assert.equal(zero.diemTrungBinh, 0);
    assert.equal(zero.trangThai, "CHUA_DAT");
    const future = await create({ ...body, ngayBaoVe: "2999-01-01" });
    await call("/api/bao-ve-luan-van/" + future.id + "/ket-qua", 400, {
      method: "POST",
      body: { diemTrungBinh: 9 },
    });
    const failedList = await json(
      "/api/bao-ve-luan-van?searchTerm=" + marker + "&selectedStatus=CHUA_DAT",
      200,
    );
    assert.equal(failedList.meta.total, 1);
    const page = await json(
      "/api/bao-ve-luan-van?searchTerm=" + marker + "&page=2&limit=1",
      200,
    );
    assert.equal(page.data.length, 1);
    assert.equal(page.meta.total, 3);
    // A student cannot obtain staff access by putting ADMIN in a signed JWT.
    const [studentUser] =
      await db.query(`SELECT CAST(ur.user_id AS CHAR) AS id FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      JOIN users u ON u.id=ur.user_id WHERE r.role_code='STUDENT' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1`);
    if (studentUser)
      await call("/api/bao-ve-luan-van", 403, {
        cookie:
          "ctdt_access_token=" +
          jwt.sign({ sub: studentUser.id, role: "ADMIN" }, { expiresIn: "2m" }),
      });
    await db.query(
      "UPDATE users SET account_status='DISABLED', deleted_at=UTC_TIMESTAMP(6) WHERE id=? AND username=?",
      [actorId, marker],
    );
    await call("/api/bao-ve-luan-van", 401);
    const [audit] = await db.query(
      "SELECT COUNT(*) AS total FROM audit_logs WHERE actor_id=? AND entity_type='thesis_defense'",
      [actorId],
    );
    assert.ok(Number(audit.total) >= 5);
  } finally {
    try {
      for (const id of createdIds)
        await db.query(
          "DELETE FROM thesis_defenses WHERE id=? AND thesis_title=?",
          [id, marker],
        );
      // Also catches a created fixture if a concurrent assertion failed before its ID was collected.
      if (actorId) {
        await db.query(
          "DELETE FROM thesis_defenses WHERE created_by=? AND thesis_title=?",
          [actorId, marker],
        );
        await db.query("DELETE FROM user_scopes WHERE user_id=?", [actorId]);
        await db.query(
          "UPDATE users SET account_status='DISABLED', deleted_at=UTC_TIMESTAMP(6) WHERE id=? AND username=?",
          [actorId, marker],
        );
      }
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  }
  console.log(
    JSON.stringify({
      integration: "passed",
      checks,
      marker,
      cleanup:
        "Only test defenses removed; test user soft-deleted; audit retained.",
    }),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
