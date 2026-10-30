/* Optional Playwright test; only fixtures from the disposable grade integration. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
if (
  process.env.GRADE_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_grade_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error("Disposable grading DB required.");
const fixture = JSON.parse(
  fs.readFileSync(
    process.env.GRADE_BROWSER_FIXTURE || "/tmp/ctdt-grade-browser.json",
    "utf8",
  ),
);
assert.equal(fixture.name, process.env.DB_DATABASE);
const mod = process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
  { chromium } = require(mod),
  { expect } = require(mod + "/test");
const base = fixture.base,
  route = "/dashboard/quan-ly-diem",
  errors = [];
async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1550, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      errors.push({ message: e.message, stack: e.stack, url: page.url() }),
    );
    await page.goto(base + "/dang-nhap");
    await page.locator("#identifier").fill(fixture.officer.username);
    await page.locator("#password").fill(fixture.officer.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await page.goto(base + route);
    await page
      .getByRole("button", { name: "Lớp & quy tắc chấm điểm", exact: true })
      .click();
    await page
      .getByLabel("Tìm kiếm", { exact: true })
      .fill(fixture.offering.classCode);
    const classRow = page
      .getByRole("row")
      .filter({ hasText: fixture.offering.classCode });
    await classRow
      .getByRole("button", { name: "Quy tắc chấm điểm", exact: true })
      .click();
    const policy = page.getByRole("dialog", {
      name: "Quy tắc chấm điểm lớp học phần",
    });
    await expect(
      policy.getByLabel("attendanceWeight", { exact: true }),
    ).toHaveValue("");
    await expect(
      policy.getByLabel("midtermWeight", { exact: true }),
    ).toHaveValue("");
    await expect(policy.getByLabel("examWeight", { exact: true })).toHaveValue(
      "",
    );
    await policy.getByLabel("attendanceWeight", { exact: true }).fill("20");
    await policy.getByLabel("midtermWeight", { exact: true }).fill("30");
    await policy.getByLabel("examWeight", { exact: true }).fill("50");
    await policy.getByLabel("Điểm đạt của lớp", { exact: true }).fill("6.25");
    await policy
      .getByLabel("Số chữ số thập phân", { exact: true })
      .selectOption("2");
    await policy
      .getByLabel("Cách làm tròn", { exact: true })
      .selectOption("HALF_UP");
    await policy
      .getByLabel("Số hồ sơ / quy định áp dụng", { exact: true })
      .fill("BROWSER-TEST-POLICY");
    await policy
      .getByRole("button", { name: "Lưu quy tắc SQL", exact: true })
      .click();
    await expect(policy).toBeHidden();
    await page
      .getByRole("button", { name: "Nhập bảng điểm mới", exact: true })
      .click();
    let form = page.getByRole("dialog", { name: "Nhập bảng điểm mới" });
    await form
      .getByLabel("Tìm đăng ký học phần", { exact: true })
      .fill(fixture.student.studentCode);
    const select = form.getByLabel("Học viên / lớp đã đăng ký", {
      exact: true,
    });
    await expect(
      select.locator('option[value="' + fixture.registration.id + '"]'),
    ).toBeAttached();
    await select.selectOption(fixture.registration.id);
    await expect(
      form.getByText(/Trọng số SQL: 20% \/ 30% \/ 50%/),
    ).toBeVisible();
    await form.getByLabel("Điểm chuyên cần", { exact: true }).fill("0");
    await form.getByLabel("Điểm thi", { exact: true }).fill("0");
    await expect(form.getByLabel("Điểm giữa kỳ", { exact: true })).toHaveValue(
      "",
    );
    await form
      .getByLabel("Số hồ sơ đối chiếu", { exact: true })
      .fill("BROWSER-TEST-DRAFT");
    await form
      .getByLabel("Nội dung / lý do ghi điểm", { exact: true })
      .fill("Partial real test record, midterm is unknown");
    await form.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await expect(form).toBeHidden();
    const dialog = page.getByRole("dialog", {
      name: "Chi tiết kết quả học tập",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Chốt điểm", exact: true }),
    ).toBeDisabled();
    async function getGrade() {
      const r = await page.request.get(
        base +
          "/api/quan-ly-diem?searchTerm=" +
          encodeURIComponent(fixture.student.studentCode),
      );
      assert.equal(r.status(), 200);
      const data = await r.json();
      return data.data.find((x) => x.offeringId === fixture.offering.id);
    }
    let grade = await getGrade();
    assert.equal(grade.attendanceScore, 0);
    assert.equal(grade.midtermScore, null);
    assert.equal(grade.totalScore, null);
    assert.equal(grade.resultStatus, "INCOMPLETE");
    await dialog
      .getByRole("button", { name: "Cập nhật điểm", exact: true })
      .click();
    form = page.getByRole("dialog", {
      name: "Cập nhật điểm học phần",
      exact: true,
    });
    await form.getByLabel("Điểm giữa kỳ", { exact: true }).fill("0");
    await form
      .getByLabel("Số hồ sơ đối chiếu", { exact: true })
      .fill("BROWSER-TEST-COMPLETE");
    await form
      .getByLabel("Nội dung / lý do ghi điểm", { exact: true })
      .fill("All official component scores are zero");
    await form
      .getByRole("button", { name: "Lưu điều chỉnh", exact: true })
      .click();
    await expect(form).toBeHidden();
    await expect(
      dialog.getByRole("button", { name: "Chốt điểm", exact: true }),
    ).toBeEnabled();
    await dialog
      .getByRole("button", { name: "Chốt điểm", exact: true })
      .click();
    const finalize = page.getByRole("dialog", {
      name: "Chốt kết quả học phần",
      exact: true,
    });
    await finalize
      .getByLabel("Số hồ sơ", { exact: true })
      .fill("BROWSER-TEST-FINAL");
    await finalize
      .getByLabel("Lý do / nội dung xác nhận", { exact: true })
      .fill("Confirmed final class result against official record");
    await finalize
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(finalize).toBeHidden();
    grade = await getGrade();
    assert.equal(grade.resultStatus, "FAILED");
    assert.equal(grade.totalScore, 0);
    assert.equal(grade.state, "FINALIZED");
    await dialog
      .getByRole("button", { name: "Cập nhật điểm", exact: true })
      .click();
    form = page.getByRole("dialog", {
      name: "Cập nhật điểm học phần",
      exact: true,
    });
    for (const name of ["Điểm chuyên cần", "Điểm giữa kỳ", "Điểm thi"])
      await form.getByLabel(name, { exact: true }).fill("8");
    await form
      .getByLabel("Số hồ sơ đối chiếu", { exact: true })
      .fill("BROWSER-TEST-CORRECTION");
    await form
      .getByLabel("Nội dung / lý do ghi điểm", { exact: true })
      .fill("Corrected against officially amended score record");
    await form
      .getByRole("button", { name: "Lưu điều chỉnh", exact: true })
      .click();
    await expect(form).toBeHidden();
    grade = await getGrade();
    assert.equal(grade.resultStatus, "PASSED");
    assert.equal(grade.totalScore, 8);
    await page.reload();
    await page
      .getByLabel("Tìm kiếm", { exact: true })
      .fill(fixture.student.studentCode);
    await page
      .getByRole("row")
      .filter({ hasText: fixture.student.studentCode })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    const detailResponse = await page.request.get(
      base + "/api/quan-ly-diem/" + grade.id,
    );
    const after = await detailResponse.json();
    assert.equal(after.totalScore, 8);
    assert(after.history.length >= 4);
    await page.screenshot({
      path: "/tmp/ctdt-grade-browser/grade-ui.png",
      fullPage: true,
    });
    // Legacy rows are corrected from explicit documents; no component scores are invented.
    await page.keyboard.press("Escape");
    await page.getByLabel("Tìm kiếm", { exact: true }).fill("SV001");
    await page
      .getByRole("row")
      .filter({ hasText: "PHI501" })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Điều chỉnh theo hồ sơ", exact: true })
      .click();
    const legacy = page.getByRole("dialog", {
      name: "Điều chỉnh kết quả cũ theo hồ sơ",
      exact: true,
    });
    await expect(
      legacy.getByLabel("Điểm / ký hiệu chính thức", { exact: true }),
    ).toHaveValue("8.0");
    await legacy
      .getByLabel("Điểm / ký hiệu chính thức", { exact: true })
      .fill("8.25");
    await legacy
      .getByLabel("Số hồ sơ đối chiếu", { exact: true })
      .fill("BROWSER-LEGACY-DOC");
    await legacy
      .getByLabel("Nội dung / lý do ghi điểm", { exact: true })
      .fill("Corrected legacy result according to official record");
    await legacy
      .getByRole("button", { name: "Lưu điều chỉnh", exact: true })
      .click();
    await expect(legacy).toBeHidden();
    const legacyResult = await (
      await page.request.get(base + "/api/quan-ly-diem/1")
    ).json();
    assert.equal(legacyResult.grade, "8.25");
    assert.equal(legacyResult.attendanceScore, null);
    assert.equal(legacyResult.state, "LEGACY");
    async function as(actor) {
      const c = await browser.newContext();
      await c.addCookies([
        {
          name: "ctdt_access_token",
          value: actor.token,
          url: base,
          httpOnly: true,
        },
      ]);
      const p = await c.newPage();
      p.on("pageerror", (e) =>
        errors.push({ message: e.message, stack: e.stack, url: page.url() }),
      );
      await p.goto(base + route);
      return p;
    }
    const admin = await as(fixture.admin);
    await expect(
      admin.getByRole("button", { name: "Nhập bảng điểm mới", exact: true }),
    ).toHaveCount(0);
    await admin
      .getByLabel("Tìm kiếm", { exact: true })
      .fill(fixture.student.studentCode);
    await admin
      .getByRole("row")
      .filter({ hasText: fixture.student.studentCode })
      .getByRole("button", { name: "Chi tiết", exact: true })
      .click();
    await expect(
      admin.getByRole("button", { name: "Cập nhật điểm", exact: true }),
    ).toHaveCount(0);
    const fbe = await as(fixture.fbe);
    await fbe
      .getByLabel("Tìm kiếm", { exact: true })
      .fill(fixture.student.studentCode);
    await expect(
      fbe.getByRole("row").filter({ hasText: fixture.student.studentCode }),
    ).toHaveCount(0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: browser login, SQL policy creation, zero/null distinction, draft/final/correction, reload persistence, legacy correction and role/scope checks; no runtime errors.",
    );
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
