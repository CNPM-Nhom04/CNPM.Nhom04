/* Read/write checks ONLY against a disposable clone, never the working database. */
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
const { DataSource } = require("typeorm");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
const mark = "portal_" + Date.now();
let checks = 0;
function eq(a, b, n) {
  assert.deepEqual(a, b, n);
  checks++;
}
async function api(
  url,
  actor = null,
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
  const data = await response.json();
  eq(response.status, expected, url + " " + JSON.stringify(data));
  return data;
}
async function run() {
  await db.initialize();
  const options = await api("/api/public/options");
  assert(options.levels.length);
  checks++;
  const publicPrograms = await api("/api/public/chuong-trinh-dao-tao");
  const [count] = await db.query(
    "SELECT COUNT(*) total FROM program_versions v JOIN training_programs p ON p.id=v.program_id JOIN majors m ON m.id=p.major_id JOIN organizational_units u ON u.id=p.managing_unit_id JOIN education_levels e ON e.id=p.education_level_id WHERE v.status='PUBLISHED' AND p.status='ACTIVE' AND m.status='ACTIVE' AND u.status='ACTIVE' AND e.status='ACTIVE'",
  );
  eq(publicPrograms.meta.total, Number(count.total));
  await api("/api/public/chuong-trinh-dao-tao?limit=101", null, 400);
  const [draft] = await db.query(
    "SELECT id FROM program_versions WHERE status<>'PUBLISHED' LIMIT 1",
  );
  assert(draft);
  await api("/api/public/chuong-trinh-dao-tao/" + draft.id, null, 404);
  const detail = await api("/api/public/chuong-trinh-dao-tao/2");
  eq(Object.hasOwn(detail, "requestedBy"), false);
  eq(Object.hasOwn(detail, "approvalHistory"), false);
  eq(Object.hasOwn(detail, "documents"), false);
  const [courses] = await db.query(
    "SELECT COUNT(*) n FROM curriculum_courses cc JOIN program_version_tracks t ON t.id=cc.program_version_track_id WHERE t.program_version_id=2 AND t.status='ACTIVE'",
  );
  eq(
    detail.tracks.reduce((sum, t) => sum + t.courses.length, 0),
    Number(courses.n),
  );
  const home = await fetch(f.base + "/");
  eq(home.status, 200);
  eq((await home.text()).includes("Đăng ký nhận thông tin tuyển sinh"), true);
  const admin = "/api/admin/cong-thong-tin";
  await api(admin + "/van-ban", null, 401);
  await api(admin + "/dang-ky", f.officer, 403);
  await api(admin + "/van-ban", f.officer, 403);
  const docInput = {
    title: "TEST — Văn bản " + mark,
    category: "REGULATION",
    summary: "Văn bản kiểm thử, không dùng làm quy định.",
    documentUrl: "https://example.org/test.pdf",
    referenceNumber: "TEST-" + mark,
    issuedOn: "2026-11-02",
    status: "DRAFT",
  };
  await api(admin + "/van-ban", f.admin, 400, {
    ...docInput,
    documentUrl: "javascript:alert(1)",
  });
  let doc = await api(admin + "/van-ban", f.admin, 201, docInput);
  eq(
    (await api("/api/public/van-ban?status=ALL&search=" + mark)).meta.total,
    0,
    "public status parameter cannot expose drafts",
  );
  eq((await api(admin + "/van-ban?search=" + mark, f.admin)).meta.total, 1);
  doc = await api(
    admin + "/van-ban/" + doc.id,
    f.admin,
    200,
    { ...docInput, status: "PUBLISHED", revision: doc.revision },
    "PUT",
  );
  eq(
    (await api("/api/public/van-ban?category=REGULATION&search=" + mark))
      .data[0].id,
    doc.id,
  );
  await api(
    admin + "/van-ban/" + doc.id,
    f.admin,
    409,
    { ...docInput, revision: 1 },
    "PUT",
  );
  await api(
    admin + "/van-ban/" + doc.id + "?revision=1",
    f.admin,
    409,
    undefined,
    "DELETE",
  );
  const admission = await api(admin + "/van-ban", f.admin, 201, {
    ...docInput,
    title: "TEST — Thông tin tuyển sinh " + mark,
    category: "ADMISSION",
    status: "PUBLISHED",
  });
  eq(
    (await api("/api/public/van-ban?category=ADMISSION&search=" + mark)).data[0]
      .id,
    admission.id,
  );
  const subscription = {
    familyName: "Nguyễn Văn",
    givenName: "Kiểm thử",
    email: mark + "@example.invalid",
    phone: "0901234567",
    levelId: options.levels[0].id,
    majorId: options.majors[0].id,
    previousMajor: "Ngành kiểm thử",
    graduationYear: 2020,
    message: "Yêu cầu kiểm thử, không gửi email.",
    consent: true,
  };
  const sub = "/api/public/dang-ky-thong-tin";
  await api(sub, null, 400, { ...subscription, consent: false });
  await api(sub, null, 400, { ...subscription, email: "invalid" });
  await api(sub, null, 400, { ...subscription, levelId: "999999999" });
  await api(sub, null, 400, { ...subscription, majorId: "999999999" });
  await api(sub, null, 400, { ...subscription, graduationYear: 2099 });
  await api(sub, null, 400, { ...subscription, website: "bot" });
  await api(sub, null, 403, subscription, "POST", "https://outside.invalid");
  const result = await api(sub, null, 201, subscription);
  eq(Object.hasOwn(result, "id"), false, "no registration lookup exposed");
  await api(sub, null, 201, {
    ...subscription,
    email: subscription.email.toUpperCase(),
    givenName: "Attempt overwrite",
  });
  const rows = await db.query(
    "SELECT CAST(id AS CHAR) id,given_name,level_name_snapshot,major_name_snapshot,status,revision,consented_at FROM admission_subscriptions WHERE email=?",
    [subscription.email],
  );
  eq(rows.length, 1);
  eq(rows[0].given_name, "Kiểm thử");
  assert(rows[0].consented_at);
  checks++;
  await api("/api/public/dang-ky", null, 404);
  await api(admin + "/dang-ky", null, 401);
  const list = await api(admin + "/dang-ky?search=" + mark, f.admin);
  eq(list.meta.total, 1);
  eq(list.data[0].email, subscription.email);
  await api(admin + "/dang-ky/" + rows[0].id + "/da-lien-he", f.admin, 201, {
    revision: 1,
  });
  await api(admin + "/dang-ky/" + rows[0].id + "/da-lien-he", f.admin, 409, {
    revision: 1,
  });
  eq(
    (await api(admin + "/dang-ky?status=CONTACTED&search=" + mark, f.admin))
      .data.length,
    1,
  );
  eq(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) n FROM audit_logs WHERE entity_type='admission_subscription' AND entity_id=?",
          [rows[0].id],
        )
      )[0].n,
    ),
    1,
  );
  // Changing the actual SQL publication state removes public access.
  const hidden = await api(admin + "/van-ban", f.admin, 201, {
    ...docInput,
    title: "TEST — Temporary " + mark,
    status: "PUBLISHED",
  });
  await api(
    admin + "/van-ban/" + hidden.id,
    f.admin,
    200,
    { ...docInput, status: "DRAFT", revision: hidden.revision },
    "PUT",
  );
  eq(
    (await api("/api/public/van-ban?search=" + mark)).data.some(
      (x) => x.id === hidden.id,
    ),
    false,
  );
  await api(
    admin + "/van-ban/" + hidden.id + "?revision=2",
    f.admin,
    200,
    undefined,
    "DELETE",
  );
  // Audit failure rolls back document publication.
  await db.query(
    "CREATE TRIGGER trg_portal_test BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.entity_type='public_document' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST_PORTAL'; END IF; END",
  );
  try {
    await api(admin + "/van-ban", f.admin, 502, {
      ...docInput,
      title: mark + "_rollback",
    });
    eq(
      Number(
        (
          await db.query(
            "SELECT COUNT(*) n FROM public_documents WHERE title=?",
            [mark + "_rollback"],
          )
        )[0].n,
      ),
      0,
    );
  } finally {
    await db.query("DROP TRIGGER trg_portal_test");
  }
  const tooLong = await fetch(f.base + sub, {
    method: "POST",
    headers: { Origin: f.base, "Content-Type": "application/json" },
    body: JSON.stringify({ ...subscription, message: "a".repeat(17000) }),
  });
  eq(tooLong.status, 413);
  fs.writeFileSync(
    path.join(path.dirname(process.env.MAJOR_BROWSER_FIXTURE), "portal.json"),
    JSON.stringify({ mark, docId: doc.id, admissionId: admission.id }),
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
