/* Run against local development only. Creates marked records and soft-deletes the test user.
   The immutable audit trail is intentionally retained. Does not change existing credentials. */
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const { DataSource } = require("typeorm");
const { JwtService } = require("@nestjs/jwt");
const { Workbook } = require("exceljs");
const { Readable } = require("node:stream");

const base = process.env.FRONTEND_URL || "http://localhost:3000";
const backend = process.env.ADMIN_TEST_BACKEND_URL || "http://localhost:3002";
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
let checks = 0;
let adminCookie;
const categories = new Set();
let userId;
let originalSettings;
let settingsChanged = false;
const marker = "smoke_" + Date.now();
const password = "SmokePassword_2026!";

async function call(
  url,
  expected = 200,
  { method = "GET", body, cookie = adminCookie } = {},
) {
  const response = await fetch(base + url, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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
async function json(url, expected, options) {
  return (await call(url, expected, options)).json();
}
async function category(type) {
  const body = {
    loaiDanhMuc: type,
    maDanhMuc: marker + "_" + categories.size,
    tenDanhMuc: "Kiểm thử " + marker,
    moTa: "Dữ liệu test API",
    trangThai: true,
  };
  const created = await json("/api/admin/master-data", 201, {
    method: "POST",
    body,
  });
  categories.add(created.id);
  await call("/api/admin/master-data", 409, { method: "POST", body });
  const updated = await json(
    "/api/admin/master-data/" + encodeURIComponent(created.id),
    200,
    { method: "PUT", body: { ...body, tenDanhMuc: "Cập nhật " + marker } },
  );
  assert.equal(updated.tenDanhMuc, "Cập nhật " + marker);
  return updated;
}

(async () => {
  try {
    await db.initialize();
    const [admin] = await db.query(`SELECT CAST(u.id AS CHAR) AS id FROM users u
      JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE r.role_code='ADMIN' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1`);
    assert.ok(admin, "A pre-existing active ADMIN is required");
    adminCookie =
      "ctdt_access_token=" +
      new JwtService({ secret: process.env.JWT_SECRET }).sign(
        { sub: admin.id },
        { expiresIn: "10m" },
      );
    await call("/api/admin/nguoi-dung", 401, { cookie: "" });
    for (const page of ["nguoi-dung", "master-data", "cau-hinh", "audit-log"])
      await call("/dashboard/admin/" + page, 200);
    const list = await json("/api/admin/nguoi-dung?page=1&limit=2", 200);
    assert.ok(list.data.length <= 2);
    assert.ok(
      list.data.every(
        (item) => !("passwordHash" in item) && !("password_hash" in item),
      ),
    );
    await call("/api/admin/nguoi-dung?page=0", 400);
    await call("/api/admin/nguoi-dung?selectedRole=INVALID", 400);
    await call("/api/admin/cau-hinh", 401, { method: "PUT", cookie: "" });
    const org = await category("KHOA_QUAN_LY");
    const orgId = org.id.split(":")[1];
    const options = await json("/api/admin/nguoi-dung/options", 200);
    assert.ok(options.units.some((unit) => unit.id === orgId));
    const profile = {
      hoTen: "API " + marker,
      email: marker + "@example.invalid",
      donViId: orgId,
      vaiTro: "GIANG_VIEN",
      trangThai: true,
    };
    const credentials = { ...profile, username: marker, password };
    const created = await json("/api/admin/nguoi-dung", 201, {
      method: "POST",
      body: credentials,
    });
    userId = created.id;
    assert.equal(created.donViId, orgId);
    await call("/api/admin/nguoi-dung", 409, {
      method: "POST",
      body: credentials,
    });
    await call("/api/admin/master-data/" + encodeURIComponent(org.id), 409, {
      method: "DELETE",
    });
    const login = await call("/api/auth/login", 200, {
      method: "POST",
      cookie: "",
      body: { identifier: marker, password },
    });
    const setCookie = login.headers
      .getSetCookie()
      .find((value) => value.startsWith("ctdt_access_token="));
    assert.ok(setCookie && /HttpOnly/i.test(setCookie));
    const userCookie = setCookie.split(";")[0];
    await call("/api/admin/nguoi-dung", 403, { cookie: userCookie });
    const forgedCookie =
      "ctdt_access_token=" +
      new JwtService({ secret: process.env.JWT_SECRET }).sign(
        { sub: userId, role: "ADMIN" },
        { expiresIn: "2m" },
      );
    await call("/api/admin/audit-log", 403, { cookie: forgedCookie });
    const token = userCookie.slice("ctdt_access_token=".length);
    const account = await fetch(backend + "/auth/profile", {
      headers: { Authorization: "Bearer " + token },
    });
    assert.equal((await account.json()).role, "LECTURER");
    await json("/api/admin/nguoi-dung/" + userId, 200, {
      method: "PUT",
      body: { ...profile, vaiTro: "QUAN_TRI" },
    });
    await call("/api/admin/nguoi-dung/" + userId, 409, {
      method: "DELETE",
      cookie: userCookie,
    });
    await call("/api/admin/nguoi-dung/" + userId, 409, {
      method: "PUT",
      cookie: userCookie,
      body: { ...profile, vaiTro: "GIANG_VIEN" },
    });
    await call("/api/admin/nguoi-dung/" + userId, 409, {
      method: "PUT",
      cookie: userCookie,
      body: { ...profile, vaiTro: "QUAN_TRI", trangThai: false },
    });
    await call("/api/admin/nguoi-dung/" + userId, 200, {
      method: "PUT",
      body: { ...profile, trangThai: false },
    });
    await call("/api/bao-cao", 401, { cookie: userCookie });
    await call("/api/admin/nguoi-dung", 401, { cookie: userCookie });
    await call("/api/admin/nguoi-dung/" + userId, 200, {
      method: "PUT",
      body: profile,
    });
    await category("BAC_DAO_TAO");
    await category("KHOI_KIEN_THUC");
    const masterList = await json(
      "/api/admin/master-data?searchTerm=" + marker,
      200,
    );
    assert.equal(masterList.meta.total, 3);
    originalSettings = await json("/api/admin/cau-hinh", 200);
    await call("/api/admin/cau-hinh", 400, {
      method: "PUT",
      body: { ...originalSettings, diemDatHocPhan: "11" },
    });
    await call("/api/admin/cau-hinh", 400, {
      method: "PUT",
      body: { ...originalSettings, maxTinChiHocKy: "0" },
    });
    settingsChanged = true;
    const saved = await json("/api/admin/cau-hinh", 200, {
      method: "PUT",
      body: { ...originalSettings, maxTinChiHocKy: "19" },
    });
    assert.equal(saved.maxTinChiHocKy, "19");
    assert.equal((await json("/api/admin/cau-hinh", 200)).maxTinChiHocKy, "19");
    assert.equal(
      (
        await json("/api/admin/cau-hinh/mac-dinh", 201, {
          method: "POST",
          body: {},
        })
      ).maxTinChiHocKy,
      "18",
    );
    await call("/api/admin/cau-hinh", 200, {
      method: "PUT",
      body: originalSettings,
    });
    settingsChanged = false;
    const audit = await json(
      "/api/admin/audit-log?searchTerm=" + marker + "&selectedAction=CREATE",
      200,
    );
    assert.ok(audit.meta.total >= 4);
    const attachment = await call(
      "/api/admin/audit-log/xuat-excel?searchTerm=" + marker,
      200,
    );
    assert.ok(attachment.headers.get("content-disposition").includes(".xlsx"));
    const workbook = new Workbook();
    await workbook.xlsx.read(
      Readable.from([Buffer.from(await attachment.arrayBuffer())]),
    );
    assert.ok(workbook.worksheets[0].rowCount > 1);
    await call("/api/admin/nguoi-dung/" + userId, 200, { method: "DELETE" });
    userId = null;
    await call("/api/bao-cao", 401, { cookie: userCookie });
    await call("/api/admin/nguoi-dung", 401, { cookie: userCookie });
  } catch (error) {
    console.error("Integration step failed: " + error.message);
    throw error;
  } finally {
    if (settingsChanged && originalSettings)
      await call("/api/admin/cau-hinh", 200, {
        method: "PUT",
        body: originalSettings,
      });
    if (userId)
      await call("/api/admin/nguoi-dung/" + userId, 200, { method: "DELETE" });
    try {
      // Clear only the soft-deleted test fixture association, so temporary units can be removed.
      await db.query(
        "UPDATE users SET organizational_unit_id = NULL WHERE username = ? AND email = ? AND deleted_at IS NOT NULL",
        [marker, marker + "@example.invalid"],
      );
      for (const id of categories) {
        const response = await fetch(
          base + "/api/admin/master-data/" + encodeURIComponent(id),
          {
            method: "DELETE",
            headers: { Origin: base, Cookie: adminCookie },
            signal: AbortSignal.timeout(60000),
          },
        );
        if (response.status !== 200 && response.status !== 404)
          throw new Error("Fixture cleanup failed: " + response.status);
        checks++;
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
      note: "Test user soft-deleted; immutable audit retained.",
    }),
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
