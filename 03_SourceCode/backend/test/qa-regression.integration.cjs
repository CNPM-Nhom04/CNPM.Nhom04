/* Real HTTP + MariaDB regressions. Run ONLY on a disposable CI database. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs/promises");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.QA_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_(?:ci|qa_)/.test(process.env.DB_DATABASE || "")
) {
  throw new Error(
    "Set QA_TEST_ALLOW_WRITES=1 and use a disposable ctdt_ci/ctdt_qa_* database.",
  );
}
const mysql = require("mysql2/promise"),
  bcrypt = require("bcryptjs");
const base = process.env.FRONTEND_URL || "http://127.0.0.1:43100";
const browserOrigin = process.env.QA_BROWSER_ORIGIN || base;
const marker = "qa_" + crypto.randomBytes(6).toString("hex");
const checks = [];
async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: "Z",
  });
  try {
    async function http(
      route,
      status,
      { method = "GET", body, cookie, origin = browserOrigin } = {},
    ) {
      const response = await fetch(base + route, {
        method,
        headers: {
          ...(origin ? { Origin: origin } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      const payload = await response.json().catch(() => null);
      assert.equal(
        response.status,
        status,
        `${method} ${route}: ${JSON.stringify(payload)}`,
      );
      checks.push({ method, route, status });
      return { response, payload };
    }
    await http("/api/auth/login", 400, { method: "POST", body: {} });
    await http("/api/auth/login", 403, {
      method: "POST",
      body: {},
      origin: "https://outside.example",
    });
    await http("/api/auth/login", 403, {
      method: "POST",
      body: {},
      origin: null,
    });
    const [[level]] = await db.query(
      "SELECT id FROM education_levels WHERE level_code='MASTER'",
    );
    assert(level);
    async function fixture(suffix) {
      const [unit] = await db.query(
        "INSERT INTO organizational_units(unit_code,unit_name,unit_type) VALUES(?,?,'FACULTY')",
        [marker + suffix, "QA faculty " + suffix],
      );
      const [major] = await db.query(
        "INSERT INTO majors(organizational_unit_id,major_code,major_name) VALUES(?,?,?)",
        [unit.insertId, marker + suffix, "QA major " + suffix],
      );
      const username = marker + suffix,
        password = crypto.randomBytes(18).toString("hex");
      const [user] = await db.query(
        "INSERT INTO users(organizational_unit_id,username,password_hash,full_name,account_status) VALUES(?,?,?,?,'ACTIVE')",
        [unit.insertId, username, await bcrypt.hash(password, 4), "QA officer"],
      );
      await db.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='TRAINING_OFFICER'",
        [user.insertId],
      );
      await db.query(
        "INSERT INTO user_scopes(user_id,scope_type,organizational_unit_id) VALUES(?,'ORG_UNIT',?)",
        [user.insertId, unit.insertId],
      );
      const login = await http("/api/auth/login", 200, {
        method: "POST",
        body: { identifier: username, password },
      });
      const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
      assert(cookie);
      return {
        cookie,
        unitId: String(unit.insertId),
        majorId: String(major.insertId),
      };
    }
    const a = await fixture("a"),
      b = await fixture("b");
    const exportResponse = await fetch(base + "/api/excel-forms/template", {
      method: "POST",
      headers: {
        Origin: browserOrigin,
        Cookie: a.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context: "qa-upload-regression",
        recordLabel: "QA",
        fields: [
          {
            id: "title",
            label: "Tên",
            type: "text",
            value: "",
            readonly: false,
            required: true,
          },
        ],
      }),
    });
    assert.equal(exportResponse.status, 200);
    checks.push({ route: "/api/excel-forms/template", status: 200 });
    const bytes = await exportResponse.arrayBuffer(),
      form = new FormData();
    form.append("file", new Blob([bytes]), "qa.xlsx");
    const readResponse = await fetch(base + "/api/excel-forms/read", {
      method: "POST",
      headers: { Origin: browserOrigin, Cookie: a.cookie },
      body: form,
    });
    assert.equal(readResponse.status, 200);
    const read = await readResponse.json();
    assert.equal(read.context, "qa-upload-regression");
    assert.equal(read.fields[0].id, "title");
    checks.push({ route: "/api/excel-forms/read", status: 200 });

    const body = (actor, suffix) => ({
      maCTDT: marker + suffix,
      tenCTDT: "QA new program " + suffix,
      tenTiengAnh: "QA program",
      educationLevelId: String(level.id),
      managingUnitId: actor.unitId,
      majorId: actor.majorId,
      hinhThucDaoTao: "CHINH_QUY",
      thoiGianDaoTao: "2 năm",
      khoaTuyenSinh: "2026 - 2028",
      tongTinChiYeuCau: 60,
      chuanDauRaTiengAnh: "B2",
      chuanDauRaTinHoc: "Chuẩn kỹ năng sử dụng CNTT cơ bản",
      moTa: "Disposable CI regression fixture",
    });
    await http("/api/chuong-trinh-dao-tao", 401);
    await http("/api/chuong-trinh-dao-tao", 400, {
      method: "POST",
      body: {},
      cookie: a.cookie,
    });
    const one = await http("/api/chuong-trinh-dao-tao", 201, {
      method: "POST",
      body: body(a, "a"),
      cookie: a.cookie,
    });
    assert.equal(one.payload.status, "DRAFT");
    assert.equal(one.payload.tracks.length, 2);
    assert(one.payload.tracks.every((t) => t.groups.length === 4));
    await http("/api/chuong-trinh-dao-tao", 409, {
      method: "POST",
      body: body(a, "a"),
      cookie: a.cookie,
    });
    await http("/api/chuong-trinh-dao-tao", 403, {
      method: "POST",
      body: body(b, "outside"),
      cookie: a.cookie,
    });
    const two = await http("/api/chuong-trinh-dao-tao", 201, {
      method: "POST",
      body: body(b, "b"),
      cookie: b.cookie,
    });
    await http("/api/chuong-trinh-dao-tao/" + two.payload.id, 404, {
      cookie: a.cookie,
    });
    const list = await http("/api/chuong-trinh-dao-tao?limit=100", 200, {
      cookie: a.cookie,
    });
    assert(list.payload.data.some((p) => p.id === one.payload.id));
    assert(!list.payload.data.some((p) => p.id === two.payload.id));
    const publicList = await http(
      "/api/chuong-trinh-dao-tao?selectedCatalog=PUBLIC&limit=100",
      200,
      { cookie: a.cookie },
    );
    assert(publicList.payload.data.every((p) => p.sourceReadOnly));
    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) count FROM migrations",
    );
    assert(Number(count) >= 17);
    const output = path.resolve(__dirname, "../test-results");
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(
      path.join(output, "qa-integration.json"),
      JSON.stringify(
        { passed: true, checks, migrations: Number(count) },
        null,
        2,
      ),
    );
    console.log(
      `QA integration: ${checks.length} HTTP checks passed; real create + scope isolation + Origin rejection verified.`,
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
