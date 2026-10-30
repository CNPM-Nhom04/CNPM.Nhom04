/* Optional Playwright check. Only consumes fixtures created by isolated integration. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
if (
  process.env.TOPIC_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_topic_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error("Disposable topic DB required.");
const fixture = JSON.parse(
  fs.readFileSync(
    process.env.TOPIC_BROWSER_FIXTURE || "/tmp/ctdt-topic-browser.json",
    "utf8",
  ),
);
assert.equal(fixture.name, process.env.DB_DATABASE);
const playwrightModule = process.env.PLAYWRIGHT_MODULE_PATH || "playwright";
const { chromium } = require(playwrightModule);
const { expect } = require(playwrightModule + "/test");
const base = fixture.base,
  path = "/dashboard/de-tai-luan-van",
  runtimeErrors = [];
async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const officerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await officerContext.newPage();
    page.on("pageerror", (e) => runtimeErrors.push(e.message));
    await page.goto(base + "/dang-nhap");
    await page.locator("#identifier").fill(fixture.officer.username);
    await page.locator("#password").fill(fixture.officer.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await page.goto(base + path);
    await expect(
      page.getByRole("heading", {
        name: "Quản Lý Đề Tài Luận Văn & Phân Công GVHD",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Thêm hồ sơ GVHD", exact: true })
      .click();
    const profile = page.getByRole("dialog", {
      name: "Thêm hồ sơ GVHD thực tế",
    });
    const code = fixture.marker + "_browser_" + Date.now();
    await profile.getByLabel("Đơn vị quản lý hồ sơ").selectOption("1");
    await profile.getByLabel("code", { exact: true }).fill(code);
    await profile
      .getByLabel("fullName", { exact: true })
      .fill("Browser SQL supervisor");
    await profile
      .getByRole("button", { name: "Lưu hồ sơ GVHD", exact: true })
      .click();
    await expect(profile).toBeHidden();
    await page.getByRole("button", { name: "Hồ sơ GVHD", exact: true }).click();
    await page.getByLabel("Tìm kiếm", { exact: true }).fill(code);
    await expect(page.getByRole("row").filter({ hasText: code })).toBeVisible();
    await page
      .getByRole("button", { name: "Đăng ký đề tài mới", exact: true })
      .click();
    const form = page.getByRole("dialog", {
      name: "Đăng ký đề tài và phân công GVHD",
    });
    await form
      .getByLabel("Tìm học viên", { exact: true })
      .fill(fixture.student.studentCode);
    const students = form.getByLabel("Học viên và phân CTĐT", { exact: true });
    await expect(
      students.locator('option[value="' + fixture.student.assignmentId + '"]'),
    ).toBeAttached();
    await students.selectOption(fixture.student.assignmentId);
    await expect(
      form.locator("strong").filter({ hasText: fixture.student.studentName }),
    ).toBeVisible();
    await form.getByLabel("Tìm GVHD", { exact: true }).fill(code);
    const supervisors = form.getByLabel("Giảng viên hướng dẫn", {
      exact: true,
    });
    await expect(supervisors).toBeEnabled();
    await expect(supervisors.locator("option")).toHaveCount(2);
    await supervisors.selectOption({
      label: code + " — Browser SQL supervisor",
    });
    const title = fixture.marker + " browser thesis";
    await form.getByLabel("Tên đề tài", { exact: true }).fill(title);
    await form
      .getByLabel("Mô tả", { exact: true })
      .fill("Actual browser workflow on disposable SQL only.");
    await form
      .getByRole("button", { name: "Lưu và gửi duyệt", exact: true })
      .click();
    await expect(form).toBeHidden();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Đề tài luận văn", exact: true })
      .click();
    await page.getByLabel("Tìm kiếm", { exact: true }).fill(title);
    await expect(
      page.getByRole("row").filter({ hasText: title }),
    ).toBeVisible();
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Duyệt đề tài", exact: true }),
    ).toHaveCount(0);
    async function openAs(actor) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: "ctdt_access_token",
          value: actor.token,
          url: base,
          httpOnly: true,
        },
      ]);
      const p = await context.newPage();
      p.on("pageerror", (e) => runtimeErrors.push(e.message));
      await p.goto(base + path);
      return { context, p };
    }
    const reviewer = await openAs(fixture.reviewer);
    await reviewer.p.getByLabel("Tìm kiếm", { exact: true }).fill(title);
    await reviewer.p
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    await reviewer.p
      .getByRole("button", { name: "Duyệt đề tài", exact: true })
      .click();
    const approval = reviewer.p.getByRole("dialog", {
      name: "Duyệt đề tài",
      exact: true,
    });
    await approval
      .getByLabel("Số hồ sơ", { exact: true })
      .fill("BROWSER-TEST-DOC");
    await approval
      .getByLabel("Nội dung xác nhận", { exact: true })
      .fill("Verified actual browser approval documents");
    await approval
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(approval).toBeHidden();
    await expect(
      reviewer.p.getByRole("button", {
        name: "Xác nhận nghiệm thu",
        exact: true,
      }),
    ).toBeDisabled();
    await reviewer.p.screenshot({
      path: "/tmp/ctdt-topic-browser/topic-ui.png",
      fullPage: true,
    });
    // Defense selector must display the approved topic as read-only.
    await page.goto(base + "/dashboard/bao-ve-luan-van");
    await page
      .getByRole("button", { name: /Lập Lịch|Lập lịch|Thêm Lịch|Thêm lịch/ })
      .first()
      .click();
    await page.locator("#student-search").fill(fixture.student.studentCode);
    await expect(
      page.locator(
        '#student option[value="' + fixture.student.studentCode + '"]',
      ),
    ).toBeAttached();
    await page.locator("#student").selectOption(fixture.student.studentCode);
    await expect(page.locator("#tenDeTai")).toHaveValue(title);
    await expect(page.locator("#tenDeTai")).toHaveAttribute("readonly", "");
    const admin = await openAs(fixture.admin);
    await expect(
      admin.p.getByRole("button", { name: "Đăng ký đề tài mới", exact: true }),
    ).toHaveCount(0);
    await expect(
      admin.p.getByRole("button", { name: "Thêm hồ sơ GVHD", exact: true }),
    ).toHaveCount(0);
    const fbe = await openAs(fixture.fbe);
    await fbe.p.getByLabel("Tìm kiếm", { exact: true }).fill(title);
    await expect(
      fbe.p.getByRole("cell", { name: title, exact: true }),
    ).toHaveCount(0);
    assert.deepEqual(runtimeErrors, []);
    console.log(
      "PASS: browser login, supervisor creation, topic persistence, approval, scope, read-only roles and defense topic selection; no runtime errors.",
    );
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
