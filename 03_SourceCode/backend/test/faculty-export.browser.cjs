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
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(process.env.MAJOR_BROWSER_FIXTURE), "exports.json"),
    "utf8",
  ),
);
async function workbookDownload(page, button) {
  const wait = page.waitForEvent("download");
  await button.click();
  const download = await wait;
  assert.equal(await download.failure(), null);
  checks++;
  const book = new Workbook();
  await book.xlsx.load(fs.readFileSync(await download.path()));
  return book;
}
async function run() {
  browser = await chromium.launch({ headless: true });
  const a = await login(f.admin),
    page = a.page;
  await page.goto(f.base + "/dashboard/admin/khoa");
  await expect(
    page.getByRole("heading", { name: "Quản lý Khoa", exact: true }),
  ).toBeVisible();
  checks++;
  await page.getByRole("button", { name: "Thêm khoa", exact: true }).click();
  const code = "UI_FAC_" + Date.now();
  await page.getByLabel("Mã khoa", { exact: true }).fill(code);
  await page.getByLabel("Tên khoa", { exact: true }).fill("Khoa thử " + code);
  await page
    .getByLabel("Mô tả khoa", { exact: true })
    .fill("Kiểm thử trình duyệt");
  await page.getByRole("button", { name: "Lưu khoa", exact: true }).click();
  await expect(page.getByText("Đã thêm khoa.", { exact: true })).toBeVisible();
  checks++;
  await page.getByLabel("Tìm khoa", { exact: true }).fill(code);
  let row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toBeVisible();
  checks++;
  await page.reload();
  await page.getByLabel("Tìm khoa", { exact: true }).fill(code);
  await expect(row).toBeVisible();
  checks++;
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await page
    .getByLabel("Tên khoa", { exact: true })
    .fill("Khoa đã sửa " + code);
  await page
    .getByLabel("Trạng thái khoa", { exact: true })
    .selectOption("INACTIVE");
  await page.getByRole("button", { name: "Lưu khoa", exact: true }).click();
  await expect(row).toContainText("Ngừng hoạt động");
  checks++;
  await page
    .getByLabel("Lọc trạng thái khoa", { exact: true })
    .selectOption("ACTIVE");
  await expect(row).toHaveCount(0);
  checks++;
  await page
    .getByLabel("Lọc trạng thái khoa", { exact: true })
    .selectOption("INACTIVE");
  await expect(row).toContainText("Khoa đã sửa " + code);
  checks++;
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await expect(
    page.getByText("Đã xóa khoa chưa sử dụng.", { exact: true }),
  ).toBeVisible();
  checks++;
  await page.getByLabel("Tìm khoa", { exact: true }).fill("FIT");
  await page
    .getByLabel("Lọc trạng thái khoa", { exact: true })
    .selectOption("ALL");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Khoa Công nghệ Thông tin" })
      .getByRole("button", { name: "Xóa", exact: true }),
  ).toBeDisabled();
  checks++;
  await page.screenshot({
    path: "/tmp/ctdt-major-review/faculties.png",
    fullPage: true,
  });
  await page.goto(f.base + "/dashboard/chuong-trinh-dao-tao/2/build");
  await expect(
    page.getByRole("button", {
      name: "Xuất Excel hướng đang xem",
      exact: true,
    }),
  ).toHaveCount(0);
  checks++;
  await a.context.close();
  const o = await login(f.officer),
    op = o.page;
  await op.goto(f.base + "/dashboard/danh-muc-hoc-phan");
  await op.getByLabel("Tìm học phần", { exact: true }).fill(fixture.mark);
  await op.getByLabel("Lọc đơn vị", { exact: true }).selectOption("1");
  await op
    .getByLabel("Lọc trạng thái", { exact: true })
    .selectOption("INACTIVE");
  await expect(
    op.getByRole("row").filter({ hasText: fixture.mark }),
  ).toHaveCount(1);
  let book = await workbookDownload(
    op,
    op.getByRole("button", { name: "Xuất Excel danh mục", exact: true }),
  );
  assert.equal(book.getWorksheet("Danh muc hoc phan").rowCount, 2);
  checks++;
  await op.getByLabel("Lọc trạng thái", { exact: true }).selectOption("ALL");
  await expect(
    op.getByRole("row").filter({ hasText: fixture.mark }),
  ).toHaveCount(20);
  book = await workbookDownload(
    op,
    op.getByRole("button", { name: "Xuất Excel danh mục", exact: true }),
  );
  assert.equal(book.getWorksheet("Danh muc hoc phan").rowCount, 24);
  checks++;
  await op.goto(f.base + "/dashboard/chuong-trinh-dao-tao/2/build");
  await op.getByRole("button", { name: "Hướng ứng dụng", exact: true }).click();
  book = await workbookDownload(
    op,
    op.getByRole("button", { name: "Xuất Excel hướng đang xem", exact: true }),
  );
  assert.equal(
    book.getWorksheet("Huong dao tao").getRow(2).getCell(2).value,
    "APPLICATION",
  );
  assert.equal(book.getWorksheet("Huong dao tao").rowCount, 2);
  checks++;
  await op
    .getByRole("button", { name: "Hướng nghiên cứu", exact: true })
    .click();
  book = await workbookDownload(
    op,
    op.getByRole("button", { name: "Xuất Excel hướng đang xem", exact: true }),
  );
  assert.equal(
    book.getWorksheet("Huong dao tao").getRow(2).getCell(2).value,
    "RESEARCH",
  );
  checks++;
  await op.goto(f.base + "/dashboard/admin/khoa");
  await expect(
    op.getByRole("button", { name: "Thêm khoa", exact: true }),
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
