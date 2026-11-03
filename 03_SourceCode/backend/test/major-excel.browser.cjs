/* Real UI on disposable SQL clone. Requires the integration fixture first. */
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
  throw Error("Disposable major database required.");
const f = JSON.parse(
  fs.readFileSync(
    process.env.MAJOR_BROWSER_FIXTURE || "/tmp/ctdt-major-browser.json",
    "utf8",
  ),
);
assert.equal(f.database, process.env.DB_DATABASE);
const mod = process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
  { chromium } = require(mod),
  { expect } = require(mod + "/test");
let browser;
const errors = [];
let checks = 0;
async function login(account) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(f.base + "/dang-nhap");
  await page.locator("#identifier").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/dashboard"));
  return { context, page };
}
const { Workbook } = require("exceljs");
async function file(rows) {
  const book = new Workbook(),
    sheet = book.addWorksheet("Nganh dao tao");
  sheet.addRow(["Mã ngành", "Tên ngành", "Mã đơn vị quản lý", "Trạng thái"]);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
async function run() {
  browser = await chromium.launch({ headless: true });
  const a = await login(f.admin),
    page = a.page;
  await page.goto(f.base + "/dashboard/admin/nganh-dao-tao");
  await page.getByRole("button", { name: "Nhập Excel", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Nhập ngành đào tạo từ Excel",
  });
  await expect(dialog).toBeVisible();
  checks++;
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Tải file mẫu Excel" }).click();
  assert.equal((await download).suggestedFilename(), "Mau_Nganh_Dao_Tao.xlsx");
  checks++;
  const code = "UI_XLSX_" + Date.now(),
    buffer = await file([[code, "Ngành Excel " + code, "FIT", "ACTIVE"]]);
  await dialog
    .getByLabel("Chọn file Excel")
    .setInputFiles({
      name: "nganh.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  await expect(
    dialog.getByRole("button", { name: /Xác nhận nhập/ }),
  ).toBeDisabled();
  checks++;
  await dialog
    .getByRole("button", { name: "Kiểm tra file", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Hợp lệ: 1 · Lỗi: 0");
  checks++;
  await expect(dialog.getByRole("row").filter({ hasText: code })).toContainText(
    "Khoa Công nghệ Thông tin",
  );
  checks++;
  await dialog.getByRole("button", { name: /Xác nhận nhập 1 ngành/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Đã nhập 1 ngành đào tạo từ Excel.", { exact: true }),
  ).toBeVisible();
  checks++;
  await page.reload();
  await page.getByLabel("Tìm ngành đào tạo", { exact: true }).fill(code);
  await expect(page.getByRole("row").filter({ hasText: code })).toContainText(
    "Ngành Excel " + code,
  );
  checks++;
  await page.getByRole("button", { name: "Nhập Excel", exact: true }).click();
  const bad = await file([
    [code, "Trùng SQL", "FIT", "ACTIVE"],
    [code + "_BAD", "Sai đơn vị", "UNKNOWN", "ACTIVE"],
  ]);
  await dialog
    .getByLabel("Chọn file Excel")
    .setInputFiles({
      name: "loi.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: bad,
    });
  await dialog
    .getByRole("button", { name: "Kiểm tra file", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Lỗi: 2");
  checks++;
  await expect(
    dialog.getByText("Mã ngành đã tồn tại trong CSDL.", { exact: true }),
  ).toBeVisible();
  checks++;
  await expect(
    dialog.getByRole("button", { name: /Xác nhận nhập/ }),
  ).toBeDisabled();
  checks++;
  await page.screenshot({
    path: "/tmp/ctdt-major-review/major-excel.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await a.context.close();
  const o = await login(f.officer);
  await o.page.goto(f.base + "/dashboard/admin/nganh-dao-tao");
  await expect(
    o.page.getByRole("button", { name: "Nhập Excel", exact: true }),
  ).toHaveCount(0);
  checks++;
  await o.context.close();
  assert.deepEqual(errors, []);
  checks++;
  console.log(JSON.stringify({ result: "PASS", checks }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => browser?.close());
