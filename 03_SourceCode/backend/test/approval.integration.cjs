/* Real JWT + HTTP proxy + transactional SQL. Disposable database only. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.APPROVAL_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_approval_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw Error(
    "Use APPROVAL_TEST_ALLOW_WRITES=1 and disposable ctdt_approval_review_<timestamp> database.",
  );
const { DataSource } = require("typeorm"),
  { JwtService } = require("@nestjs/jwt"),
  bcrypt = require("bcryptjs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const base = process.env.APPROVAL_TEST_URL || "http://localhost:3101",
  marker = "apr_" + Date.now(),
  prefix = "/api/xet-duyet",
  programPrefix = "/api/chuong-trinh-dao-tao";
let checks = 0,
  sequence = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
async function http(url, account, status = 200, body, form, origin = base) {
  const response = await fetch(base + url, {
    method: body === undefined && !form ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(account ? { Cookie: account.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
    signal: AbortSignal.timeout(60000),
  });
  const type = response.headers.get("content-type") || "";
  const result = type.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  same(response.status, status, url + " " + JSON.stringify(result?.message));
  return result;
}
async function actor(role, scopeType = "GLOBAL", target) {
  const username = marker + "_" + ++sequence,
    password = "ApprovalTest123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [
      username,
      username + "@example.invalid",
      "Kiểm thử " + role,
      await bcrypt.hash(password, 4),
    ],
  );
  const [u] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [username],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [u.id, role],
  );
  const col = {
    ORG_UNIT: "organizational_unit_id",
    PROGRAM: "program_id",
    MAJOR: "major_id",
  }[scopeType];
  await db.query(
    "INSERT INTO user_scopes(user_id,scope_type" +
      (col ? "," + col : "") +
      ") VALUES(?,?" +
      (col ? ",?" : "") +
      ")",
    col ? [u.id, scopeType, target] : [u.id, scopeType],
  );
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, u.id],
  );
  const token = new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: u.id, jti: sid },
    { expiresIn: "30m" },
  );
  return { ...u, username, password, cookie: "ctdt_access_token=" + token };
}
async function pending(program, reviewer) {
  const list = await http(
    prefix + "?status=PENDING&versionId=" + program.id,
    reviewer,
  );
  same(list.meta.total, 1, "one pending cycle");
  return http(prefix + "/" + list.data[0].id, reviewer);
}
const minutes = {
  hoiDongThamDinh: "Hội đồng kiểm thử",
  chuTichHoidong: "Người Chủ tịch",
  thuKhao: "Người Thư ký",
  ngayHop: today,
  soBienBan: "TEST-ONLY",
  ketLuan: "YEU_CAU_SUA_DOI",
  yKienDongGop: "Bổ sung nội dung theo biên bản.",
};
const payload = (item, extra = {}) => ({
  ...minutes,
  revision: item.program.revision,
  requestRevision: item.revision,
  ...extra,
});
async function run() {
  await db.initialize();
  const officer = await actor("TRAINING_OFFICER"),
    reviewer = await actor("APPROVER"),
    admin = await actor("ADMIN");
  // A clone-only JWT session probe prevents writes through an incorrectly configured source backend.
  same(
    (await http("/api/auth/profile", reviewer)).username,
    reviewer.username,
    "clone-only JWT session probe",
  );
  await http(prefix, null, 401);
  await http(prefix, { cookie: "ctdt_access_token=invalid" }, 401);
  await http(prefix, officer, 403);
  await http(prefix, admin, 403);
  await http(
    prefix + "/1/bat-dau",
    reviewer,
    403,
    { requestRevision: 0 },
    undefined,
    "https://invalid.example",
  );
  await http(prefix + "?page=0", reviewer, 400);
  await http(prefix + "?limit=101", reviewer, 400);
  await http(prefix + "?status=PUBLISHED", reviewer, 400);
  await http(prefix + "/bad", reviewer, 404);
  const [refs] = await db.query(
    "SELECT CAST(e.id AS CHAR) levelId,CAST(m.id AS CHAR) majorId,CAST(m.organizational_unit_id AS CHAR) unitId FROM education_levels e CROSS JOIN majors m WHERE e.level_code='MASTER' AND e.status='ACTIVE' AND m.status='ACTIVE' ORDER BY m.id LIMIT 1",
  );
  const [other] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE id<>? AND NOT EXISTS(SELECT 1 FROM organizational_unit_closure c WHERE c.ancestor_id=organizational_units.id AND c.descendant_id=?) LIMIT 1",
    [refs.unitId, refs.unitId],
  );
  const foreign = await actor("APPROVER", "ORG_UNIT", other.id);
  const create = () =>
    http(programPrefix, officer, 201, {
      maCTDT: marker + "_" + ++sequence,
      maPhienBan: "v1",
      tenCTDT: "CTĐT kiểm thử xét duyệt",
      tenTiengAnh: "",
      educationLevelId: refs.levelId,
      majorId: refs.majorId,
      managingUnitId: refs.unitId,
      hinhThucDaoTao: "CHINH_QUY",
      thoiGianDaoTao: "",
      khoaTuyenSinh: "2026 - 2028",
      tongTinChiYeuCau: 60,
      chuanDauRaTiengAnh: "",
      chuanDauRaTinHoc: "",
      soQuyetDinhBanHanh: "TEST-ONLY-QD",
      ngayBanHanh: today,
      moTa: "",
    });
  let program = await create();
  const versions = [];
  for (const [index, credits] of [54, 6].entries()) {
    const code = marker + "_HP_" + index;
    await db.query(
      "INSERT INTO courses(owning_unit_id,course_code) VALUES(?,?)",
      [refs.unitId, code],
    );
    const [c] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM courses WHERE course_code=?",
      [code],
    );
    await db.query(
      "INSERT INTO course_versions(course_id,version_no,course_name,credits,effective_from,status,created_by) VALUES(?,1,?,?,?,'ACTIVE',?)",
      [c.id, "Học phần kiểm thử " + index, credits, today, officer.id],
    );
    const [v] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM course_versions WHERE course_id=?",
      [c.id],
    );
    versions.push(v.id);
  }
  const structure = {
    revision: program.revision,
    tracks: program.tracks.map((t) => ({
      id: t.id,
      groups: t.groups.map((g, i) => ({
        id: g.id,
        minimumCredits: i === 0 ? 60 : 0,
      })),
      courses: versions.map((v, i) => ({
        courseVersionId: v,
        groupId: t.groups[0].id,
        requirementType: i === 0 ? "REQUIRED" : "ELECTIVE",
        semester: null,
      })),
    })),
  };
  const response = await fetch(
    base + programPrefix + "/" + program.id + "/cau-truc",
    {
      method: "PUT",
      headers: {
        Origin: base,
        Cookie: officer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(structure),
    },
  );
  same(response.status, 200, "valid curriculum save");
  program = await response.json();
  program = await http(
    programPrefix + "/" + program.id + "/gui-duyet",
    officer,
    201,
    { revision: program.revision },
  );
  let item = await pending(program, reviewer),
    firstId = item.id;
  same(item.status, "PENDING", "submitted approval request");
  same(item.minutes, null, "no invented minutes");
  await http(prefix + "/" + item.id, foreign, 404);
  await http(prefix + "/" + item.id + "/bat-dau", foreign, 404, {
    requestRevision: item.revision,
  });
  await http(prefix + "/" + item.id + "/ket-luan", foreign, 404, payload(item));
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='APPROVER'",
    [officer.id],
  );
  await http(prefix + "/" + item.id + "/bat-dau", officer, 403, {
    requestRevision: item.revision,
  });
  await http(prefix + "/" + item.id + "/ket-luan", officer, 403, payload(item));
  await http(prefix + "/" + item.id + "/bat-dau", reviewer, 400, {
    requestRevision: "0",
  });
  await http(prefix + "/" + item.id + "/bat-dau", reviewer, 409, {
    requestRevision: item.revision + 1,
  });
  const beforeStart = JSON.stringify(
    await db.query(
      "SELECT current_status,review_started_at,revision FROM approval_requests WHERE id=?",
      [item.id],
    ),
  );
  await db.query(
    "CREATE TRIGGER test_approval_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='START_REVIEW' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST rollback'; END IF; END",
  );
  try {
    await http(prefix + "/" + item.id + "/bat-dau", reviewer, 409, {
      requestRevision: item.revision,
    });
  } finally {
    await db.query("DROP TRIGGER test_approval_audit_failure");
  }
  same(
    JSON.stringify(
      await db.query(
        "SELECT current_status,review_started_at,revision FROM approval_requests WHERE id=?",
        [item.id],
      ),
    ),
    beforeStart,
    "audit failure rolls back request state",
  );
  same(
    (await http(programPrefix + "/" + program.id, reviewer)).status,
    "SUBMITTED",
    "audit failure rolls back program state",
  );
  const startRequest = () =>
    fetch(base + prefix + "/" + item.id + "/bat-dau", {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: reviewer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestRevision: item.revision }),
    });
  const starts = await Promise.all([startRequest(), startRequest()]);
  same(starts.map((r) => r.status).sort(), [201, 409], "concurrent starts");
  item = await http(prefix + "/" + item.id, reviewer);
  same(item.program.status, "REVIEWING", "program workflow starts");
  same(
    item.actions.filter((x) => x.action === "START_REVIEW").length,
    1,
    "one START_REVIEW action",
  );
  await http(
    prefix + "/" + item.id + "/ket-luan",
    reviewer,
    409,
    payload(item, { requestRevision: item.revision - 1 }),
  );
  await http(
    prefix + "/" + item.id + "/ket-luan",
    reviewer,
    400,
    payload(item, { yKienDongGop: "   " }),
  );
  await http(
    prefix + "/" + item.id + "/ket-luan",
    reviewer,
    400,
    payload(item, { chuTichHoidong: minutes.thuKhao }),
  );
  await http(
    prefix + "/" + item.id + "/ket-luan",
    reviewer,
    400,
    payload(item, { ngayHop: "2000-01-01" }),
  );
  await http(
    prefix + "/" + item.id + "/ket-luan",
    reviewer,
    400,
    payload(item, { ngayHop: "2999-01-01" }),
  );
  const bad = new FormData();
  bad.set("file", new Blob(["text"]), "bad.pdf");
  await http(
    prefix + "/" + item.id + "/tai-lieu",
    reviewer,
    400,
    undefined,
    bad,
  );
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
  const form = new FormData();
  form.set(
    "file",
    new Blob([pdf], { type: "application/pdf" }),
    "biên-bản.pdf",
  );
  const doc = await http(
    prefix + "/" + item.id + "/tai-lieu",
    reviewer,
    201,
    undefined,
    form,
  );
  same(doc.name, "biên-bản.pdf", "Unicode document name");
  const [association] = await db.query(
    "SELECT CAST(approval_request_id AS CHAR) id FROM program_review_documents WHERE id=?",
    [doc.id],
  );
  same(association.id, item.id, "exact cycle association");
  same(
    await http(prefix + "/" + item.id + "/tai-lieu/" + doc.id, reviewer),
    pdf,
    "real document bytes",
  );
  await http(prefix + "/" + item.id + "/tai-lieu/" + doc.id, foreign, 404);
  await db.query(
    "CREATE TRIGGER test_approval_final_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW BEGIN IF NEW.action='RETURN' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='TEST final rollback'; END IF; END",
  );
  try {
    await http(
      prefix + "/" + item.id + "/ket-luan",
      reviewer,
      409,
      payload(item),
    );
  } finally {
    await db.query("DROP TRIGGER test_approval_final_audit_failure");
  }
  const rollback = await http(prefix + "/" + item.id, reviewer);
  same(rollback.status, "PENDING", "decision audit failure rolls back request");
  same(rollback.minutes, null, "decision audit failure rolls back minutes");
  same(
    rollback.actions.filter((x) => x.action === "RETURN").length,
    0,
    "decision audit failure rolls back action",
  );
  const decisions = await Promise.all(
    [1, 2].map(() =>
      fetch(base + prefix + "/" + item.id + "/ket-luan", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: reviewer.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload(item)),
      }),
    ),
  );
  same(
    decisions.map((r) => r.status).sort(),
    [201, 409],
    "concurrent decisions only one succeeds",
  );
  item = await http(prefix + "/" + item.id, reviewer);
  same(item.status, "RETURNED", "return request");
  same(item.program.status, "RETURNED", "return program");
  same(item.minutes.ketLuan, "YEU_CAU_SUA_DOI", "real minutes persisted");
  same(item.nextReminderAt, null, "completed request no next reminder");
  await http(
    prefix + "/" + item.id + "/tai-lieu",
    reviewer,
    409,
    undefined,
    form,
  );
  await assert.rejects(
    db.query(
      "UPDATE program_review_minutes SET comments='overwrite' WHERE approval_request_id=?",
      [item.id],
    ),
  );
  checks++;
  await assert.rejects(
    db.query("DELETE FROM approval_actions WHERE approval_request_id=?", [
      item.id,
    ]),
  );
  checks++;
  await assert.rejects(
    db.query(
      "UPDATE approval_requests SET latest_comment='overwrite' WHERE id=?",
      [item.id],
    ),
  );
  checks++;
  await assert.rejects(
    db.query("DELETE FROM program_review_documents WHERE id=?", [doc.id]),
  );
  checks++;
  program = await http(programPrefix + "/" + program.id, officer);
  program = await http(
    programPrefix + "/" + program.id + "/gui-duyet",
    officer,
    201,
    { revision: program.revision },
  );
  const second = await pending(program, reviewer);
  assert.notEqual(second.id, firstId);
  checks++;
  same(second.minutes, null, "resubmission has no old minutes");
  same(second.documents.length, 0, "old cycle documents not copied");
  await http(
    prefix + "/" + firstId + "/ket-luan",
    reviewer,
    409,
    payload(second),
  );
  const approved = await http(
    prefix + "/" + second.id + "/ket-luan",
    reviewer,
    201,
    payload(second, {
      ketLuan: "DAT_DIEU_KIEN",
      yKienDongGop: "Đủ điều kiện.",
    }),
  );
  same(approved.status, "APPROVED", "approve request");
  same(approved.program.status, "PUBLISHED", "publish exact version");
  assert(approved.program.lockedAt);
  checks++;
  same(
    (await http(prefix + "/" + firstId, reviewer)).minutes.ketLuan,
    "YEU_CAU_SUA_DOI",
    "old minutes retained after approval",
  );
  const all = await http(
    prefix + "?status=ALL&versionId=" + program.id,
    reviewer,
  );
  same(all.meta.total, 2, "both review rounds visible");
  const programOnly = await actor("APPROVER", "PROGRAM", program.programId);
  same(
    (await http(prefix + "?status=ALL", programOnly)).meta.total,
    2,
    "PROGRAM scope works",
  );
  same(
    (await http(prefix + "?status=ALL", foreign)).meta.total,
    0,
    "foreign unit has no FIT histories",
  );
  await db.query("DELETE FROM user_roles WHERE user_id=?", [programOnly.id]);
  await http(prefix, programOnly, 403);
  const metadata = await http(programPrefix + "/" + program.id, officer);
  let collision = await http(
    programPrefix + "/danh-muc/" + program.programId + "/phien-ban",
    officer,
    201,
    { ...metadata, maPhienBan: "conflict-" + Date.now() },
  );
  const collisionStructure = {
    revision: collision.revision,
    tracks: collision.tracks.map((t) => ({
      id: t.id,
      groups: t.groups.map((g, i) => ({
        id: g.id,
        minimumCredits: i === 0 ? 60 : 0,
      })),
      courses: versions.map((v, i) => ({
        courseVersionId: v,
        groupId: t.groups[0].id,
        requirementType: i === 0 ? "REQUIRED" : "ELECTIVE",
        semester: null,
      })),
    })),
  };
  const savedCollision = await fetch(
    base + programPrefix + "/" + collision.id + "/cau-truc",
    {
      method: "PUT",
      headers: {
        Origin: base,
        Cookie: officer.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(collisionStructure),
    },
  );
  same(savedCollision.status, 200, "same-cohort comparison structure");
  collision = await savedCollision.json();
  collision = await http(
    programPrefix + "/" + collision.id + "/gui-duyet",
    officer,
    201,
    { revision: collision.revision },
  );
  const collisionRequest = await pending(collision, reviewer);
  await http(
    prefix + "/" + collisionRequest.id + "/ket-luan",
    reviewer,
    409,
    payload(collisionRequest, { ketLuan: "DAT_DIEU_KIEN" }),
  );
  const collisionAfter = await http(
    prefix + "/" + collisionRequest.id,
    reviewer,
  );
  same(
    collisionAfter.status,
    "PENDING",
    "duplicate published cohort leaves pending request",
  );
  same(
    collisionAfter.minutes,
    null,
    "duplicate publication rolls back minutes",
  );
  same(
    collisionAfter.program.status,
    "SUBMITTED",
    "does not archive/replace published version automatically",
  );
  const legacyKey = randomUUID() + ".pdf";
  await db.query(
    "INSERT INTO program_review_documents(program_version_id,storage_key,original_name,mime_type,file_size,uploaded_by) VALUES(?,?,?,'application/pdf',1,?)",
    [collision.id, legacyKey, "legacy-without-cycle.pdf", reviewer.id],
  );
  const legacyDetail = await http(prefix + "/" + collisionRequest.id, reviewer);
  const legacyDocument = legacyDetail.documents.find(
    (d) => d.name === "legacy-without-cycle.pdf",
  );
  same(
    legacyDocument.requestId,
    null,
    "legacy document provenance remains unknown",
  );
  await http(
    prefix + "/" + collisionRequest.id + "/tai-lieu/" + legacyDocument.id,
    reviewer,
    404,
  );
  await http(
    prefix + "/" + collisionRequest.id + "/tai-lieu/18446744073709551615",
    reviewer,
    404,
  );
  const [legacyRow] = await db.query(
    "SELECT CAST(r.id AS CHAR) id FROM approval_requests r JOIN program_versions v ON v.id=r.program_version_id LEFT JOIN program_ui_details d ON d.program_version_id=v.id WHERE r.current_status='PENDING' AND v.status='SUBMITTED' AND d.program_version_id IS NULL LIMIT 1",
  );
  const legacy = legacyRow
    ? await http(prefix + "/" + legacyRow.id, reviewer)
    : null;
  if (legacy?.status === "PENDING") {
    const [before] = await db.query(
      "SELECT COUNT(*) total FROM program_ui_details WHERE program_version_id=?",
      [legacy.versionId],
    );
    if (Number(before.total) === 0) {
      await http(prefix + "/" + legacy.id + "/bat-dau", reviewer, 201, {
        requestRevision: legacy.revision,
      });
      const [after] = await db.query(
        "SELECT COUNT(*) total FROM program_ui_details WHERE program_version_id=?",
        [legacy.versionId],
      );
      same(
        Number(after.total),
        0,
        "legacy workflow does not fabricate UI defaults",
      );
      await http(
        prefix + "/" + legacy.id + "/ket-luan",
        reviewer,
        400,
        payload(await http(prefix + "/" + legacy.id, reviewer), {
          ketLuan: "DAT_DIEU_KIEN",
          yKienDongGop: "",
        }),
      );
    }
  }
  fs.writeFileSync(
    process.env.APPROVAL_BROWSER_FIXTURE || "/tmp/ctdt-approval-browser.json",
    JSON.stringify({
      name: process.env.DB_DATABASE,
      base,
      reviewer,
      officer,
      foreign,
      admin,
      historicalRequest: firstId,
      approvedRequest: second.id,
      versionId: program.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS " +
      checks +
      " approval JWT/proxy/SQL checks on disposable clone; browser fixture ready.",
  );
}
run()
  .catch((e) => {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  })
  .finally(() => (db.isInitialized ? db.destroy() : undefined));
