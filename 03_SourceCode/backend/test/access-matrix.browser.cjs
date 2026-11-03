const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "access.json",
    ),
  ),
);
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  fixture.database !== process.env.DB_DATABASE ||
  !/^ctdt_major_review_\d+$/.test(fixture.database)
)
  throw Error("Disposable clone required");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
let checks = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
const menu = [
  ["/dashboard/admin/nguoi-dung", "USER_MANAGE", true],
  ["/dashboard/admin/master-data", "MASTERDATA_MANAGE", true],
  ["/dashboard/admin/khoa", "MASTERDATA_MANAGE", true],
  ["/dashboard/admin/nganh-dao-tao", "MASTERDATA_MANAGE", true],
  ["/dashboard/admin/cau-hinh", "SETTINGS_MANAGE", true],
  ["/dashboard/admin/audit-log", "AUDIT_READ_ALL", true],
  ["/dashboard/admin/cong-thong-tin", "MASTERDATA_MANAGE", true],
  ["/dashboard/admin/lop-hoc-vien", "STUDENT_ACCOUNT_IMPORT", true],
  ["/dashboard/danh-muc-hoc-phan", "CATALOG_READ"],
  ["/dashboard/chuong-trinh-dao-tao", "PROGRAM_READ"],
  ["/dashboard/bao-cao", "PROGRAM_READ"],
  ["/dashboard/so-sanh", "PROGRAM_COMPARE"],
  ["/dashboard/xet-duyet", "PROGRAM_APPROVE"],
  ["/dashboard/de-tai-luan-van", "TOPIC_READ"],
  ["/dashboard/bao-ve-luan-van", "DEFENSE_READ"],
  ["/dashboard/quan-ly-diem", "GRADE_READ"],
  ["/dashboard/xet-tot-nghiep", "GRADUATION_READ"],
];
async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const a of fixture.actors) {
      const ctx = await browser.newContext({
        viewport: { width: 1500, height: 1000 },
      });
      await ctx.addCookies([
        { name: "ctdt_access_token", value: a.token, url: fixture.base },
      ]);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(fixture.base + "/dashboard");
      if (a.role === "STUDENT") {
        await page.waitForURL("**/ctdt-cua-toi");
        eq(await page.locator("aside").count(), 0);
        eq(
          await page
            .getByRole("link", { name: "Dashboard", exact: false })
            .count(),
          0,
        );
        await page
          .getByRole("region", { name: "Hồ sơ học viên", exact: true })
          .getByText("SV003", { exact: false })
          .waitFor();
        checks++;
        await page.goto(fixture.base + "/dashboard/admin/nguoi-dung");
        await page.waitForURL("**/ctdt-cua-toi");
        checks++;
      } else {
        await page.locator("aside").waitFor();
        for (const [href, permission, adminOnly] of menu) {
          const allowed =
            a.permissions.includes(permission) &&
            (!adminOnly || a.role === "ADMIN");
          eq(
            await page.locator('aside a[href="' + href + '"]').count(),
            allowed ? 1 : 0,
            a.role + " menu " + href,
          );
        }
        if (a.role !== "ADMIN") {
          await page.goto(fixture.base + "/dashboard/admin/nguoi-dung");
          await page
            .getByText("Bạn không có quyền truy cập trang này.", {
              exact: true,
            })
            .waitFor();
          checks++;
          eq(
            await page
              .getByRole("heading", {
                name: "Nhân Sự & Phân Quyền Hệ Thống SĐH",
              })
              .count(),
            0,
          );
        }
        if (a.permissions.includes("PROGRAM_READ")) {
          await page.goto(fixture.base + "/dashboard/bao-cao");
          const exportButton = page.getByRole("button", {
            name: "Xuất Excel (.xlsx)",
            exact: true,
          });
          await exportButton.waitFor();
          await page.getByText("Tổng", { exact: false }).first().waitFor();
          if (!a.permissions.includes("PROGRAM_EXPORT"))
            eq(
              await exportButton.isDisabled(),
              true,
              a.role + " export disabled",
            );
          else {
            await page
              .waitForResponse(
                (r) => r.url().includes("/api/bao-cao?") && r.status() === 200,
              )
              .catch(() => {});
            eq(await exportButton.isEnabled(), true);
          }
        }
        if (a.role === "APPROVER") {
          await page.goto(fixture.base + "/dashboard/chuong-trinh-dao-tao");
          await page
            .getByRole("heading", { name: "Chương trình Đào tạo", exact: true })
            .waitFor();
          eq(
            await page
              .getByRole("button", { name: "Khởi tạo CTĐT Mới", exact: false })
              .count(),
            0,
          );
        }
        if (a.role === "LECTURER") {
          await page.goto(fixture.base + "/dashboard/danh-muc-hoc-phan");
          await page.waitForResponse(
            (r) =>
              r.url().includes("/api/danh-muc-hoc-phan") && r.status() === 200,
          );
          eq(
            await page.getByRole("button", { name: /Thêm học phần/i }).count(),
            0,
          );
        }
        await page.goto(fixture.base + "/");
        eq(
          (await page
            .getByRole("link", { name: "Dashboard", exact: false })
            .count()) > 0,
          true,
        );
      }
      eq(errors, [], a.role + " browser errors");
      await ctx.close();
    }
    console.log(
      JSON.stringify({ result: "PASS", checks, roles: fixture.actors.length }),
    );
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
