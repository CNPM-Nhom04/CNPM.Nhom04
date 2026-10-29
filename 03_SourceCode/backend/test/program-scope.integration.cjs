/* Write tests: run only against a disposable database copy and matching frontend/backend. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
if (
  process.env.PROGRAM_TEST_ALLOW_WRITES !== "1" ||
  process.env.DB_DATABASE === "ctdt_management"
) {
  throw new Error(
    "Use PROGRAM_TEST_ALLOW_WRITES=1 with an isolated database copy.",
  );
}
const { DataSource } = require("typeorm");
const { JwtService } = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const base = process.env.FRONTEND_URL || "http://localhost:3101";
const prefix = "/api/chuong-trinh-dao-tao";
const marker = "scope_review_" + Date.now();
const sessions = [];
let checks = 0;
function same(a, b, label) {
  assert.deepEqual(a, b, label);
  checks++;
}
async function call(route, actor, status = 200, body, method = "POST") {
  const r = await fetch(base + route, {
    method: body === undefined ? "GET" : method,
    headers: {
      Origin: base,
      Cookie: "ctdt_access_token=" + actor.token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await r.json().catch(() => null);
  same(r.status, status, route + " " + JSON.stringify(data?.message));
  return data;
}
async function token(id) {
  const sid = randomUUID();
  sessions.push(sid);
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES (?,?,TIMESTAMPADD(MINUTE,15,UTC_TIMESTAMP(6)),15,UTC_TIMESTAMP(6))",
    [sid, id],
  );
  return new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: String(id), jti: sid },
    { expiresIn: "15m" },
  );
}
async function actor(suffix, unit, scopes) {
  const username = marker + "_" + suffix;
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,organizational_unit_id) VALUES(?,?,?,?,?)",
    [
      username,
      username + "@example.invalid",
      username,
      await bcrypt.hash("ScopeReviewPassword123!", 4),
      unit,
    ],
  );
  const [u] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [username],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='TRAINING_OFFICER'",
    [u.id],
  );
  for (const [type, target] of scopes) {
    const column = {
      ORG_UNIT: "organizational_unit_id",
      MAJOR: "major_id",
      PROGRAM: "program_id",
    }[type];
    await db.query(
      "INSERT INTO user_scopes(user_id,scope_type" +
        (column ? "," + column : "") +
        ") VALUES(?,?" +
        (column ? ",?" : "") +
        ")",
      column ? [u.id, type, target] : [u.id, type],
    );
  }
  return { id: u.id, token: await token(u.id), username };
}
function input(base, code) {
  return {
    maCTDT: code,
    maPhienBan: "v1",
    tenCTDT: "Scoped test " + code,
    educationLevelId: base.educationLevelId,
    managingUnitId: base.managingUnitId,
    majorId: base.majorId,
    hinhThucDaoTao: "CHINH_QUY",
    khoaTuyenSinh: "2026 - 2028",
    tongTinChiYeuCau: base.tongTinChiYeuCau || 120,
  };
}
(async () => {
  await db.initialize();
  try {
    const [fit] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE unit_code='FIT'",
    );
    const [fbe] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE unit_code='FBE'",
    );
    assert.ok(fit && fbe, "Seed FIT/FBE units required");
    const [mit] = await db.query(
      "SELECT CAST(id AS CHAR) id,CAST(major_id AS CHAR) major FROM training_programs WHERE program_code='MIT'",
    );
    const [bba] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM training_programs WHERE program_code='BBA'",
    );
    const [version] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM program_versions WHERE program_id=? ORDER BY id LIMIT 1",
      [mit.id],
    );
    const [course] = await db.query(
      "SELECT CAST(cv.id AS CHAR) id,CAST(cv.course_id AS CHAR) courseId FROM course_versions cv JOIN courses c ON c.id=cv.course_id WHERE cv.status='ACTIVE' AND c.owning_unit_id=? LIMIT 1",
      [fit.id],
    );
    const global = await actor("global", fit.id, [["GLOBAL"]]);
    const it = await actor("it", fit.id, [["ORG_UNIT", fit.id]]);
    const economics = await actor("economics", fbe.id, [["ORG_UNIT", fbe.id]]);
    const major = await actor("major", fit.id, [["MAJOR", mit.major]]);
    const program = await actor("program", fit.id, [["PROGRAM", mit.id]]);
    const none = await actor("none", fit.id, []);
    const multi = await actor("multi", fit.id, [
      ["ORG_UNIT", fit.id],
      ["ORG_UNIT", fbe.id],
    ]);
    const [childUnit] = await db.query(
      "SELECT CAST(descendant_id AS CHAR) id FROM organizational_unit_closure WHERE ancestor_id=? AND descendant_id<>? LIMIT 1",
      [fit.id, fit.id],
    );
    assert.ok(
      childUnit,
      "Need a child unit to check ancestor/descendant direction",
    );
    const child = await actor("child", childUnit.id, [
      ["ORG_UNIT", childUnit.id],
    ]);
    const ids = (rows) => rows.map((x) => String(x.id)).sort();
    for (const a of [
      global,
      it,
      economics,
      major,
      program,
      none,
      multi,
      child,
    ]) {
      const list = await call(prefix + "?limit=100", a);
      const rows = await db.query(
        "SELECT CAST(v.id AS CHAR) id FROM program_versions v JOIN vw_user_program_access access ON access.program_id=v.program_id AND access.user_id=?",
        [a.id],
      );
      same(ids(list.data), ids(rows), "version scope " + a.username);
      same(list.meta.total, rows.length, "list count");
      const without = await call(prefix + "/chua-co-phien-ban?limit=100", a);
      const unversioned = await db.query(
        "SELECT CAST(p.id AS CHAR) id FROM training_programs p JOIN vw_user_program_access access ON access.program_id=p.id AND access.user_id=? WHERE NOT EXISTS(SELECT 1 FROM program_versions v WHERE v.program_id=p.id)",
        [a.id],
      );
      same(ids(without.data), ids(unversioned), "unversioned scope");
      const catalog = await call(prefix + "/hoc-phan?limit=100", a);
      const courses = await db.query(
        "SELECT CAST(cv.id AS CHAR) id FROM course_versions cv JOIN courses c ON c.id=cv.course_id JOIN vw_user_course_access access ON access.course_id=c.id AND access.user_id=? WHERE cv.status='ACTIVE' AND c.status='ACTIVE'",
        [a.id],
      );
      same(ids(catalog.data), ids(courses), "course scope");
      same(catalog.meta.total, courses.length, "catalog total");
      const summary = await call("/api/bao-cao/thong-ke", a);
      const [bank] = await db.query(
        "SELECT COUNT(*) n FROM courses c JOIN vw_user_course_access access ON access.course_id=c.id AND access.user_id=? WHERE c.status='ACTIVE'",
        [a.id],
      );
      same(
        summary.tongHocPhan,
        Number(bank.n),
        "report bank count follows same faculty scope",
      );
      const options = await call(prefix + "/options", a);
      const permitted = await db.query(
        `SELECT DISTINCT CAST(u.id AS CHAR) unitId,CAST(m.id AS CHAR) majorId FROM organizational_units u JOIN organizational_unit_closure cl ON cl.ancestor_id=u.id JOIN majors m ON m.organizational_unit_id=cl.descendant_id WHERE u.status='ACTIVE' AND m.status='ACTIVE' AND EXISTS(SELECT 1 FROM user_scopes s WHERE s.user_id=? AND (s.scope_type='GLOBAL' OR (s.scope_type='ORG_UNIT' AND EXISTS(SELECT 1 FROM organizational_unit_closure oc WHERE oc.ancestor_id=s.organizational_unit_id AND oc.descendant_id=u.id)) OR (s.scope_type='MAJOR' AND s.major_id=m.id) OR (s.scope_type='PROGRAM' AND EXISTS(SELECT 1 FROM training_programs p WHERE p.id=s.program_id AND p.major_id=m.id AND p.managing_unit_id=u.id))))`,
        [a.id],
      );
      same(
        options.units.map((x) => x.id).sort(),
        [...new Set(permitted.map((x) => x.unitId))].sort(),
        "scoped unit options",
      );
      same(
        options.majors
          .flatMap((m) => m.unitIds.map((u) => u + ":" + m.id))
          .sort(),
        permitted.map((p) => p.unitId + ":" + p.majorId).sort(),
        "scoped unit/major pairs",
      );
    }
    const econBase = await call(prefix + "/danh-muc/" + bba.id, economics);
    same(
      (await call(prefix + "?searchTerm=MIT&actorId=" + global.id, economics))
        .meta.total,
      0,
      "query cannot spoof another actor or bypass faculty scope",
    );
    same(
      (await call(prefix + "?searchTerm=BBA", it)).meta.total,
      0,
      "search does not bypass scope",
    );
    await call(prefix + "/" + version.id + "/gui-duyet", economics, 404, {
      revision: 0,
    });
    await call(prefix + "/danh-muc/" + bba.id, it, 404);
    await call(prefix + "/" + version.id, economics, 404);
    await call(prefix, it, 403, input(econBase, marker + "_outside"));
    same(
      (await call(prefix + "/options", it)).units.map((x) => x.id),
      [fit.id],
      "IT does not offer Economics",
    );
    same(
      (await call(prefix + "/options", economics)).units.map((x) => x.id),
      [fbe.id],
      "Economics does not offer IT",
    );
    same(
      (await call(prefix + "/hoc-phan", economics)).meta.total,
      0,
      "No economics courses exist in seed: never show IT courses as fallback",
    );
    same(
      (await call(prefix, program)).permissions.canCreateProgram,
      false,
      "PROGRAM scope cannot create unrelated identities",
    );
    const base = await call(prefix + "/danh-muc/" + mit.id, program);
    await call(prefix, program, 403, input(base, marker + "_programscope"));
    // A program grant allows another version of that exact program, not another identity.
    const newVersion = await call(
      prefix + "/danh-muc/" + mit.id + "/phien-ban",
      program,
      201,
      { ...input(base, base.maCTDT), maPhienBan: marker.slice(-20) },
    );
    same(newVersion.programId, mit.id, "version remains in original program");
    const draft = await call(
      prefix,
      economics,
      201,
      input(econBase, marker + "_econ"),
    );
    const track = draft.tracks[0];
    const body = {
      revision: draft.revision,
      tracks: draft.tracks.map((t) => ({
        id: t.id,
        groups: t.groups.map((g) => ({
          id: g.id,
          minimumCredits: g.minimumCredits,
        })),
        courses:
          t.id === track.id
            ? [
                {
                  courseVersionId: course.id,
                  groupId: t.groups[0].id,
                  requirementType: "REQUIRED",
                  semester: 1,
                },
              ]
            : [],
      })),
    };
    await call(
      prefix + "/" + draft.id + "/cau-truc",
      economics,
      400,
      body,
      "PUT",
    );
    const [reviewerUser] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM users WHERE username='approver.fit'",
    );
    const reviewer = {
      id: reviewerUser.id,
      token: await token(reviewerUser.id),
    };
    await call(prefix + "/" + draft.id + "/xet-duyet", reviewer, 404, {
      revision: draft.revision,
      hoiDongThamDinh: "Review",
      chuTichHoidong: "Chair",
      thuKhao: "Secretary",
      ngayHop: "2026-10-01",
      ketLuan: "YEU_CAU_SUA_DOI",
      yKienDongGop: "Out of scope",
    });
    const unchanged = await call(prefix + "/" + draft.id, economics);
    same(
      unchanged.revision,
      draft.revision,
      "foreign course rejected atomically",
    );
    same(
      unchanged.tracks.flatMap((t) => t.courses).length,
      0,
      "no cross-faculty curriculum writes",
    );
    // Existing cross-unit historical content is retained, not silently deleted by a form save.
    await db.query(
      "INSERT INTO curriculum_courses(curriculum_group_id,program_version_track_id,course_version_id,course_id,requirement_type) VALUES(?,?,?,?,'REQUIRED')",
      [track.groups[0].id, track.id, course.id, course.courseId],
    );
    const kept = await call(
      prefix + "/" + draft.id + "/cau-truc",
      economics,
      200,
      body,
      "PUT",
    );
    same(kept.tracks[0].courses.length, 1, "existing historic entry retained");
    await db.query("DELETE FROM user_scopes WHERE user_id=?", [it.id]);
    same(
      (await call(prefix, it)).meta.total,
      0,
      "scope revocation effective on existing session",
    );
    same(
      (await call(prefix + "/options", it)).units.length,
      0,
      "options revoked",
    );
    same(
      (await call(prefix + "/hoc-phan", it)).meta.total,
      0,
      "catalog revoked",
    );
    // Switching work units must not silently retain an old unit-only grant.
    const [adminUser] = await db.query(
      "SELECT CAST(u.id AS CHAR) id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.role_code='ADMIN' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1",
    );
    const admin = { id: adminUser.id, token: await token(adminUser.id) };
    const transfer = await actor("transfer", fit.id, [["ORG_UNIT", fit.id]]);
    const userList = await call(
      "/api/admin/nguoi-dung?searchTerm=" + transfer.username,
      admin,
    );
    const user = userList.data.find((x) => x.id === transfer.id);
    assert.ok(user);
    const update = {
      hoTen: user.hoTen,
      email: user.email,
      donViId: fbe.id,
      vaiTro: user.vaiTro,
      trangThai: true,
      scopeMode: "KEEP",
    };
    await call(
      "/api/admin/nguoi-dung/" + transfer.id,
      admin,
      400,
      update,
      "PUT",
    );
    await call(
      "/api/admin/nguoi-dung/" + transfer.id,
      admin,
      200,
      { ...update, scopeMode: "UNIT" },
      "PUT",
    );
    same(
      (await call(prefix + "/options", transfer)).units.map((x) => x.id),
      [fbe.id],
      "transfer updates authorized faculty",
    );
    await call(prefix + "/" + version.id, transfer, 404);
    console.log(
      JSON.stringify({
        scopeIntegration: "passed",
        checks,
        database: "isolated copy",
        marker,
      }),
    );
  } finally {
    for (const sid of sessions)
      await db.query("DELETE FROM auth_sessions WHERE id=?", [sid]);
    await db.destroy();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
