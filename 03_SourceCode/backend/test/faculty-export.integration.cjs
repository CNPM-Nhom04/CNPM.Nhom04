/* Mutating checks ONLY on a disposable clone, using major.integration.cjs fixture. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.MAJOR_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_major_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error("Disposable clone required");
const f = JSON.parse(
  fs.readFileSync(
    process.env.MAJOR_BROWSER_FIXTURE || "/tmp/ctdt-major-browser.json",
    "utf8",
  ),
);
assert.equal(f.database, process.env.DB_DATABASE);
const { DataSource } = require("typeorm"),
  { Workbook } = require("exceljs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
let checks = 0;
const mark = "faculty_" + Date.now();
function eq(a, b, label) {
  assert.deepEqual(a, b, label);
  checks++;
}
async function api(
  url,
  actor = f.admin,
  expected = 200,
  body,
  method = body === undefined ? "GET" : "POST",
  origin = f.base,
) {
  const response = await fetch(f.base + url, {
    method,
    headers: {
      Origin: origin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  eq(response.status, expected, url + " " + JSON.stringify(value));
  return value;
}
async function excel(url, actor = f.officer) {
  const response = await fetch(f.base + url, {
    headers: { Cookie: actor.cookie },
  });
  eq(response.status, 200, url);
  eq(response.headers.get("content-type").includes("spreadsheetml"), true);
  eq(response.headers.get("content-disposition").includes(".xlsx"), true);
  const book = new Workbook();
  await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
  return book;
}
async function run() {
  await db.initialize();
  const prefix = "/api/admin/khoa";
  await api(prefix, null, 401);
  await api(prefix, f.officer, 403);
  const list = await api(prefix);
  eq(
    list.meta.total,
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM organizational_units WHERE unit_type='FACULTY'",
        )
      )[0].n,
    ),
  );
  eq(
    list.data.some((x) => x.id === "3"),
    false,
    "department excluded",
  );
  const input = {
    code: mark,
    name: "Khoa Sư phạm " + mark,
    description: "Kiểm thử",
    status: "ACTIVE",
  };
  await api(prefix, f.admin, 400, { ...input, name: " " });
  await api(prefix, f.admin, 400, { ...input, status: "DELETED" });
  await api(prefix, f.admin, 409, { ...input, code: "FIT-IS" });
  let item = await api(prefix, f.admin, 201, input);
  eq(
    (
      await db.query("SELECT unit_type FROM organizational_units WHERE id=?", [
        item.id,
      ])
    )[0].unit_type,
    "FACULTY",
  );
  eq(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM organizational_unit_closure WHERE ancestor_id=? AND descendant_id=? AND depth=0",
          [item.id, item.id],
        )
      )[0].n,
    ),
    1,
  );
  eq(
    (
      await api(
        "/api/admin/master-data?selectedType=KHOA_QUAN_LY&searchTerm=" + mark,
      )
    ).meta.total,
    1,
    "same common catalogue",
  );
  eq(
    (await api("/api/admin/nganh-dao-tao/options")).units.some(
      (x) => x.id === item.id,
    ),
    true,
  );
  await api(
    prefix + "/3",
    f.admin,
    404,
    { ...input, expectedUpdatedAt: item.updatedAt },
    "PUT",
  );
  const old = item;
  item = await api(
    prefix + "/" + item.id,
    f.admin,
    200,
    {
      ...input,
      name: input.name + " đã sửa",
      expectedUpdatedAt: item.updatedAt,
    },
    "PUT",
  );
  await api(
    prefix + "/" + item.id,
    f.admin,
    409,
    { ...input, expectedUpdatedAt: old.updatedAt },
    "PUT",
  );
  await api(
    prefix +
      "/" +
      item.id +
      "?" +
      new URLSearchParams({ expectedUpdatedAt: old.updatedAt }),
    f.admin,
    409,
    undefined,
    "DELETE",
  );
  item = await api(
    prefix + "/" + item.id,
    f.admin,
    200,
    { ...input, status: "INACTIVE", expectedUpdatedAt: item.updatedAt },
    "PUT",
  );
  eq(
    (await api(prefix + "?status=INACTIVE&searchTerm=" + mark)).data.length,
    1,
  );
  eq(
    (await api("/api/admin/nganh-dao-tao/options")).units.some(
      (x) => x.id === item.id,
    ),
    false,
  );
  await db.query("UPDATE users SET organizational_unit_id=? WHERE id=?", [
    item.id,
    f.spOfficer.id,
  ]);
  await api(
    prefix +
      "/" +
      item.id +
      "?" +
      new URLSearchParams({ expectedUpdatedAt: item.updatedAt }),
    f.admin,
    409,
    undefined,
    "DELETE",
  );
  await db.query("UPDATE users SET organizational_unit_id=NULL WHERE id=?", [
    f.spOfficer.id,
  ]);
  await api(
    prefix +
      "/" +
      item.id +
      "?" +
      new URLSearchParams({ expectedUpdatedAt: item.updatedAt }),
    f.admin,
    200,
    undefined,
    "DELETE",
  );
  eq(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM organizational_unit_closure WHERE descendant_id=? OR ancestor_id=?",
          [item.id, item.id],
        )
      )[0].n,
    ),
    0,
  );
  eq(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM audit_logs WHERE entity_type='organizational_units' AND entity_id=? AND action='DELETE'",
          [item.id],
        )
      )[0].n,
    ),
    1,
  );
  await api(prefix, f.admin, 403, input, "POST", "https://outside.invalid");
  // Rollback both the unit and trigger-created closure if the audit fails.
  await db.query(
    "CREATE TRIGGER trg_faculty_test BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.reason='Thêm khoa " +
      mark +
      "_RB' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST'; END IF; END",
  );
  try {
    await api(prefix, f.admin, 502, { ...input, code: mark + "_RB" });
    eq(
      Number(
        (
          await db.query(
            "SELECT COUNT(*) n FROM organizational_units WHERE unit_code=?",
            [mark + "_RB"],
          )
        )[0].n,
      ),
      0,
    );
  } finally {
    await db.query("DROP TRIGGER trg_faculty_test");
  }
  // 23 matching courses prove export is not limited to one UI page.
  const coursePrefix = "/api/danh-muc-hoc-phan";
  for (let i = 0; i < 23; i++)
    await api(coursePrefix, f.officer, 201, {
      courseCode: mark + "_" + i,
      courseName: i === 0 ? "=literal Excel text" : "Học phần " + i,
      unitId: "1",
      credits: 3,
      theoryHours: 30,
      practiceHours: 15,
      effectiveFrom: "2025-01-01",
    });
  await api(coursePrefix, f.admin, 403, {
    courseCode: mark + "_other",
    courseName: "Ngoài phạm vi",
    unitId: "2",
    credits: 3,
    theoryHours: 30,
    practiceHours: 15,
    effectiveFrom: "2025-01-01",
  });
  // Seed outside-unit record in clone to verify the SQL access view, independently of create permissions.
  await db.query(
    "INSERT INTO courses(owning_unit_id,course_code,status) VALUES(2,?,'ACTIVE')",
    [mark + "_OUTSIDE"],
  );
  const filtered = await api(
    coursePrefix + "?search=" + mark + "&limit=20",
    f.officer,
  );
  eq(filtered.meta.total, 23);
  eq(filtered.data.length, 20);
  const cat = await excel(
    coursePrefix + "/xuat-excel?search=" + mark + "&page=99&limit=1",
  );
  eq(cat.getWorksheet("Danh muc hoc phan").rowCount - 1, 23);
  const rows = [];
  cat.getWorksheet("Danh muc hoc phan").eachRow((row, i) => {
    if (i > 1) rows.push(row.getCell(1).value);
  });
  eq(rows.includes(mark + "_OUTSIDE"), false);
  const zero = await excel(
    coursePrefix + "/xuat-excel?search=" + mark + "&unitId=2",
  );
  eq(
    zero.getWorksheet("Danh muc hoc phan").rowCount,
    1,
    "unit filter cannot expand scope",
  );
  const course = filtered.data[0];
  await api(coursePrefix + "/" + course.id + "/trang-thai", f.officer, 201, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  const inactive = await excel(
    coursePrefix + "/xuat-excel?search=" + mark + "&status=INACTIVE&unitId=1",
  );
  eq(inactive.getWorksheet("Danh muc hoc phan").rowCount - 1, 1);
  await api(coursePrefix + "/xuat-excel", null, 401);
  // A newer course DRAFT must not replace the ACTIVE one in the export.
  const second = filtered.data[1];
  await api(
    coursePrefix +
      "/" +
      second.id +
      "/phien-ban/" +
      second.latestVersionId +
      "/kich-hoat",
    f.officer,
    201,
    {},
  );
  await api(coursePrefix + "/" + second.id + "/phien-ban", f.officer, 201, {
    courseName: "Bản nháp mới",
    expectedLatestVersionId: second.latestVersionId,
    credits: 4,
    theoryHours: 45,
    practiceHours: 15,
    effectiveFrom: "2026-01-01",
  });
  const versions = await excel(
    coursePrefix + "/xuat-excel?search=" + second.courseCode,
  );
  const latest = versions.getWorksheet("Danh muc hoc phan").getRow(2);
  eq(latest.getCell(4).value, 2);
  eq(latest.getCell(6).value, 4);
  eq(latest.getCell(14).value, 1);
  eq(latest.getCell(16).value, 3);
  // CTDT version/hướng/groups/course snapshots/prerequisites parity against SQL.
  const versionId = "2",
    pp = "/api/chuong-trinh-dao-tao/" + versionId + "/xuat-excel";
  await api(pp, null, 401);
  await api(pp, f.admin, 403);
  await api(pp, f.spOfficer, 404);
  await api(pp + "?trackId=999999999", f.officer, 404);
  await api(pp + "?trackId=0", f.officer, 400);
  const tracks = await db.query(
    "SELECT CAST(id AS CHAR) id,required_total_credits credits FROM program_version_tracks WHERE program_version_id=? ORDER BY id",
    [versionId],
  );
  const all = await excel(pp);
  const [uiDetails] = await db.query(
    "SELECT required_total_credits credits FROM program_ui_details WHERE program_version_id=?",
    [versionId],
  );
  const commonQuota = all
    .getWorksheet("Thong tin CTDT")
    .getColumn(1)
    .values.findIndex((value) => value === "Định mức chung");
  eq(
    all.getWorksheet("Thong tin CTDT").getRow(commonQuota).getCell(2).value,
    uiDetails?.credits == null ? null : Number(uiDetails.credits),
    "no invented common quota",
  );
  eq(all.getWorksheet("Huong dao tao").rowCount - 1, tracks.length);
  for (const track of tracks) {
    const book = await excel(pp + "?trackId=" + track.id);
    eq(book.getWorksheet("Huong dao tao").rowCount, 2);
    eq(book.getWorksheet("Huong dao tao").getRow(2).getCell(1).value, track.id);
    eq(
      book.getWorksheet("Huong dao tao").getRow(2).getCell(5).value,
      Number(track.credits),
    );
    const courses = await db.query(
      "SELECT CAST(cc.id AS CHAR) id,CAST(cc.course_version_id AS CHAR) versionId,c.course_code code,cv.course_name name,cv.version_no versionNo,cv.credits,g.group_code groupCode,cc.requirement_type requirement,cc.suggested_semester semester FROM curriculum_courses cc JOIN curriculum_groups g ON g.id=cc.curriculum_group_id JOIN courses c ON c.id=cc.course_id JOIN course_versions cv ON cv.id=cc.course_version_id WHERE cc.program_version_track_id=? ORDER BY cc.display_order,cc.id",
      [track.id],
    );
    const sheet = book.getWorksheet("Khung hoc phan");
    eq(sheet.rowCount - 1, courses.length);
    courses.forEach((c, i) => {
      const r = sheet.getRow(i + 2);
      eq(
        [
          r.getCell(4).value,
          r.getCell(5).value,
          r.getCell(7).value,
          r.getCell(8).value,
          r.getCell(9).value,
          r.getCell(10).value,
          r.getCell(11).value,
          r.getCell(14).value,
          r.getCell(15).value,
        ],
        [
          c.id,
          c.groupCode,
          c.versionId,
          c.code,
          c.name,
          c.versionNo,
          Number(c.credits),
          c.requirement === "REQUIRED" ? "Bắt buộc" : "Tự chọn",
          c.semester,
        ],
      );
    });
    eq(
      book.getWorksheet("Nhom kien thuc").rowCount - 1,
      Number(
        (
          await db.query(
            "SELECT COUNT(*) n FROM curriculum_groups WHERE program_version_track_id=?",
            [track.id],
          )
        )[0].n,
      ),
    );
    const prereqs = await db.query(
      "SELECT CAST(p.curriculum_course_id AS CHAR) owner,CAST(p.prerequisite_curriculum_course_id AS CHAR) prerequisite,p.minimum_grade grade FROM curriculum_prerequisites p JOIN curriculum_courses cc ON cc.id=p.curriculum_course_id WHERE cc.program_version_track_id=? ORDER BY p.id",
      [track.id],
    );
    const pre = book.getWorksheet("Tien quyet");
    eq(pre.rowCount - 1, prereqs.length);
    const exportedPre = [];
    pre.eachRow((r, i) => {
      if (i > 1)
        exportedPre.push([
          r.getCell(3).value,
          r.getCell(5).value,
          r.getCell(8).value,
        ]);
    });
    eq(
      exportedPre.sort(),
      prereqs
        .map((p) => [
          p.owner,
          p.prerequisite,
          p.grade == null ? null : Number(p.grade),
        ])
        .sort(),
    );
  }
  fs.writeFileSync(
    path.join(path.dirname(process.env.MAJOR_BROWSER_FIXTURE), "exports.json"),
    JSON.stringify({ mark, versionId, tracks }),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ result: "PASS", checks }));
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
