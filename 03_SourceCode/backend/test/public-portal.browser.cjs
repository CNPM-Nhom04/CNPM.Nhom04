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

const portal = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(process.env.MAJOR_BROWSER_FIXTURE), "portal.json"),
    "utf8",
  ),
);
async function run() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(f.base + "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tiếp nối tri thức.",
  );
  checks++;
  await expect(
    page.getByRole("link", { name: "Đăng nhập", exact: true }),
  ).toHaveAttribute("href", "/dang-nhap");
  checks++;
  await expect(
    page.locator(
      'img[alt="Minh họa khuôn viên học tập với giảng đường và cây xanh"]',
    ),
  ).toBeVisible();
  checks++;
  await page.screenshot({
    path: "/tmp/ctdt-major-review/public-home-desktop.png",
    fullPage: true,
  });
  await page.goto(f.base + "/chuong-trinh-dao-tao");
  await expect(
    page.getByRole("heading", { level: 1, name: "Chương trình đào tạo" }),
  ).toBeVisible();
  await page.getByLabel("Tìm chương trình đào tạo").fill("MIT");
  await expect(page.getByRole("article").first()).toContainText("MIT");
  checks++;
  await page.goto(f.base + "/chuong-trinh-dao-tao/2");
  await page
    .getByRole("button", { name: "Hướng ứng dụng", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hướng ứng dụng", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  checks++;
  await page
    .getByRole("button", { name: "Hướng nghiên cứu", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("INF699");
  checks++;
  await page.goto(f.base + "/quy-che");
  await page.getByLabel("Tìm văn bản").fill(portal.mark);
  await expect(page.getByRole("article")).toHaveCount(2);
  checks++;
  await page.getByLabel("Loại văn bản").selectOption("REGULATION");
  await expect(page.getByRole("article")).toHaveCount(1);
  checks++;
  await page.goto(f.base + "/dang-ky-thong-tin");
  await page
    .getByLabel("Thông tin tuyển sinh cần nhận", { exact: true })
    .selectOption("2");
  const browserEmail = "browser_" + Date.now() + "@example.invalid";
  await page.getByLabel("Họ lót", { exact: true }).fill("Nguyễn Văn");
  await page.getByLabel("Tên", { exact: true }).fill("Kiểm thử giao diện");
  await page.getByLabel("Email", { exact: true }).fill(browserEmail);
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page.getByLabel("Ngành quan tâm", { exact: true }).selectOption("1");
  await page
    .getByLabel("Ngành đã tốt nghiệp", { exact: true })
    .fill("Công nghệ thông tin");
  await page.getByLabel("Năm tốt nghiệp", { exact: true }).fill("2020");
  await page
    .getByLabel("Nội dung cần tư vấn", { exact: true })
    .fill("Kiểm thử giao diện, không gửi email.");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Đăng ký nhận thông tin", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Đã ghi nhận yêu cầu");
  checks++;
  // Mobile menu, form and horizontal overflow checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(f.base + "/");
  await page.getByLabel("Mở menu", { exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng di động" }),
  ).toBeVisible();
  checks++;
  await page
    .getByRole("navigation", { name: "Điều hướng di động" })
    .getByRole("link", { name: "Tư vấn tuyển sinh", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Đăng ký nhận thông tin tuyển sinh",
      exact: true,
    }),
  ).toBeVisible();
  checks++;
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "mobile page must not overflow",
  );
  checks++;
  await page.goto(f.base + "/");
  await page.screenshot({
    path: "/tmp/ctdt-major-review/public-home-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "mobile homepage must not overflow",
  );
  checks++;
  await context.close();
  const a = await login(f.admin),
    ap = a.page;
  await ap.goto(f.base + "/dashboard/admin/cong-thong-tin");
  await ap
    .getByRole("button", { name: "Đăng ký nhận thông tin", exact: true })
    .click();
  await ap
    .getByLabel("Tìm trên cổng thông tin", { exact: true })
    .fill(browserEmail);
  let row = ap.getByRole("row").filter({ hasText: browserEmail });
  await expect(row).toContainText("Kiểm thử giao diện");
  checks++;
  await row
    .getByRole("button", { name: "Đánh dấu đã liên hệ", exact: true })
    .click();
  await expect(row).toContainText("Đã liên hệ");
  checks++;
  await ap
    .getByRole("button", { name: "Văn bản công khai", exact: true })
    .click();
  await ap.getByRole("button", { name: "Thêm văn bản", exact: true }).click();
  const title = "TEST — Hướng dẫn công khai UI " + Date.now();
  await ap.getByLabel("Tiêu đề văn bản").fill(title);
  await ap.getByLabel("Phân loại văn bản").selectOption("GUIDE");
  await ap.getByLabel("Trạng thái văn bản").selectOption("PUBLISHED");
  await ap.getByLabel("Liên kết văn bản").fill("https://example.org/guide.pdf");
  await ap.getByLabel("Số văn bản", { exact: true }).fill("TEST-UI");
  await ap.getByLabel("Ngày ban hành", { exact: true }).fill("2026-11-02");
  await ap
    .getByLabel("Tóm tắt văn bản")
    .fill("Văn bản kiểm thử, không dùng làm quy định.");
  await ap.getByRole("button", { name: "Lưu văn bản", exact: true }).click();
  await expect(
    ap.getByText(
      "Đã lưu văn bản. Chỉ trạng thái Công bố mới hiển thị ở trang công khai.",
      { exact: true },
    ),
  ).toBeVisible();
  checks++;
  await ap.goto(f.base + "/quy-che");
  await ap.getByLabel("Tìm văn bản").fill(title);
  await expect(ap.getByRole("article")).toContainText(title);
  checks++;
  await a.context.close();
  const o = await login(f.officer);
  await o.page.goto(f.base + "/dashboard/admin/cong-thong-tin");
  await expect(
    o.page.getByRole("button", { name: "Thêm văn bản", exact: true }),
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
