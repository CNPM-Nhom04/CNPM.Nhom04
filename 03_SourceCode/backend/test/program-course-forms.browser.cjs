const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const f = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "forms.json",
    ),
  ),
);
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  f.database !== process.env.DB_DATABASE ||
  !/^ctdt_major_review_\d+$/.test(f.database)
)
  throw Error("Disposable database required");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
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
    const ctx = await browser.newContext({
      viewport: { width: 1550, height: 1100 },
    });
    await ctx.addCookies([
      {
        name: "ctdt_access_token",
        value: f.officer.cookie.split("=").slice(1).join("="),
        url: f.base,
      },
    ]);
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(f.base + "/dashboard/chuong-trinh-dao-tao");
    await p
      .getByPlaceholder("Tìm theo mã CTĐT, mã phiên bản hoặc tên...")
      .fill(f.mark);
    const row = p
      .getByRole("row")
      .filter({ has: p.getByText(f.mark, { exact: true }) });
    await row
      .getByRole("button", { name: "Sửa phiên bản", exact: true })
      .waitFor();
    eq(
      await row
        .getByRole("button", { name: "Thêm phiên bản", exact: true })
        .count(),
      0,
    );
    await row
      .getByRole("button", { name: "Sửa phiên bản", exact: true })
      .click();
    await p.waitForURL("**/tao-moi?edit=" + f.program.id);
    await p
      .getByRole("heading", { name: "Sửa phiên bản CTĐT", exact: true })
      .waitFor();
    await p.waitForFunction(
      () => document.getElementById("thoiGianDaoTao")?.value === "1.5",
    );
    eq(
      await p
        .getByLabel("Thời gian đào tạo chuẩn", { exact: true })
        .inputValue(),
      "1.5",
    );
    eq(
      await p
        .getByLabel("Thời gian đào tạo chuẩn", { exact: true })
        .getAttribute("type"),
      "number",
    );
    await p.getByText("năm", { exact: true }).waitFor();
    checks++;
    await p.getByLabel("Thời gian đào tạo chuẩn", { exact: true }).fill("2.5");
    const lang = p.getByLabel("Đầu ra ngoại ngữ", { exact: true });
    eq(
      await lang
        .locator("option")
        .allTextContents()
        .then((a) => a.includes(f.language)),
      true,
    );
    await lang.selectOption("B1");
    await p
      .getByLabel("Chuẩn CNTT (yêu cầu đầu ra)", { exact: true })
      .selectOption("Bằng CNTT");
    const update = p.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().endsWith("/api/chuong-trinh-dao-tao/" + f.program.id),
    );
    await p
      .getByRole("button", {
        name: "Lưu & Chuyển Sang Xây Dựng Cấu Trúc",
        exact: true,
      })
      .click();
    eq((await update).status(), 200);
    await p.waitForURL("**/" + f.program.id + "/build");
    let saved = await ctx.request.get(
      f.base + "/api/chuong-trinh-dao-tao/" + f.program.id,
    );
    let data = await saved.json();
    eq(data.thoiGianDaoTao, "2.5 năm");
    eq(data.chuanDauRaTiengAnh, "B1");
    eq(data.chuanDauRaTinHoc, "Bằng CNTT");
    await p.goto(f.base + "/dashboard/chuong-trinh-dao-tao/tao-moi");
    const degree = p.getByLabel("Bậc đào tạo", { exact: false });
    await p.waitForFunction(
      () => document.getElementById("degree")?.options.length > 2,
    );
    const levelLabels = await degree.locator("option").allTextContents();
    eq(levelLabels.includes("Đại học"), false);
    eq(levelLabels.includes("Thạc sĩ"), true);
    eq(levelLabels.includes("Tiến sĩ"), true);
    const years = p.getByLabel("Thời gian đào tạo chuẩn", { exact: true });
    eq(await years.inputValue(), "0.5");
    eq(await years.getAttribute("step"), "0.5");
    eq(await years.getAttribute("min"), "0.5");
    await years.press("ArrowUp");
    eq(await years.inputValue(), "1");
    await years.press("ArrowUp");
    eq(await years.inputValue(), "1.5");
    await years.press("ArrowDown");
    eq(await years.inputValue(), "1");
    await degree.selectOption({ label: "Tiến sĩ" });
    eq(await degree.locator("option:checked").textContent(), "Tiến sĩ");
    await p.goto(f.base + "/dashboard/danh-muc-hoc-phan");
    await p
      .getByRole("button", { name: "Thêm học phần mới", exact: true })
      .click();
    const d = p.getByRole("dialog");
    const credits = d.getByLabel("Số tín chỉ", { exact: true });
    eq(await credits.inputValue(), "1");
    eq(await credits.getAttribute("step"), "1");
    eq(await credits.getAttribute("min"), "1");
    eq(await credits.getAttribute("max"), "15");
    await credits.press("ArrowUp");
    eq(await credits.inputValue(), "2");
    await credits.fill("15");
    await credits.press("ArrowUp");
    eq(await credits.inputValue(), "15");
    await d.getByLabel("Tiết lý thuyết", { exact: true }).fill("15");
    await d.getByLabel("Tiết thực hành", { exact: true }).fill("0");
    eq(await d.getByLabel("Giờ lý thuyết", { exact: true }).count(), 0);
    await d.getByLabel("Mã học phần", { exact: true }).fill(f.mark + "_UI");
    await d
      .getByLabel("Tên học phần", { exact: true })
      .fill("Kiểm thử tín chỉ nguyên");
    await d.getByLabel("Đơn vị quản lý", { exact: true }).selectOption("1");
    eq(
      await d
        .getByLabel("Đơn vị quản lý", { exact: true })
        .locator('option[value="2"]')
        .count(),
      0,
    );
    await d
      .getByLabel("Ngày bắt đầu hiệu lực", { exact: true })
      .fill("2026-01-01");
    await d
      .getByLabel("Ngày kết thúc hiệu lực", { exact: true })
      .fill("2026-01-01");
    eq(
      await d
        .getByLabel("Ngày kết thúc hiệu lực", { exact: true })
        .getAttribute("min"),
      "2026-01-02",
    );
    await d.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
    eq(
      await d
        .getByLabel("Ngày kết thúc hiệu lực", { exact: true })
        .evaluate((e) => e.validationMessage),
      "Ngày kết thúc hiệu lực phải lớn hơn ngày bắt đầu hiệu lực.",
    );
    await d
      .getByLabel("Ngày kết thúc hiệu lực", { exact: true })
      .fill("2026-01-02");
    await credits.fill("1.5");
    await d.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
    eq(
      await credits.evaluate((e) => e.validationMessage),
      "Số tín chỉ phải là số nguyên từ 1 đến 15.",
    );
    await credits.fill("15");
    const create = p.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().endsWith("/api/danh-muc-hoc-phan"),
    );
    await d.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
    const response = await create;
    eq(response.status(), 201);
    data = await response.json();
    eq(data.credits, 15);
    eq(data.effectiveTo, "2026-01-02");
    eq(data.theoryHours, 15);
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
