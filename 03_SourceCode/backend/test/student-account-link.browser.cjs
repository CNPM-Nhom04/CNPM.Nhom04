const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "link.json",
    ),
  ),
);
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  fixture.database !== process.env.DB_DATABASE ||
  !/^ctdt_major_review_\d+$/.test(fixture.database)
)
  throw Error("Disposable SQL clone required");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
let checks = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
    });
    await ctx.addCookies([
      {
        name: "ctdt_access_token",
        value: fixture.admin.cookie.split("=").slice(1).join("="),
        url: fixture.base,
      },
    ]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(fixture.base + "/dashboard/admin/lop-hoc-vien");
    const row = page.getByRole("row").filter({ hasText: fixture.live.code });
    await row.waitFor();
    await row
      .getByRole("button", { name: "Liên kết tài khoản", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    eq(
      await dialog
        .getByRole("button", { name: "Lưu liên kết", exact: true })
        .isDisabled(),
      true,
    );
    await dialog
      .getByLabel("Tìm tài khoản để liên kết", { exact: true })
      .fill(fixture.ui.username);
    await dialog
      .locator('option[value="' + fixture.ui.id + '"]')
      .waitFor({ state: "attached" });
    await dialog
      .getByLabel("Tài khoản học viên để liên kết", { exact: true })
      .selectOption(fixture.ui.id);
    await dialog
      .getByLabel("Tìm hồ sơ để liên kết", { exact: true })
      .fill(fixture.mark + "_UI");
    await dialog
      .locator('option[value="' + fixture.uiProfileId + '"]')
      .waitFor({ state: "attached" });
    await dialog
      .getByLabel("Hồ sơ học viên để liên kết", { exact: true })
      .selectOption(fixture.uiProfileId);
    await dialog
      .getByLabel("Căn cứ xác minh liên kết", { exact: true })
      .fill("TEST: đối chiếu danh sách bàn giao và xác nhận cùng người");
    eq(
      await dialog
        .getByRole("button", { name: "Lưu liên kết", exact: true })
        .isDisabled(),
      true,
    );
    await dialog.getByRole("checkbox").check();
    eq(
      await dialog
        .getByRole("button", { name: "Lưu liên kết", exact: true })
        .isEnabled(),
      true,
    );
    await dialog
      .getByRole("button", { name: "Lưu liên kết", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .getByText("Đã liên kết tài khoản, hồ sơ và CTĐT của lớp.", {
        exact: false,
      })
      .waitFor();
    checks++;
    await row
      .getByRole("button", { name: "Xem học viên", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByText(fixture.mark + "_UI", { exact: true }).waitFor();
    eq(
      await dialog
        .getByRole("cell")
        .filter({ hasText: fixture.ui.username })
        .count(),
      1,
    );
    await page.keyboard.press("Escape");
    // New profile for an already-created account, preserving mandatory password change.
    await row
      .getByRole("button", { name: "Liên kết tài khoản", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Tìm tài khoản để liên kết", { exact: true })
      .fill(fixture.uiNew.username);
    await dialog
      .locator('option[value="' + fixture.uiNew.id + '"]')
      .waitFor({ state: "attached" });
    await dialog
      .getByLabel("Tài khoản học viên để liên kết", { exact: true })
      .selectOption(fixture.uiNew.id);
    await dialog
      .getByLabel("Cách liên kết hồ sơ", { exact: true })
      .selectOption("NEW");
    await dialog
      .getByLabel("Mã học viên mới để liên kết", { exact: true })
      .fill(fixture.mark + "_UI_NEW");
    await dialog
      .getByLabel("Căn cứ xác minh liên kết", { exact: true })
      .fill("TEST: hồ sơ chưa có, đã kiểm tra danh sách lớp");
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Lưu liên kết", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await row
      .getByRole("button", { name: "Xem học viên", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByText(fixture.mark + "_UI_NEW", { exact: true }).waitFor();
    eq(
      await dialog
        .getByText("Cần đổi mật khẩu lần đầu", { exact: true })
        .count(),
      1,
    );
    await page.keyboard.press("Escape");
    const sc = await browser.newContext();
    const sp = await sc.newPage();
    await sp.goto(fixture.base + "/dang-nhap");
    await sp.getByLabel("Tên đăng nhập hoặc email").fill(fixture.ui.username);
    await sp.getByLabel("Mật khẩu", { exact: true }).fill(fixture.ui.password);
    await sp.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await sp.waitForURL(fixture.base + "/");
    await sp
      .getByRole("link", { name: "CTĐT của tôi", exact: false })
      .first()
      .click();
    await sp.waitForURL("**/ctdt-cua-toi");
    await sp
      .getByRole("region", { name: "Hồ sơ học viên", exact: true })
      .getByText(fixture.mark + "_UI — Hồ sơ đã xác minh", { exact: true })
      .waitFor();
    eq(
      await sp
        .getByRole("region", { name: "CTĐT được phân công", exact: true })
        .innerText()
        .then(
          (t) =>
            t.toLowerCase().includes("mit-2025-v1") &&
            /hướng nghiên cứu/i.test(t),
        ),
      true,
    );
    eq(
      await sp.getByRole("link", { name: "Dashboard", exact: false }).count(),
      0,
    );
    const nc = await browser.newContext();
    await nc.addCookies([
      {
        name: "ctdt_access_token",
        value: fixture.uiNew.cookie.split("=").slice(1).join("="),
        url: fixture.base,
      },
    ]);
    const np = await nc.newPage();
    await np.goto(fixture.base + "/ctdt-cua-toi");
    await np.waitForURL("**/doi-mat-khau");
    checks++;
    const denied = await browser.newContext();
    await denied.addCookies([
      {
        name: "ctdt_access_token",
        value: fixture.officer.cookie.split("=").slice(1).join("="),
        url: fixture.base,
      },
    ]);
    const dp = await denied.newPage();
    await dp.goto(fixture.base + "/dashboard/admin/lop-hoc-vien");
    await dp
      .getByText("Bạn không có quyền truy cập trang này.", { exact: true })
      .waitFor();
    checks++;
    eq(
      await dp
        .getByRole("button", { name: "Liên kết tài khoản", exact: true })
        .count(),
      0,
    );
    eq(errors, []);
    console.log(JSON.stringify({ result: "PASS", checks }));
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
