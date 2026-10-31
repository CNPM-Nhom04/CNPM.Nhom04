/* Browser workflow on the isolated integration fixture. Never use the working database. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.GRADUATION_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_graduation_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error("Disposable graduation database required.");
const f = JSON.parse(
  fs.readFileSync(
    process.env.GRADUATION_BROWSER_FIXTURE ||
      "/tmp/ctdt-graduation-browser.json",
    "utf8",
  ),
);
assert.equal(f.name, process.env.DB_DATABASE);
const mod = process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
  { chromium } = require(mod),
  { expect } = require(mod + "/test");
const base = f.base,
  prefix = "/api/xet-tot-nghiep",
  errors = [];
let browser,
  checks = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function login(account) {
  const context = await browser.newContext({
      viewport: { width: 1530, height: 1050 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/dang-nhap");
  await page.locator("#identifier").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
    timeout: 30000,
  });
  return { context, page };
}
async function run() {
  const probe = await fetch(base + "/api/auth/profile", {
    headers: { Cookie: f.officer.cookie },
  });
  same(probe.status, 200, "clone session before browser writes");
  same((await probe.json()).username, f.officer.username, "clone identity");
  browser = await chromium.launch({ headless: true });
  const reviewer = await login(f.reviewer);
  await reviewer.page.goto(base + "/dashboard/xet-tot-nghiep");
  await reviewer.page
    .getByRole("button", { name: "Quy định xét tốt nghiệp", exact: true })
    .click();
  const select = reviewer.page.getByLabel("Hướng áp dụng quy định tốt nghiệp", {
    exact: true,
  });
  await expect(
    select.locator('option[value="' + f.track.id + '"]'),
  ).toBeAttached();
  const options = await reviewer.context.request.get(
      base + prefix + "/options",
    ),
    optionData = await options.json();
  let unused;
  for (const t of optionData.tracks.filter((t) => t.id !== f.track.id)) {
    const r = await reviewer.context.request.get(
      base + prefix + "/quy-dinh/" + t.id,
    );
    if (!(await r.json()).policy) {
      unused = t;
      break;
    }
  }
  assert(unused, "Need a track with no graduation policy in the clone.");
  await select.selectOption(unused.id);
  await expect(
    reviewer.page.getByLabel("Yêu cầu ĐTB", { exact: true }),
  ).toHaveValue("");
  await expect(
    reviewer.page.getByLabel("ĐTB tối thiểu", { exact: true }),
  ).toHaveValue("");
  await reviewer.page
    .getByLabel("Yêu cầu ĐTB", { exact: true })
    .selectOption("no");
  await reviewer.page
    .getByLabel("Yêu cầu ngoại ngữ", { exact: true })
    .selectOption("no");
  await reviewer.page
    .getByLabel("Yêu cầu bảo vệ", { exact: true })
    .selectOption("no");
  await reviewer.page
    .getByLabel("Căn cứ quy định", { exact: true })
    .fill("TEST-BROWSER-OFFICIAL-REFERENCE");
  await reviewer.page
    .getByRole("button", { name: "Lưu quy định", exact: true })
    .click();
  await expect(
    reviewer.page.getByText(
      "Đã lưu quy định vào SQL. Hồ sơ xác minh theo quy định cũ cần được đối chiếu lại.",
      { exact: true },
    ),
  ).toBeVisible();
  await select.selectOption(f.track.id);
  await expect(
    reviewer.page.getByLabel("ĐTB tối thiểu", { exact: true }),
  ).toHaveValue("7.3");
  const officer = await login(f.officer),
    page = officer.page;
  await page.goto(base + "/dashboard/xet-tot-nghiep");
  await page.getByLabel("Tìm hồ sơ tốt nghiệp", { exact: true }).fill(f.s.code);
  const row = page.getByRole("row").filter({ hasText: f.s.code });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Chi tiết", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Chi tiết đối chiếu điều kiện tốt nghiệp",
    exact: true,
  });
  await expect(
    dialog.getByLabel("ĐTB chính thức", { exact: true }),
  ).toHaveValue("8.2");
  await dialog.getByLabel("ĐTB chính thức", { exact: true }).fill("0");
  await dialog
    .getByLabel("Xác nhận đã đối chiếu hồ sơ", { exact: true })
    .check();
  const saveResponse = page.waitForResponse(
    (r) => r.url().endsWith("/minh-chung") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Lưu xác minh vào SQL", exact: true })
    .click();
  same((await saveResponse).status(), 201, "browser saves official zero");
  await expect(
    dialog.getByLabel("ĐTB chính thức", { exact: true }),
  ).toHaveValue("0");
  await dialog.getByLabel("ĐTB chính thức", { exact: true }).fill("8.2");
  await dialog
    .getByLabel("Xác nhận đã đối chiếu hồ sơ", { exact: true })
    .check();
  const restoreResponse = page.waitForResponse(
    (r) => r.url().endsWith("/minh-chung") && r.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Lưu xác minh vào SQL", exact: true })
    .click();
  same((await restoreResponse).status(), 201, "browser saves verified proof");
  await expect(
    dialog.getByText("Đủ điều kiện theo dữ liệu đã đối chiếu", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Kiểm tra và lưu kết quả", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", {
      name: "Kiểm tra và lưu kết quả",
      exact: true,
    }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Xem lịch sử đã lưu", exact: true })
    .click();
  await expect(
    dialog.getByText(/Đủ điều kiện theo dữ liệu đã đối chiếu — /).first(),
  ).toBeVisible();
  const current = await officer.context.request.get(
      base + prefix + "/" + f.s.assignmentId,
    ),
    detail = await current.json();
  same(detail.input.studentStatus, "ACTIVE", "check does not award degree");
  same(detail.changedSinceCheck, false, "persisted fingerprint");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Chạy kiểm tra theo bậc", exact: true })
    .click();
  const auto = page.getByRole("dialog", {
    name: "Kiểm tra điều kiện tốt nghiệp theo bậc",
    exact: true,
  });
  await auto
    .getByLabel("Bậc cần kiểm tra", { exact: true })
    .selectOption(f.track.levelId);
  await auto
    .getByRole("button", { name: "Thực hiện kiểm tra", exact: true })
    .click();
  await expect(auto).toBeHidden();
  await expect(page.getByText(/Đã hoàn tất. Đã lưu/)).toBeVisible();
  await page.screenshot({
    path:
      process.env.GRADUATION_SCREENSHOT || "/tmp/ctdt-graduation-browser.png",
  });
  await page.reload();
  await page.getByLabel("Tìm hồ sơ tốt nghiệp", { exact: true }).fill(f.s.code);
  await expect(
    page.getByRole("row").filter({ hasText: f.s.code }),
  ).toContainText("Đủ điều kiện theo dữ liệu đã đối chiếu");
  const admin = await login(f.admin);
  await admin.page.goto(base + "/dashboard/xet-tot-nghiep");
  await expect(
    admin.page.getByRole("heading", {
      name: "Xét Điều Kiện Tốt Nghiệp",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    admin.page.getByRole("button", {
      name: "Chạy kiểm tra theo bậc",
      exact: true,
    }),
  ).toHaveCount(0);
  await admin.page
    .getByLabel("Tìm hồ sơ tốt nghiệp", { exact: true })
    .fill(f.s.code);
  await admin.page
    .getByRole("row")
    .filter({ hasText: f.s.code })
    .getByRole("button", { name: "Chi tiết", exact: true })
    .click();
  await expect(
    admin.page.getByRole("heading", {
      name: "Xác minh ĐTB và hồ sơ chuẩn đầu ra",
      exact: true,
    }),
  ).toHaveCount(0);
  const foreign = await login(f.foreign);
  await foreign.page.goto(base + "/dashboard/xet-tot-nghiep");
  await expect(
    foreign.page.getByText(
      "Không có hồ sơ phân công phù hợp trong phạm vi tài khoản.",
      { exact: true },
    ),
  ).toBeVisible();
  same(
    (
      await foreign.context.request.get(base + prefix + "/" + f.s.assignmentId)
    ).status(),
    404,
    "foreign student scope denied",
  );
  same(errors, [], "browser runtime errors");
  console.log(
    "PASS graduation browser: real login, blank SQL policy, verification 0/null, live eligibility, history, batch, reload, admin read-only and faculty scope; " +
      checks +
      " contract checks.",
  );
}
run()
  .catch((e) => {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
  });
