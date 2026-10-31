/* Full browser writes only on a disposable approval clone prepared by approval.integration.cjs. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.APPROVAL_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_approval_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error("Disposable approval clone required.");
const fixture = JSON.parse(
  fs.readFileSync(
    process.env.APPROVAL_BROWSER_FIXTURE || "/tmp/ctdt-approval-browser.json",
    "utf8",
  ),
);
assert.equal(fixture.name, process.env.DB_DATABASE);
const mod = process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
  { chromium } = require(mod),
  { expect } = require(mod + "/test");
const base = fixture.base,
  prefix = "/api/xet-duyet",
  pp = "/api/chuong-trinh-dao-tao",
  today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
let browser,
  checks = 0;
const errors = [];
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function api(
  url,
  account,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + url, {
    method,
    headers: {
      Origin: base,
      Cookie: account.cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert(response.ok, url + " " + JSON.stringify(data.message));
  return data;
}
async function login(account) {
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/dang-nhap");
  await page.locator("#identifier").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
    timeout: 30000,
  });
  return { page, context };
}
async function fill(page, conclusion) {
  await page
    .getByLabel("Tên hội đồng / ban thẩm định", { exact: false })
    .fill("Hội đồng kiểm tra giao diện");
  await page
    .getByLabel("Chủ tịch hội đồng", { exact: false })
    .fill("Chủ tịch thử nghiệm");
  await page
    .getByLabel("Thư ký khoa học", { exact: false })
    .fill("Thư ký thử nghiệm");
  await page.getByLabel("Số biên bản", { exact: false }).fill("BB-BROWSER");
  await page.getByLabel("Ngày họp thẩm định", { exact: false }).fill(today);
  await page
    .getByLabel("Kết luận thẩm định", { exact: true })
    .selectOption(conclusion);
  await page
    .getByLabel("Ý kiến / lý do", { exact: false })
    .fill("Kết luận đối chiếu hồ sơ thử trên database sao.");
}
async function run() {
  // Probe the clone using its unique session before any HTTP writes.
  same(
    (await api("/api/auth/profile", fixture.reviewer)).username,
    fixture.reviewer.username,
    "isolated backend probe",
  );
  const original = await api(pp + "/" + fixture.versionId, fixture.officer);
  const existing = await api(
    pp + "?searchTerm=" + encodeURIComponent(original.maCTDT) + "&limit=100",
    fixture.officer,
  );
  const cohort =
    Math.max(
      2026,
      ...existing.data
        .filter((v) => v.programId === original.programId)
        .map((v) => v.cohortYear || 2026),
    ) + 1;
  const body = {
    maCTDT: original.maCTDT,
    maPhienBan: "browser-" + Date.now(),
    tenCTDT: original.tenCTDT,
    tenTiengAnh: original.tenTiengAnh,
    educationLevelId: original.educationLevelId,
    managingUnitId: original.managingUnitId,
    majorId: original.majorId,
    hinhThucDaoTao: original.hinhThucDaoTao,
    thoiGianDaoTao: original.thoiGianDaoTao,
    khoaTuyenSinh: cohort + " - " + (cohort + 2),
    tongTinChiYeuCau: original.tongTinChiYeuCau,
    chuanDauRaTiengAnh: original.chuanDauRaTiengAnh,
    chuanDauRaTinHoc: original.chuanDauRaTinHoc,
    soQuyetDinhBanHanh: "QD-BROWSER",
    ngayBanHanh: today,
    moTa: "",
  };
  let program = await api(
    pp + "/danh-muc/" + original.programId + "/phien-ban",
    fixture.officer,
    body,
  );
  program = await api(
    pp + "/" + program.id + "/cau-truc",
    fixture.officer,
    {
      revision: program.revision,
      tracks: program.tracks.map((t) => {
        const source = original.tracks.find((s) => s.code === t.code);
        return {
          id: t.id,
          groups: t.groups.map((g) => ({
            id: g.id,
            minimumCredits: source.groups.find((s) => s.code === g.code)
              .minimumCredits,
          })),
          courses: source.courses.map((c) => ({
            courseVersionId: c.courseVersionId,
            groupId: t.groups.find(
              (g) =>
                g.code === source.groups.find((s) => s.id === c.groupId).code,
            ).id,
            requirementType: c.requirementType,
            semester: c.semester,
          })),
        };
      }),
    },
    "PUT",
  );
  program = await api(pp + "/" + program.id + "/gui-duyet", fixture.officer, {
    revision: program.revision,
  });
  const list = await api(
      prefix + "?status=PENDING&versionId=" + program.id,
      fixture.reviewer,
    ),
    request = list.data[0];
  browser = await chromium.launch({ headless: true });
  const reviewer = await login(fixture.reviewer),
    { page } = reviewer;
  await page.goto(base + "/dashboard/xet-duyet");
  await page
    .getByLabel("Tìm hồ sơ xét duyệt", { exact: true })
    .fill(request.requestNo);
  const row = page.getByRole("row").filter({ hasText: request.requestNo });
  await expect(row).toHaveCount(1);
  await row.getByRole("link", { name: "Mở hồ sơ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lưu kết luận thẩm định", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Kết luận thẩm định", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Bắt đầu thẩm định", exact: true })
    .click();
  await expect(
    page.getByText("Đã ghi nhận bắt đầu thẩm định.", { exact: true }),
  ).toBeVisible();
  await fill(page, "YEU_CAU_SUA_DOI");
  await page
    .locator("#approval-file")
    .setInputFiles({
      name: "biên-bản-giao-diện.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
  await expect(
    page.getByRole("button", { name: "Lưu kết luận thẩm định", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Tải lên hồ sơ", exact: true })
    .click();
  await expect(
    page.getByText("Đã lưu tài liệu gắn đúng lượt duyệt.", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "biên-bản-giao-diện.pdf", exact: true })
    .click();
  const download = await downloadPromise;
  same(await download.failure(), null, "browser document download");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Lưu kết luận thẩm định", exact: true })
    .click();
  await expect(
    page.getByText("Đã lưu kết luận, biên bản và lịch sử xét duyệt.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Biên bản đã lưu của lượt duyệt này",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Biên bản đã lưu của lượt duyệt này",
      exact: true,
    }),
  ).toBeVisible();
  same(
    (await api(prefix + "/" + request.id, fixture.reviewer)).status,
    "RETURNED",
    "browser return persisted in SQL",
  );
  program = await api(pp + "/" + program.id, fixture.officer);
  program = await api(pp + "/" + program.id + "/gui-duyet", fixture.officer, {
    revision: program.revision,
  });
  const pending = await api(
      prefix + "?status=PENDING&versionId=" + program.id,
      fixture.reviewer,
    ),
    second = pending.data[0];
  const self = await login(fixture.officer);
  await self.page.goto(base + "/dashboard/xet-duyet/" + second.id);
  await expect(
    self.page.getByRole("heading", {
      name: "Lưu kết luận thẩm định",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    self.page.getByText(/Người gửi không được tự thẩm định/),
  ).toBeVisible();
  await page.goto(base + "/dashboard/xet-duyet/" + second.id);
  await expect(
    page.getByLabel("Kết luận thẩm định", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("Chưa có tài liệu được lưu.", { exact: true }),
  ).toBeVisible();
  await fill(page, "DAT_DIEU_KIEN");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Lưu kết luận thẩm định", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Biên bản đã lưu của lượt duyệt này",
      exact: true,
    }),
  ).toBeVisible();
  const approved = await api(prefix + "/" + second.id, fixture.reviewer);
  same(approved.program.status, "PUBLISHED", "browser publish workflow");
  same(
    (await api(prefix + "/" + request.id, fixture.reviewer)).minutes.ketLuan,
    "YEU_CAU_SUA_DOI",
    "old cycle minutes unchanged",
  );
  await page.screenshot({
    path: process.env.APPROVAL_SCREENSHOT || "/tmp/ctdt-approval-browser.png",
  });
  const foreign = await login(fixture.foreign);
  await foreign.page.goto(base + "/dashboard/xet-duyet/" + second.id);
  await expect(
    foreign.page
      .getByRole("alert")
      .filter({ hasText: "Không tìm thấy hồ sơ trong phạm vi" }),
  ).toBeVisible();
  const admin = await login(fixture.admin);
  await admin.page.goto(base + "/dashboard/xet-duyet");
  await expect(
    admin.page.getByRole("heading", {
      name: "Xét Duyệt & Thẩm Định CTĐT",
      exact: true,
    }),
  ).toHaveCount(0);
  same(
    (await admin.context.request.get(base + prefix)).status(),
    403,
    "admin backend guard",
  );
  same(errors, [], "browser runtime errors");
  console.log(
    "PASS approval real browser: queue, blank form, start, upload/download, return, resubmit, self-review denial, publish, scope, roles; " +
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
