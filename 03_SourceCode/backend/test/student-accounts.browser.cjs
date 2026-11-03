/* Playwright operates only on the prepared disposable SQL clone. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "accounts.json",
    ),
  ),
);
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  fixture.database !== process.env.DB_DATABASE ||
  !/^ctdt_major_review_\d+$/.test(fixture.database)
)
  throw Error("Disposable clone required");
fixture.mark = "ui_" + Date.now();
const { chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
  ),
  { Workbook } = require("exceljs");
let checks = 0;
const eq = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1050 },
    });
    await context.addCookies([
      {
        name: "ctdt_access_token",
        value: fixture.admin.cookie.split("=").slice(1).join("="),
        url: fixture.base,
      },
    ]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(fixture.base + "/dashboard/admin/lop-hoc-vien");
    await page
      .getByRole("heading", { name: "Lớp & Tài khoản học viên", exact: true })
      .waitFor();
    eq(
      await page
        .getByRole("link", { name: "Lớp & Tài khoản học viên" })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "Tạo lớp quản lý", exact: true })
      .click();
    await page
      .getByLabel("Mã lớp quản lý", { exact: true })
      .fill(fixture.mark + "_BROWSER");
    await page
      .getByLabel("Tên lớp quản lý", { exact: true })
      .fill("Lớp kiểm thử giao diện");
    await page
      .getByLabel("Phiên bản và hướng CTĐT", { exact: true })
      .selectOption(fixture.track.id);
    eq(
      await page.getByLabel("Khóa nhập học", { exact: true }).inputValue(),
      "2025",
    );
    await page.getByRole("button", { name: "Lưu lớp", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const row = page
      .getByRole("row")
      .filter({ hasText: fixture.mark + "_BROWSER" });
    await row.waitFor();
    await row.getByRole("button", { name: "Nhập Excel", exact: true }).click();
    let dialog = page.getByRole("dialog");
    const td = page.waitForEvent("download");
    await dialog
      .getByRole("button", { name: "Tải mẫu học viên", exact: true })
      .click();
    const template = await td;
    eq(template.suggestedFilename().endsWith(".xlsx"), true);
    const templateBook = new Workbook();
    await templateBook.xlsx.readFile(await template.path());
    eq(
      templateBook.getWorksheet("Hoc vien").getRow(1).getCell(1).text,
      "Mã học viên",
    );
    const b = new Workbook(),
      sheet = b.addWorksheet("Hoc vien");
    sheet.addRow(["Mã học viên", "Họ và tên", "Email", "Tên đăng nhập"]);
    const code = fixture.mark + "_UI1";
    sheet.addRow([
      code,
      "Học viên kiểm thử giao diện",
      fixture.mark + "_ui1@example.invalid",
      "",
    ]);
    sheet.addRow([code, "Trùng mã", fixture.mark + "_ui2@example.invalid", ""]);
    let buffer = Buffer.from(await b.xlsx.writeBuffer());
    await dialog
      .getByLabel("File học viên Excel")
      .setInputFiles({
        name: "hoc-vien.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer,
      });
    await dialog
      .getByRole("button", { name: "Kiểm tra file học viên", exact: true })
      .click();
    await dialog.getByText("Chưa lưu dữ liệu.", { exact: false }).waitFor();
    eq(
      await dialog
        .getByRole("button", { name: /tài khoản & tải bàn giao/ })
        .isDisabled(),
      true,
    );
    sheet.spliceRows(3, 1);
    buffer = Buffer.from(await b.xlsx.writeBuffer());
    await dialog
      .getByLabel("File học viên Excel")
      .setInputFiles({
        name: "hoc-vien.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer,
      });
    await dialog
      .getByRole("button", { name: "Kiểm tra file học viên", exact: true })
      .click();
    await dialog.getByText("Có thể tạo tài khoản.", { exact: false }).waitFor();
    eq(
      await dialog.getByRole("button", { name: /Tạo 1 tài khoản/ }).isEnabled(),
      true,
    );
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /Tạo 1 tài khoản/ }).click();
    const handoff = await download;
    eq(
      handoff.suggestedFilename(),
      "Ban_Giao_Tai_Khoan_" + fixture.mark + "_BROWSER.xlsx",
    );
    const wb = new Workbook();
    await wb.xlsx.readFile(await handoff.path());
    const credential = {
      username: wb.getWorksheet("Ban giao tai khoan").getRow(2).getCell(4).text,
      password: wb.getWorksheet("Ban giao tai khoan").getRow(2).getCell(6).text,
    };
    eq(credential.username, code.toLowerCase());
    eq(credential.password.length >= 16, true);
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await row.getByRole("button", { name: "Xem học viên" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByText(code, { exact: true }).waitFor();
    eq(
      (await dialog.getByText("MIT-2025-v1", { exact: false }).count()) > 0,
      true,
    );
    eq(
      await dialog.getByText(credential.password, { exact: false }).count(),
      0,
    );
    await page.keyboard.press("Escape");
    eq(
      await row.getByRole("button", { name: "Xóa", exact: true }).isDisabled(),
      true,
    );
    await page.screenshot({
      path: "/tmp/ctdt-major-review/student-accounts.png",
      fullPage: true,
    });
    // A fresh browser exercises the password handoff, forced change, and own curriculum.
    const studentContext = await browser.newContext();
    const sp = await studentContext.newPage();
    await sp.goto(fixture.base + "/dang-nhap");
    await sp.getByLabel("Tên đăng nhập hoặc email").fill(credential.username);
    await sp.getByLabel("Mật khẩu", { exact: true }).fill(credential.password);
    await sp.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await sp.waitForURL("**/doi-mat-khau");
    checks++;
    const changed = "BrowserChangedAccount123!";
    await sp
      .getByLabel("Mật khẩu hiện tại", { exact: true })
      .fill(credential.password);
    await sp.getByLabel("Mật khẩu mới", { exact: true }).fill(changed);
    await sp.getByLabel("Xác nhận mật khẩu mới", { exact: true }).fill(changed);
    await sp.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await sp.getByRole("link", { name: "Đăng nhập lại", exact: true }).click();
    await sp.getByLabel("Tên đăng nhập hoặc email").fill(credential.username);
    await sp.getByLabel("Mật khẩu", { exact: true }).fill(changed);
    await sp.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await sp.waitForURL(fixture.base + "/");
    await sp
      .getByRole("link", { name: "CTĐT của tôi", exact: false })
      .first()
      .click();
    await sp.waitForURL("**/ctdt-cua-toi");
    await sp
      .getByRole("region", { name: "Hồ sơ học viên", exact: true })
      .getByText(code + " — Học viên kiểm thử giao diện", { exact: true })
      .waitFor();
    await sp
      .getByRole("region", { name: "CTĐT được phân công", exact: true })
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
      "own version and track",
    );
    eq(
      await sp.getByRole("link", { name: "Dashboard", exact: false }).count(),
      0,
    );
    await sp.goto(fixture.base + "/dashboard/admin/lop-hoc-vien");
    await sp.waitForURL("**/ctdt-cua-toi");
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
    await dp.goto(fixture.base + "/dashboard");
    eq(
      await dp.getByRole("link", { name: "Lớp & Tài khoản học viên" }).count(),
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
