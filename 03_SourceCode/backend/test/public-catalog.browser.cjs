const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const f = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(process.env.MAJOR_BROWSER_FIXTURE || "/tmp/browser.json"),
      "catalog.json",
    ),
  ),
);
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  f.database !== process.env.DB_DATABASE ||
  !/^ctdt_major_review_\d+$/.test(f.database)
)
  throw Error("Disposable SQL clone required");
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
    const guest = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
      }),
      p = await guest.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(f.base + "/chuong-trinh-dao-tao");
    const master = p.getByRole("region", {
        name: "Chương trình đào tạo Thạc sĩ",
        exact: true,
      }),
      doctor = p.getByRole("region", {
        name: "Chương trình đào tạo Tiến sĩ",
        exact: true,
      });
    await master.waitFor();
    await doctor.waitFor();
    eq(
      await p.getByRole("heading", { name: "Thạc sĩ", exact: true }).count(),
      1,
    );
    eq(
      await p.getByRole("heading", { name: "Tiến sĩ", exact: true }).count(),
      1,
    );
    await p.getByLabel("Tìm chương trình đào tạo").fill(f.mark);
    await doctor
      .getByRole("link", { name: "TEST CTĐT FBE_D " + f.mark, exact: true })
      .waitFor();
    await master
      .getByText("11 phiên bản đã ban hành", { exact: true })
      .waitFor();
    eq(await master.getByRole("listitem").count(), 8);
    eq(await doctor.getByRole("listitem").count(), 2);
    await master
      .getByRole("button", { name: "Trang sau thạc sĩ", exact: true })
      .click();
    await master
      .getByText("Trang 2/2 · Tổng 11 phiên bản", { exact: true })
      .waitFor();
    await p.waitForFunction(
      () =>
        document.querySelectorAll(
          '[aria-label="Chương trình đào tạo Thạc sĩ"] ol > li',
        ).length === 3,
    );
    eq(await master.getByRole("listitem").count(), 3);
    eq(await doctor.getByRole("listitem").count(), 2);
    eq(
      await p
        .getByText("TEST CTĐT PRIVATE_DRAFT " + f.mark, { exact: true })
        .count(),
      0,
    );
    await p.screenshot({
      path: "/tmp/ctdt-major-review/public-catalog-desktop.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    eq(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await p.screenshot({
      path: "/tmp/ctdt-major-review/public-catalog-mobile.png",
      fullPage: true,
    });
    for (const [actor, facultyId, count] of [
      [f.fit, "1", 10],
      [f.student, "1", 10],
      [f.teacher, "1", 10],
      [f.fbe, "2", 1],
      [f.fallback, "2", 1],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      await context.addCookies([
        {
          name: "ctdt_access_token",
          value: actor.cookie.split("=").slice(1).join("="),
          url: f.base,
        },
      ]);
      const page = await context.newPage();
      await page.goto(f.base + "/chuong-trinh-dao-tao");
      await page.getByLabel("Tìm chương trình đào tạo").fill(f.mark);
      const m = page.getByRole("region", {
          name: "Chương trình đào tạo Thạc sĩ",
          exact: true,
        }),
        d = page.getByRole("region", {
          name: "Chương trình đào tạo Tiến sĩ",
          exact: true,
        });
      await m
        .getByText(count + " phiên bản đã ban hành", { exact: true })
        .waitFor();
      await d.getByText("1 phiên bản đã ban hành", { exact: true }).waitFor();
      const ownTitle =
          "TEST CTĐT " + (facultyId === "1" ? "FIT_D" : "FBE_D") + " " + f.mark,
        foreignTitle =
          "TEST CTĐT " + (facultyId === "1" ? "FBE_D" : "FIT_D") + " " + f.mark;
      eq(await d.getByRole("link", { name: ownTitle, exact: true }).count(), 1);
      eq(
        await d.getByRole("link", { name: foreignTitle, exact: true }).count(),
        0,
      );
      eq(
        (await page.getByText("Chương trình của ", { exact: false }).count()) >
          0,
        true,
      );
      await d.getByRole("link", { name: ownTitle, exact: true }).click();
      await page
        .getByRole("heading", { name: ownTitle, exact: true })
        .waitFor();
      checks++;
      await page.goto(
        f.base +
          "/chuong-trinh-dao-tao/" +
          (facultyId === "1" ? f.fbeDoctor : f.fitDoctor),
      );
      await page
        .getByRole("heading", {
          name: "Chưa thể hiển thị chương trình",
          exact: true,
        })
        .waitFor();
      checks++;
      await context.close();
    }
    const no = await browser.newContext();
    await no.addCookies([
      {
        name: "ctdt_access_token",
        value: f.none.cookie.split("=").slice(1).join("="),
        url: f.base,
      },
    ]);
    const np = await no.newPage();
    await np.goto(f.base + "/chuong-trinh-dao-tao");
    await np
      .getByText("Tài khoản chưa được gắn khoa.", { exact: true })
      .waitFor();
    eq(await np.getByRole("listitem").count(), 0);
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
