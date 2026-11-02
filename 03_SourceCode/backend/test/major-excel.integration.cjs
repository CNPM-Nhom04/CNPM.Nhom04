/* Only use a disposable clone created for major.integration.cjs. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_major_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error("Disposable clone required");
const f = JSON.parse(
  fs.readFileSync(
    process.env.MAJOR_BROWSER_FIXTURE || "/tmp/ctdt-major-browser.json",
    "utf8",
  ),
);
assert.equal(f.database, process.env.DB_DATABASE);
const { DataSource } = require("typeorm"),
  { Workbook } = require("exceljs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const prefix = f.base + "/api/admin/nganh-dao-tao/import/",
  mark = "excel_" + Date.now();
let checks = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function request(
  route,
  buffer,
  hash,
  expected = 201,
  actor = f.admin,
  origin = f.base,
  name = "majors.xlsx",
) {
  const form = new FormData();
  form.append("file", new Blob([buffer]), name);
  if (hash !== undefined) form.append("previewHash", hash);
  const response = await fetch(prefix + route, {
    method: "POST",
    headers: { Origin: origin, ...(actor ? { Cookie: actor.cookie } : {}) },
    body: form,
  });
  const value = await response.json();
  eq(response.status, expected, JSON.stringify(value));
  return value;
}
async function workbook(rows, change) {
  const b = new Workbook(),
    s = b.addWorksheet("Nganh dao tao");
  s.addRow(["Mã ngành", "Tên ngành", "Mã đơn vị quản lý", "Trạng thái"]);
  rows.forEach((row) => s.addRow(row));
  change?.(b);
  return Buffer.from(await b.xlsx.writeBuffer());
}
async function count() {
  return Number((await db.query("SELECT COUNT(*) n FROM majors"))[0].n);
}
async function run() {
  await db.initialize();
  const template = await fetch(prefix + "mau-excel", {
    headers: { Cookie: f.admin.cookie },
  });
  eq(template.status, 200);
  const b = new Workbook();
  await b.xlsx.load(Buffer.from(await template.arrayBuffer()));
  eq(b.getWorksheet("Nganh dao tao").getRow(1).getCell(1).value, "Mã ngành");
  eq(
    b.getWorksheet("Don vi tu CSDL").getColumn(1).values.includes("FIT"),
    true,
  );
  const row = (code) => [code, "Ngành Excel kiểm thử " + code, "FIT", "ACTIVE"];
  const good = await workbook([
    row(mark + "_1"),
    [mark + "_2", "Ngành ngừng sử dụng", "FBE", "INACTIVE"],
  ]);
  await request("kiem-tra", good, undefined, 401, null);
  await request("kiem-tra", good, undefined, 403, f.officer);
  await request(
    "kiem-tra",
    good,
    undefined,
    403,
    f.admin,
    "https://outside.invalid",
  );
  const before = await count();
  const preview = await request("kiem-tra", good);
  eq(preview.canImport, true);
  eq(preview.validRows, 2);
  eq(await count(), before, "preview writes nothing");
  await request("luu", good, "0".repeat(64), 400);
  eq(await count(), before);
  eq((await request("luu", good, preview.fileHash)).created, 2);
  eq(await count(), before + 2);
  const [saved] = await db.query(
    "SELECT m.status,u.unit_code FROM majors m JOIN organizational_units u ON u.id=m.organizational_unit_id WHERE m.major_code=?",
    [mark + "_2"],
  );
  eq(saved, { status: "INACTIVE", unit_code: "FBE" });
  eq(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM audit_logs WHERE entity_type='majors' AND reason LIKE ?",
          ["Nhập Excel ngành " + mark + "%"],
        )
      )[0].n,
    ),
    2,
  );
  await request("luu", good, preview.fileHash, 409);
  eq(await count(), before + 2, "repeat blocked");
  const bad = await workbook([
    row(mark + "_1"),
    row(mark + "_dup"),
    row((mark + "_dup").toUpperCase()),
    [mark + "_unit", "Sai đơn vị", "NOT_EXISTS", "ACTIVE"],
    row(mark + "_valid"),
  ]);
  const invalid = await request("kiem-tra", bad);
  eq(invalid.canImport, false);
  eq(invalid.errorRows, 4);
  await request("luu", bad, invalid.fileHash, 409);
  eq(await count(), before + 2, "invalid file atomic");
  await request(
    "kiem-tra",
    good,
    undefined,
    400,
    f.admin,
    f.base,
    "majors.xls",
  );
  await request("kiem-tra", Buffer.from("bad"), undefined, 400);
  const formula = await workbook([
    [mark + "_formula", { formula: '"Name"', result: "Name" }, "FIT", "ACTIVE"],
  ]);
  eq((await request("kiem-tra", formula)).canImport, false);
  const race = await workbook([row(mark + "_race1"), row(mark + "_race2")]);
  const checked = await request("kiem-tra", race);
  await db.query(
    "INSERT INTO majors(major_code,major_name,organizational_unit_id) VALUES(?, 'Concurrent',1)",
    [mark + "_race2"],
  );
  await request("luu", race, checked.fileHash, 409);
  eq(
    Number(
      (
        await db.query("SELECT COUNT(*) n FROM majors WHERE major_code=?", [
          mark + "_race1",
        ])
      )[0].n,
    ),
    0,
  );
  // Failure on the second audit must roll back BOTH inserts and the first audit.
  const rollback = await workbook([row(mark + "_rb1"), row(mark + "_rb2")]);
  const rp = await request("kiem-tra", rollback);
  await db.query(
    "CREATE TRIGGER trg_major_excel_test BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.reason = 'Nhập Excel ngành " +
      mark +
      "_rb2' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_EXCEL_ROLLBACK'; END IF; END",
  );
  try {
    await request("luu", rollback, rp.fileHash, 502);
    eq(
      Number(
        (
          await db.query(
            "SELECT COUNT(*) n FROM majors WHERE major_code IN (?,?)",
            [mark + "_rb1", mark + "_rb2"],
          )
        )[0].n,
      ),
      0,
    );
    eq(
      Number(
        (
          await db.query("SELECT COUNT(*) n FROM audit_logs WHERE reason=?", [
            "Nhập Excel ngành " + mark + "_rb1",
          ])
        )[0].n,
      ),
      0,
    );
  } finally {
    await db.query("DROP TRIGGER trg_major_excel_test");
  }
  // SQL-controlled limits and units are checked again at commit.
  const unit = (
    await db.query("SELECT unit_code FROM organizational_units WHERE id=?", [
      f.unitId,
    ])
  )[0].unit_code;
  const inactive = await workbook([
    [mark + "_inactive", "Tên", unit, "ACTIVE"],
  ]);
  const ip = await request("kiem-tra", inactive);
  await db.query(
    "UPDATE organizational_units SET status='INACTIVE' WHERE id=?",
    [f.unitId],
  );
  try {
    eq((await request("kiem-tra", inactive)).canImport, false);
    await request("luu", inactive, ip.fileHash, 409);
  } finally {
    await db.query(
      "UPDATE organizational_units SET status='ACTIVE' WHERE id=?",
      [f.unitId],
    );
  }
  const original = (
    await db.query(
      "SELECT setting_value FROM system_settings WHERE setting_key='import.max_rows'",
    )
  )[0].setting_value;
  await db.query(
    "UPDATE system_settings SET setting_value='1' WHERE setting_key='import.max_rows'",
  );
  try {
    await request("kiem-tra", good, undefined, 400);
    const response = await fetch(prefix + "mau-excel", {
      headers: { Cookie: f.admin.cookie },
    });
    const small = new Workbook();
    await small.xlsx.load(Buffer.from(await response.arrayBuffer()));
    small.getWorksheet("Nganh dao tao").getRow(2).values = row(mark + "_small");
    const smallPreview = await request(
      "kiem-tra",
      Buffer.from(await small.xlsx.writeBuffer()),
    );
    eq(
      smallPreview.canImport,
      true,
      "reference/instruction sheets do not count as data rows",
    );
  } finally {
    await db.query(
      "UPDATE system_settings SET setting_value=? WHERE setting_key='import.max_rows'",
      [original],
    );
  }
  await request("kiem-tra", Buffer.alloc(5 * 1024 * 1024 + 1), undefined, 413);
  console.log(JSON.stringify({ result: "PASS", checks }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
