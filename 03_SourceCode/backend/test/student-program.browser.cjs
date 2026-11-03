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
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "own.json",
    ),
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
  await page.waitForURL((u) => u.pathname !== "/dang-nhap");
  return { context, page };
}

const ownPath = "/ctdt-cua-toi";
async function run() {
  browser = await chromium.launch({ headless: true });
  const guestContext = await browser.newContext(),
    guest = await guestContext.newPage();
  await guest.goto(f.base + "/");
  await expect(
    guest.getByRole("link", { name: "CTĐT của tôi", exact: true }),
  ).toHaveCount(0);
  await expect(
    guest.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  checks++;
  await guest.goto(f.base + ownPath);
  await guest.waitForURL((u) => u.pathname === "/dang-nhap");
  checks++;
  await guestContext.close();
  const app = await login(f.b),
    page = app.page;
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  checks++;
  await page.getByRole("link", { name: "CTĐT của tôi", exact: true }).click();
  await page.waitForURL(f.base + ownPath);
  await expect(page.locator("aside")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Chương trình đào tạo của tôi",
      exact: true,
    }),
  ).toBeVisible();
  checks++;
  await expect(
    page.getByRole("link", { name: "CTĐT của tôi", exact: true }),
  ).toBeVisible();
  checks++;
  await expect(
    page.getByRole("region", { name: "Hồ sơ học viên" }),
  ).toContainText("SV002");
  checks++;
  const plan = page.getByRole("region", { name: "CTĐT được phân công" });
  await expect(plan).toContainText("MIT-2025-v1");
  await expect(plan).toContainText("Hướng ứng dụng");
  checks++;
  await expect(
    page.getByRole("button", { name: "Lưu cấu trúc", exact: true }),
  ).toHaveCount(0);
  checks++;
  await page.getByLabel("Tìm học phần trong CTĐT cá nhân").fill("INF506");
  let row = page.getByRole("row").filter({ hasText: "INF506" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Bắt buộc");
  checks++;
  await page.getByLabel("Lọc tính chất học phần").selectOption("ELECTIVE");
  await expect(row).toHaveCount(0);
  checks++;
  await page.getByLabel("Lọc tính chất học phần").selectOption("ALL");
  await page.getByLabel("Tìm học phần trong CTĐT cá nhân").fill("");
  await page.reload();
  await expect(plan).toContainText("Hướng ứng dụng");
  checks++;
  await page.getByLabel("Tài khoản đang đăng nhập", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(f.base + "/");
  await expect(
    page.getByRole("link", { name: "CTĐT của tôi", exact: true }),
  ).toHaveCount(0);
  checks++;
  await page.goto(
    f.base + "/dang-nhap?next=" + encodeURIComponent("/dashboard/admin/khoa"),
  );
  await page.locator("#identifier").fill(f.c.username);
  await page.locator("#password").fill(f.c.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(f.base + "/");
  await page.getByRole("link", { name: "CTĐT của tôi", exact: true }).click();
  await page.waitForURL(f.base + ownPath);
  await expect(
    page.getByRole("region", { name: "Hồ sơ học viên" }),
  ).toContainText("SV003");
  checks++;
  await expect(plan).toContainText("Hướng nghiên cứu");
  await expect(plan).not.toContainText("Hướng ứng dụng");
  checks++;
  await page.getByLabel("Tìm học phần trong CTĐT cá nhân").fill("INF506");
  await expect(
    page.getByRole("row").filter({ hasText: "INF506" }),
  ).toContainText("Tự chọn");
  checks++;
  await page.getByLabel("Tìm học phần trong CTĐT cá nhân").fill("");
  await page
    .getByLabel("Lọc nhóm kiến thức")
    .selectOption({ label: "A — Kiến thức chung" });
  await expect(page.getByRole("row").filter({ hasText: "INF699" })).toHaveCount(
    0,
  );
  checks++;
  await page.getByLabel("Lọc nhóm kiến thức").selectOption("ALL");
  await page.locator("main").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: "/tmp/ctdt-major-review/student-program.png",
    fullPage: true,
  });
  await page.goto(f.base + "/dashboard/admin/khoa");
  await page.waitForURL(f.base + ownPath);
  await expect(
    page.getByRole("heading", {
      name: "Chương trình đào tạo của tôi",
      exact: true,
    }),
  ).toBeVisible();
  checks++;
  await app.context.close();
  const archived = await login(f.a);
  await archived.page
    .getByRole("link", { name: "CTĐT của tôi", exact: true })
    .click();
  await archived.page.waitForURL(f.base + ownPath);
  await expect(
    archived.page.getByRole("region", { name: "CTĐT được phân công" }),
  ).toContainText("MIT-2024-v1");
  await expect(
    archived.page.getByRole("region", { name: "CTĐT được phân công" }),
  ).toContainText("Phiên bản đã lưu trữ");
  checks++;
  await archived.context.close();
  const unlinked = await login(f.unlinked);
  await unlinked.page
    .getByRole("link", { name: "CTĐT của tôi", exact: true })
    .click();
  await unlinked.page.waitForURL(f.base + ownPath);
  await expect(
    unlinked.page.getByRole("heading", {
      name: "Chưa liên kết hồ sơ học viên",
      exact: true,
    }),
  ).toBeVisible();
  checks++;
  await unlinked.context.close();
  const unassigned = await login(f.unassigned);
  await unassigned.page
    .getByRole("link", { name: "CTĐT của tôi", exact: true })
    .click();
  await unassigned.page.waitForURL(f.base + ownPath);
  await expect(
    unassigned.page.getByRole("heading", {
      name: "Chưa có phân công CTĐT",
      exact: true,
    }),
  ).toBeVisible();
  checks++;
  await unassigned.context.close();
  const admin = await login(f.admin);
  await expect(
    admin.page.getByRole("link", { name: "← Trang chủ", exact: true }),
  ).toBeVisible();
  checks++;
  for (const removed of [
    "/dashboard/dang-ky-hoc-phan",
    "/dashboard/sinh-vien/dang-ky",
  ]) {
    const response = await admin.context.request.get(f.base + removed);
    assert.equal(response.status(), 404);
    checks++;
  }
  await expect(
    admin.page.getByRole("link", {
      name: "Đợt đăng ký & Xử lý lớp",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    admin.page.getByRole("link", { name: "Cổng học viên (ĐKHP)", exact: true }),
  ).toHaveCount(0);
  checks++;
  await admin.page
    .getByRole("link", { name: "← Trang chủ", exact: true })
    .click();
  await admin.page.waitForURL(f.base + "/");
  await expect(
    admin.page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  checks++;
  await admin.page
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await admin.page.waitForURL(f.base + "/dashboard");
  checks++;
  await admin.page.goto(f.base + ownPath);
  await expect(
    admin.page.getByText("Tài khoản không có quyền tra cứu CTĐT cá nhân.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    admin.page.getByRole("link", { name: "CTĐT của tôi", exact: true }),
  ).toHaveCount(0);
  checks++;
  await admin.context.close();
  const officer = await login(f.officer);
  await officer.page
    .getByRole("link", { name: "← Trang chủ", exact: true })
    .click();
  await expect(
    officer.page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  checks++;
  await officer.page
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await officer.page.waitForURL(f.base + "/dashboard");
  checks++;
  await officer.context.close();
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
