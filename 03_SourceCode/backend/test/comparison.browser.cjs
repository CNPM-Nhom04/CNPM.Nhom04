/* Full JWT -> Next proxy -> SQL -> UI test. Writes fixture users/sessions ONLY on an explicit disposable clone. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.COMPARISON_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_comparison_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error(
    "Use COMPARISON_TEST_ALLOW_WRITES=1 with disposable ctdt_comparison_review_<timestamp> DB; servers must use that same clone.",
  );
const { DataSource } = require("typeorm"),
  bcrypt = require("bcryptjs");
const mod = process.env.PLAYWRIGHT_MODULE_PATH || "playwright";
const { chromium } = require(mod),
  { expect } = require(mod + "/test");
const base = process.env.COMPARISON_TEST_URL || "http://localhost:3101";
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
let browser,
  checks = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function actor(role, scopeType, target) {
  const username = "compare_" + Date.now() + "_" + randomUUID().slice(0, 8),
    password = "ComparisonTest123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử so sánh",
      await bcrypt.hash(password, 4),
    ],
  );
  const [user] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [username],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [user.id, role],
  );
  const columns = {
    ORG_UNIT: "organizational_unit_id",
    PROGRAM: "program_id",
    MAJOR: "major_id",
  };
  const column = columns[scopeType];
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type" +
      (column ? "," + column : "") +
      ") VALUES(?,?" +
      (column ? ",?" : "") +
      ")",
    column ? [user.id, scopeType, target] : [user.id, scopeType],
  );
  return { ...user, username, password };
}
async function login(account) {
  const context = await browser.newContext({
    viewport: { width: 1550, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/dang-nhap");
  await page.locator("#identifier").fill(account.username);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), {
    timeout: 30000,
  });
  return { context, page, errors };
}
async function run() {
  await db.initialize();
  const [pair] = await db.query(
    "SELECT CAST(v.id AS CHAR) versionId,CAST(p.managing_unit_id AS CHAR) unitId FROM program_versions v JOIN training_programs p ON p.id=v.program_id GROUP BY v.id HAVING (SELECT COUNT(*) FROM program_version_tracks t WHERE t.program_version_id=v.id)>1 ORDER BY v.id LIMIT 1",
  );
  assert(pair, "Need SQL version with two real tracks.");
  const tracks = await db.query(
    "SELECT CAST(id AS CHAR) id FROM program_version_tracks WHERE program_version_id=? ORDER BY id",
    [pair.versionId],
  );
  const [other] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE id<>? AND NOT EXISTS(SELECT 1 FROM organizational_unit_closure WHERE ancestor_id=organizational_units.id AND descendant_id=?) LIMIT 1",
    [pair.unitId, pair.unitId],
  );
  assert(other, "Need separate unit for scope test.");
  const officer = await actor("TRAINING_OFFICER", "ORG_UNIT", pair.unitId);
  const limited = await actor("TRAINING_OFFICER", "ORG_UNIT", other.id);
  const admin = await actor("ADMIN", "GLOBAL");
  // Read-only HTTP probe before attempting login: avoid failed-login writes on a wrongly configured source server.
  const sessionId = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,5,UTC_TIMESTAMP(6)),5,UTC_TIMESTAMP(6))",
    [sessionId, officer.id],
  );
  const { JwtService } = require("@nestjs/jwt");
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: officer.id, jti: sessionId },
    { expiresIn: "5m" },
  );
  const isolated = await fetch(base + "/api/auth/profile", {
    headers: { Cookie: "ctdt_access_token=" + token },
  });
  same(isolated.status, 200, "clone-only session probe before login");
  same(
    (await isolated.json()).username,
    officer.username,
    "backend is connected to clone",
  );
  browser = await chromium.launch({ headless: true });
  const main = await login(officer),
    { page } = main;
  // Session from this freshly cloned-only account proves the HTTP server points at this clone.
  const probe = await main.context.request.get(base + "/api/auth/profile");
  same(probe.status(), 200, "real session/profile");
  const profile = await probe.json();
  same(profile.username, officer.username, "clone-only identity probe");
  await page.goto(base + "/dashboard/so-sanh");
  await expect(
    page.getByRole("heading", {
      name: "So Sánh Cấu Trúc Chương Trình Đào Tạo",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xuất Excel (.xlsx)", exact: true }),
  ).toBeDisabled();
  for (const side of ["A", "B"]) {
    const select = page.getByLabel("Phiên bản Bản " + side, { exact: true });
    await expect(
      select.locator('option[value="' + pair.versionId + '"]'),
    ).toBeAttached();
    await select.selectOption(pair.versionId);
  }
  await page
    .getByLabel("Hướng Bản A", { exact: true })
    .selectOption(tracks[0].id);
  await page
    .getByLabel("Hướng Bản B", { exact: true })
    .selectOption(tracks[0].id);
  await expect(
    page.getByText(
      "Bạn đang đối chiếu cùng một phiên bản và hướng; các học phần sẽ giữ nguyên.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xuất Excel (.xlsx)", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Hướng Bản B", { exact: true })
    .selectOption(tracks[1].id);
  await expect(
    page.getByText(
      "Bạn đang đối chiếu cùng một phiên bản và hướng; các học phần sẽ giữ nguyên.",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xuất Excel (.xlsx)", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Lọc thay đổi", { exact: true }).selectOption("ONLY_B");
  await page
    .getByLabel("Tìm học phần so sánh", { exact: true })
    .fill("NO_SUCH_COURSE_9832");
  await expect(
    page.getByText("Không có học phần phù hợp.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tìm học phần so sánh", { exact: true }).fill("");
  await page.getByLabel("Lọc thay đổi", { exact: true }).selectOption("ALL");
  await page.screenshot({
    path:
      process.env.COMPARISON_SCREENSHOT || "/tmp/ctdt-comparison-browser.png",
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Xuất Excel (.xlsx)", exact: true })
    .click();
  const download = await downloadPromise;
  same(download.suggestedFilename(), "so-sanh-ctdt.xlsx", "browser download");
  same(await download.failure(), null, "xlsx completed");
  const q = new URLSearchParams({
    versionA: pair.versionId,
    trackA: tracks[0].id,
    versionB: pair.versionId,
    trackB: tracks[1].id,
  });
  const actual = await main.context.request.get(base + "/api/so-sanh?" + q);
  same(actual.status(), 200, "real authenticated proxy");
  same(
    (
      await main.context.request.get(base + "/api/so-sanh?" + q + "&trackB=0")
    ).status(),
    400,
    "invalid ID through proxy",
  );
  // Fresh role lookup: revoking permission takes effect with the existing valid cookie.
  await db.query("DELETE FROM user_roles WHERE user_id=?", [officer.id]);
  same(
    (await main.context.request.get(base + "/api/so-sanh?" + q)).status(),
    403,
    "live SQL role revocation",
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='TRAINING_OFFICER'",
    [officer.id],
  );
  const scoped = await login(limited);
  same(
    (await scoped.context.request.get(base + "/api/so-sanh?" + q)).status(),
    404,
    "cross-unit API denied",
  );
  same(
    (
      await scoped.context.request.get(base + "/api/so-sanh/export?" + q)
    ).status(),
    404,
    "cross-unit export denied",
  );
  await scoped.page.goto(base + "/dashboard/so-sanh");
  await scoped.page
    .getByLabel("Tìm phiên bản Bản A", { exact: true })
    .fill("NO_SUCH_PROGRAM_8541");
  await expect(
    scoped.page.getByText("Không có phiên bản phù hợp").first(),
  ).toBeVisible();
  const blocked = await login(admin);
  same(
    (await blocked.context.request.get(base + "/api/so-sanh/options")).status(),
    403,
    "ADMIN has no implicit compare permission",
  );
  await blocked.page.goto(base + "/dashboard/so-sanh");
  await expect(
    blocked.page.getByRole("heading", {
      name: "So Sánh Cấu Trúc Chương Trình Đào Tạo",
    }),
  ).toHaveCount(0);
  const anonymous = await browser.newContext();
  same(
    (await anonymous.request.get(base + "/api/so-sanh/options")).status(),
    401,
    "anonymous proxy denied",
  );
  same(
    (await anonymous.request.get(base + "/api/so-sanh/invalid")).status(),
    404,
    "proxy path allowlist",
  );
  await db.query(
    "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=?",
    [officer.id],
  );
  same(
    (await main.context.request.get(base + "/api/so-sanh/options")).status(),
    401,
    "revoked session denied",
  );
  same(main.errors, [], "main browser runtime");
  same(scoped.errors, [], "scope browser runtime");
  same(blocked.errors, [], "blocked browser runtime");
  console.log(
    "PASS comparison real-login UI/proxy/JWT/download and " +
      checks +
      " contract checks on disposable clone.",
  );
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (db.isInitialized) await db.destroy();
  });
