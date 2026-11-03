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
async function run() {
  const probe = await fetch(f.base + "/api/auth/profile", {
    headers: { Cookie: f.admin.cookie },
  });
  assert.equal(probe.status, 200);
  assert.equal((await probe.json()).username, f.admin.username);
  checks++;
  browser = await chromium.launch({ headless: true });
  const a = await login(f.admin),
    page = a.page;
  await page.goto(f.base + "/dashboard/admin/nganh-dao-tao");
  await expect(
    page.getByRole("heading", { name: "Quản lý Ngành đào tạo" }),
  ).toBeVisible();
  checks++;
  await expect(
    page.getByRole("link", { name: "Ngành đào tạo", exact: true }),
  ).toBeVisible();
  checks++;
  const code = "BROWSER_MAJOR_" + Date.now();
  await page
    .getByRole("button", { name: "Thêm ngành đào tạo", exact: true })
    .click();
  await page.getByLabel("Mã ngành", { exact: true }).fill(code);
  await page
    .getByLabel("Tên ngành", { exact: true })
    .fill("Ngành Sư phạm kiểm thử trình duyệt");
  await page
    .getByLabel("Đơn vị quản lý ngành", { exact: true })
    .selectOption(f.unitId);
  await page
    .getByRole("button", { name: "Lưu ngành đào tạo", exact: true })
    .click();
  await expect(
    page.getByText("Đã thêm ngành đào tạo.", { exact: true }),
  ).toBeVisible();
  checks++;
  await page.getByLabel("Tìm ngành đào tạo", { exact: true }).fill(code);
  await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(1);
  checks++;
  await page.reload();
  await page.getByLabel("Tìm ngành đào tạo", { exact: true }).fill(code);
  let row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toBeVisible();
  checks++;
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await page
    .getByLabel("Tên ngành", { exact: true })
    .fill("Ngành Sư phạm đã sửa " + code);
  await page
    .getByLabel("Trạng thái ngành", { exact: true })
    .selectOption("INACTIVE");
  await page
    .getByRole("button", { name: "Lưu ngành đào tạo", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: code })).toContainText(
    "Ngừng sử dụng",
  );
  checks++;
  await page
    .getByLabel("Lọc trạng thái ngành", { exact: true })
    .selectOption("ACTIVE");
  await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(0);
  checks++;
  await page
    .getByLabel("Lọc trạng thái ngành", { exact: true })
    .selectOption("INACTIVE");
  row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText("Ngành Sư phạm đã sửa " + code);
  checks++;
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await page
    .getByLabel("Trạng thái ngành", { exact: true })
    .selectOption("ACTIVE");
  await page
    .getByRole("button", { name: "Lưu ngành đào tạo", exact: true })
    .click();
  await page
    .getByLabel("Lọc trạng thái ngành", { exact: true })
    .selectOption("ALL");
  await expect(page.getByRole("row").filter({ hasText: code })).toContainText(
    "Hoạt động",
  );
  checks++;
  // The existing Program form must read the major created through this UI.
  const sp = await login(f.spOfficer);
  await sp.page.goto(f.base + "/dashboard/chuong-trinh-dao-tao/tao-moi");
  await sp.page.locator("#unit").selectOption(f.unitId);
  await expect(
    sp.page
      .locator("#major option")
      .filter({ hasText: "Ngành Sư phạm đã sửa " + code }),
  ).toHaveCount(1);
  checks++;
  await sp.page.goto(f.base + "/dashboard/admin/nganh-dao-tao");
  await expect(
    sp.page.getByRole("heading", { name: "Quản lý Ngành đào tạo" }),
  ).toHaveCount(0);
  checks++;
  await page
    .getByLabel("Tìm ngành đào tạo", { exact: true })
    .fill(f.usedMajor.majorCode);
  row = page.getByRole("row").filter({ hasText: f.usedMajor.majorCode });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Xóa", exact: true }),
  ).toBeDisabled();
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByLabel("Mã ngành", { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel("Đơn vị quản lý ngành", { exact: true }),
  ).toBeDisabled();
  checks++;
  await page.getByRole("button", { name: "Hủy bỏ", exact: true }).click();
  await page.getByLabel("Tìm ngành đào tạo", { exact: true }).fill(code);
  row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(
    page.getByText("Đã xóa ngành chưa được sử dụng.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(0);
  checks++;
  await page
    .getByLabel("Tìm ngành đào tạo", { exact: true })
    .fill(f.usedMajor.majorCode);
  await expect(
    page.getByRole("row").filter({ hasText: f.usedMajor.majorCode }),
  ).toBeVisible();
  await page.screenshot({
    path: process.env.MAJOR_SCREENSHOT || "/tmp/ctdt-major-review/majors.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  checks++;
  await a.context.close();
  await sp.context.close();
  console.log(JSON.stringify({ result: "PASS", browserChecks: checks }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => browser?.close());
