/* Run only on a disposable DB clone and a backend connected to that same clone. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
if (
  process.env.COURSE_TEST_ALLOW_WRITES !== "1" ||
  !/^ctdt_course_review_\d+$/.test(process.env.DB_DATABASE || "")
)
  throw new Error(
    "Use COURSE_TEST_ALLOW_WRITES=1 and an isolated DB named ctdt_course_review_<timestamp>.",
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
const base = process.env.COURSE_TEST_URL || "http://127.0.0.1:3102";
const proxy = process.env.COURSE_TEST_PROXY === "1",
  prefix = (proxy ? "/api" : "") + "/danh-muc-hoc-phan";
const marker = "catalog_review_" + Date.now();
let checks = 0,
  sequence = 0;
const same = (a, b, note) => {
  assert.deepEqual(a, b, note);
  checks++;
};
const day = (offset = 0) =>
  new Date(Date.now() + 7 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
async function api(route, actor, status = 200, body, extraHeaders = {}) {
  const r = await fetch(base + prefix + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      ...(actor
        ? proxy
          ? { Cookie: "ctdt_access_token=" + actor.token }
          : { Authorization: "Bearer " + actor.token }
        : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
    redirect: "manual",
  });
  const result = await r.json().catch(() => null);
  same(r.status, status, route + " " + JSON.stringify(result?.message));
  return result;
}
async function actor(role, scopes) {
  const name = marker + "_" + ++sequence,
    password = "CatalogReview123!";
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash,must_change_password) VALUES(?,?,?,?,0)",
    [name, name + "@example.invalid", name, await bcrypt.hash(password, 4)],
  );
  const [user] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [name],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [user.id, role],
  );
  for (const [type, target] of scopes) {
    const col = {
      ORG_UNIT: "organizational_unit_id",
      MAJOR: "major_id",
      PROGRAM: "program_id",
    }[type];
    await db.query(
      "INSERT INTO user_scopes(user_id,scope_type" +
        (col ? "," + col : "") +
        ") VALUES(?,?" +
        (col ? ",?" : "") +
        ")",
      col ? [user.id, type, target] : [user.id, type],
    );
  }
  const sid = randomUUID();
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,30,UTC_TIMESTAMP(6)),30,UTC_TIMESTAMP(6))",
    [sid, user.id],
  );
  return {
    id: user.id,
    username: name,
    password,
    token: new JwtService({ secret: process.env.JWT_SECRET }).sign(
      { sub: user.id, jti: sid },
      { expiresIn: "30m" },
    ),
  };
}
function input(unitId, extra = {}) {
  return {
    unitId,
    courseCode: marker + "_" + ++sequence,
    courseName: "Học phần kiểm thử SQL",
    englishName: "SQL test course",
    credits: 2.5,
    theoryHours: 15,
    practiceHours: 30,
    description: "Dữ liệu chỉ trên bản sao kiểm thử",
    effectiveFrom: day(-1),
    ...extra,
  };
}
function version(item, extra = {}) {
  return {
    expectedLatestVersionId: item.latestVersionId,
    courseName: item.courseName,
    englishName: item.englishName || "",
    credits: item.credits,
    theoryHours: item.theoryHours,
    practiceHours: item.practiceHours,
    description: item.description || "",
    effectiveFrom: day(),
    ...extra,
  };
}
async function main() {
  await db.initialize();
  const admin = await actor("ADMIN", [["GLOBAL"]]),
    fit = await actor("TRAINING_OFFICER", [["ORG_UNIT", "1"]]),
    fbe = await actor("TRAINING_OFFICER", [["ORG_UNIT", "2"]]),
    approver = await actor("APPROVER", [["ORG_UNIT", "1"]]),
    none = await actor("TRAINING_OFFICER", []),
    major = await actor("TRAINING_OFFICER", [["MAJOR", "1"]]),
    program = await actor("TRAINING_OFFICER", [["PROGRAM", "1"]]),
    student = await actor("STUDENT", [["GLOBAL"]]),
    global = await actor("TRAINING_OFFICER", [["GLOBAL"]]),
    child = await actor("TRAINING_OFFICER", [["ORG_UNIT", "3"]]);
  // A SQL-only canary proves HTTP sessions and the DB connection refer to this clone before HTTP mutations.
  const canary = marker + "_canary";
  await db.query(
    "INSERT INTO courses(course_code,owning_unit_id) VALUES(?,1)",
    [canary],
  );
  const [canaryRow] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM courses WHERE course_code=?",
    [canary],
  );
  same(
    (await api("/" + canaryRow.id, fit)).courseCode,
    canary,
    "backend must point to the clone",
  );
  await api("", null, 401);
  await api("", student, 403);
  await api("", { token: "invalid" }, 401);
  for (const [a, scope] of [
    [admin, "1=1"],
    [fit, "c.owning_unit_id IN (1,3)"],
    [fbe, "c.owning_unit_id=2"],
    [child, "c.owning_unit_id=3"],
    [none, "0=1"],
    [major, "0=1"],
    [program, "0=1"],
  ]) {
    const list = await api("?limit=100", a),
      [count] = await db.query(
        "SELECT COUNT(*) total FROM courses c WHERE " + scope,
      );
    same(list.meta.total, Number(count.total), "SQL parity");
    same(list.data.length, Number(count.total), "SQL parity rows");
    same(list.permissions.canManage, a !== admin);
  }
  const units = await api("/don-vi", fit);
  same(units.map((u) => u.id).sort(), ["1", "3"]);
  same(
    (await api("/don-vi", fbe)).map((u) => u.id),
    ["2"],
  );
  same((await api("/don-vi", none)).length, 0);
  same((await api("?unitId=2", fit)).meta.total, 0);
  await api("/1", fbe, 404);
  await api("/1", none, 404);
  await api("/1", major, 404);
  await api("/0", fit, 400);
  await api("/18446744073709551616", fit, 400);
  await api("/1/phien-ban", admin, 403, {});
  await api("", admin, 403, input("1"));
  await api("", approver, 403, input("1"));
  await api("", fit, 403, input("2"));
  await api("", none, 403, input("1"));
  await api("", major, 403, input("1"));
  for (const extra of [
    { credits: 0 },
    { credits: 1000 },
    { credits: 1.001 },
    { credits: "3" },
    { credits: null },
    { theoryHours: -1 },
    { theoryHours: 1.5 },
    { practiceHours: 65536 },
    { courseName: "   " },
    { courseCode: "   " },
    { effectiveFrom: "2026-02-30" },
    { effectiveFrom: "2026-10-30T00:00:00Z" },
    { effectiveFrom: "0999-12-31" },
    { effectiveTo: "2000-01-01" },
  ])
    await api("", fit, 400, input("1", extra));
  for (const q of [
    "?page=0",
    "?limit=101",
    "?status=BOGUS",
    "?page=1.5",
    "?unitId=bad",
  ])
    await api(q, fit, 400);
  same(
    (await api("?search=" + encodeURIComponent("' OR 1=1 --"), fit)).meta.total,
    0,
  );
  let item = await api("", fit, 201, input("1"));
  same(item.versionStatus, "DRAFT");
  same(item.activeVersionId, null);
  same(item.credits, 2.5);
  same(item.versions.length, 1);
  same((await api("/" + item.id, fit)).courseCode, item.courseCode);
  await api(
    "",
    fit,
    409,
    input("1", { courseCode: item.courseCode.toLowerCase() }),
  );
  await api(
    "/" + item.id + "/phien-ban/" + item.latestVersionId + "/kich-hoat",
    fbe,
    404,
    {},
  );
  item = await api(
    "/" + item.id + "/phien-ban/" + item.latestVersionId + "/kich-hoat",
    fit,
    201,
    {},
  );
  same(item.activeVersionId, item.latestVersionId);
  await api(
    "/" + item.id + "/phien-ban/" + item.latestVersionId + "/kich-hoat",
    fit,
    409,
    {},
  );
  const firstId = item.latestVersionId;
  let revised = await api(
    "/" + item.id + "/phien-ban",
    fit,
    201,
    version(item, { credits: 4, courseName: "Bản sửa đổi SQL" }),
  );
  same(revised.versionNo, 2);
  same(revised.activeVersionId, firstId);
  same(revised.activeCredits, 2.5);
  await api("/" + item.id + "/phien-ban", fit, 409, version(item));
  revised = await api(
    "/" + item.id + "/phien-ban/" + revised.latestVersionId + "/kich-hoat",
    fit,
    201,
    {},
  );
  same(revised.activeCredits, 4);
  same(revised.versions[1].status, "RETIRED");
  same(revised.versions[1].credits, 2.5);
  same(revised.versions[1].effectiveTo, day(-1));
  const future = await api("", fit, 201, input("1", { effectiveFrom: day(1) }));
  await api(
    "/" + future.id + "/phien-ban/" + future.latestVersionId + "/kich-hoat",
    fit,
    400,
    {},
  );
  const expired = await api(
    "",
    fit,
    201,
    input("1", { effectiveFrom: day(-4), effectiveTo: day(-2) }),
  );
  await api(
    "/" + expired.id + "/phien-ban/" + expired.latestVersionId + "/kich-hoat",
    fit,
    400,
    {},
  );
  const backwards = await api(
    "/" + item.id + "/phien-ban",
    fit,
    201,
    version(revised, { effectiveFrom: day(-10) }),
  );
  await api(
    "/" + item.id + "/phien-ban/" + backwards.latestVersionId + "/kich-hoat",
    fit,
    400,
    {},
  );
  let locked = await api("/" + item.id + "/trang-thai", fit, 201, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  same(locked.status, "INACTIVE");
  same(locked.versions.length, 3);
  await api("/" + item.id + "/phien-ban", fit, 409, version(locked));
  await api("/" + item.id + "/trang-thai", fit, 409, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  locked = await api("/" + item.id + "/trang-thai", fit, 201, {
    status: "ACTIVE",
    expectedStatus: "INACTIVE",
  });
  same(locked.status, "ACTIVE");
  await api("/" + item.id + "/trang-thai", fit, 400, {
    status: "RETIRED",
    expectedStatus: "ACTIVE",
  });
  // Parent scope can manage courses in a real descendant unit; child cannot see parent courses.
  const descendant = await api("", fit, 201, input("3"));
  await api("/" + descendant.id, child);
  await api("/" + item.id, child, 404);
  const econ = await api("", fbe, 201, input("2"));
  await api("/" + econ.id, fit, 404);
  same((await api("/" + econ.id, fbe)).unitId, "2");
  await api("/" + econ.id, global);
  // Course identity without a version must be shown honestly and can receive its first draft.
  same((await api("/" + canaryRow.id, fit)).credits, null);
  const repaired = await api(
    "/" + canaryRow.id + "/phien-ban",
    fit,
    201,
    version({ ...item, latestVersionId: "0" }),
  );
  same(repaired.versionNo, 1);
  // Concurrent creates/revisions/activations may have only one winner.
  await race("", input("1"));
  const concurrent = await api("", fit, 201, input("1"));
  async function race(route, body, actors = [fit, global]) {
    const responses = await Promise.all(
      actors.map((a) =>
        fetch(base + prefix + route, {
          method: "POST",
          headers: {
            Origin: base,
            "Content-Type": "application/json",
            ...(proxy
              ? { Cookie: "ctdt_access_token=" + a.token }
              : { Authorization: "Bearer " + a.token }),
          },
          body: JSON.stringify(body),
        }),
      ),
    );
    same(responses.map((r) => r.status).sort(), [201, 409]);
  }
  await race("/" + concurrent.id + "/phien-ban", version(concurrent));
  const newest = await api("/" + concurrent.id, fit);
  same(newest.versions.length, 2);
  await race(
    "/" + concurrent.id + "/phien-ban/" + newest.latestVersionId + "/kich-hoat",
    {},
  );
  // Existing published curricula continue pointing at the same academic content after a revision.
  const [existing] = await db.query(
    "SELECT CAST(c.id AS CHAR) id FROM courses c JOIN course_versions v ON v.course_id=c.id JOIN curriculum_courses cc ON cc.course_version_id=v.id JOIN program_version_tracks t ON t.id=cc.program_version_track_id JOIN program_versions p ON p.id=t.program_version_id WHERE c.owning_unit_id=1 AND p.status='PUBLISHED' LIMIT 1",
  );
  const before = await db.query(
    "SELECT cc.id,cc.course_version_id,v.course_name,v.credits,v.theory_hours,v.practice_hours FROM curriculum_courses cc JOIN course_versions v ON v.id=cc.course_version_id WHERE cc.course_id=? ORDER BY cc.id",
    [existing.id],
  );
  const original = await api("/" + existing.id, fit);
  const changed = await api(
    "/" + existing.id + "/phien-ban",
    fit,
    201,
    version(original, { credits: original.credits + 0.5 }),
  );
  await api(
    "/" + existing.id + "/phien-ban/" + changed.latestVersionId + "/kich-hoat",
    fit,
    201,
    {},
  );
  const after = await db.query(
    "SELECT cc.id,cc.course_version_id,v.course_name,v.credits,v.theory_hours,v.practice_hours FROM curriculum_courses cc JOIN course_versions v ON v.id=cc.course_version_id WHERE cc.course_id=? ORDER BY cc.id",
    [existing.id],
  );
  same(after, before, "published curricula preserved exactly");
  same(
    (await api("?search=" + encodeURIComponent(item.courseCode), fit)).meta
      .total,
    1,
  );
  same((await api("?status=INACTIVE&search=" + marker, fit)).meta.total, 0);
  const paged = await api("?search=" + marker + "&limit=2&page=1", fit);
  same(paged.data.length, 2);
  same(paged.meta.totalPages, Math.ceil(paged.meta.total / 2));
  same((await api("?search=" + marker + "&page=999", fit)).data.length, 0);
  // Catalog changes must also be reflected in the existing CTDT course picker.
  const {
    MysqlProgramRepository,
  } = require("../dist/modules/programs/infrastructure/program.repository");
  const programs = new MysqlProgramRepository(db);
  const programActor = {
    id: fit.id,
    username: fit.username,
    permissions: ["PROGRAM_READ", "PROGRAM_EDIT"],
    canCreateProgram: true,
    ip: "",
  };
  const catalog = () =>
    programs.catalog({ page: 1, limit: 100, searchTerm: marker }, programActor);
  const picked = await catalog();
  same(
    picked.data.some((c) => c.id === revised.activeVersionId),
    true,
  );
  same(
    picked.data.some((c) => c.id === backwards.latestVersionId),
    false,
    "DRAFT excluded",
  );
  await db.query("UPDATE course_versions SET status='ACTIVE' WHERE id=?", [
    future.latestVersionId,
  ]);
  same(
    (await catalog()).data.some((c) => c.id === future.latestVersionId),
    false,
    "future ACTIVE excluded",
  );
  await db.query("UPDATE course_versions SET status='ACTIVE' WHERE id=?", [
    expired.latestVersionId,
  ]);
  same(
    (await catalog()).data.some((c) => c.id === expired.latestVersionId),
    false,
    "expired ACTIVE excluded",
  );
  const [draftProgram] = await db.query(
    "SELECT CAST(v.id AS CHAR) id FROM program_versions v JOIN training_programs p ON p.id=v.program_id WHERE v.status='DRAFT' AND p.managing_unit_id=1 LIMIT 1",
  );
  const draft = await programs.detail(draftProgram.id, programActor);
  const structure = (item) => ({
    revision: item.revision,
    tracks: item.tracks
      .filter((t) => t.status !== "INACTIVE")
      .map((t) => ({
        id: t.id,
        groups: t.groups.map((g) => ({
          id: g.id,
          minimumCredits: g.minimumCredits,
        })),
        courses: t.courses.map((c) => ({
          courseVersionId: c.courseVersionId,
          groupId: c.groupId,
          requirementType: c.requirementType,
          semester: c.semester,
        })),
      })),
  });
  const referenced = draft.tracks[0].courses[0];
  await api("/" + referenced.courseId + "/trang-thai", fit, 201, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  same(
    (await catalog()).data.some((c) => c.courseId === referenced.courseId),
    false,
    "locked excluded",
  );
  const retained = await programs.structure(
    draft.id,
    structure(draft),
    programActor,
  );
  same(
    retained.tracks[0].courses[0].courseVersionId,
    referenced.courseVersionId,
    "retain existing locked version while saving draft",
  );
  const invalidStructure = structure(retained);
  invalidStructure.tracks[0].courses[0].courseVersionId =
    future.latestVersionId;
  await assert.rejects(
    programs.structure(draft.id, invalidStructure, programActor),
    /phiên bản hợp lệ/,
  );
  checks++;
  // Exercise Next's actual route handler in-process: no frontend server or extra listening port.
  if (!proxy) {
    const fs = require("node:fs"),
      { createRequire } = require("node:module"),
      ts = require("typescript");
    const frontend = path.resolve(__dirname, "../../frontend");
    const frontendRequire = createRequire(path.join(frontend, "package.json"));
    function loadTs(file, customRequire) {
      const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      const module = { exports: {} };
      new Function("require", "module", "exports", code)(
        customRequire,
        module,
        module.exports,
      );
      return module.exports;
    }
    const backend = loadTs(
      path.join(frontend, "lib/server/backend.ts"),
      frontendRequire,
    );
    const route = loadTs(
      path.join(frontend, "app/api/danh-muc-hoc-phan/[[...path]]/route.ts"),
      (key) =>
        key === "@/lib/server/backend" ? backend : frontendRequire(key),
    );
    const { NextRequest } = frontendRequire("next/server");
    const originalBase = process.env.BACKEND_API_URL;
    process.env.BACKEND_API_URL = base;
    async function viaProxy(
      parts,
      a,
      method,
      body,
      status = 200,
      origin = "http://localhost:3101",
    ) {
      const url =
        "http://localhost:3101/api/danh-muc-hoc-phan" +
        (parts.length ? "/" + parts.join("/") : "");
      const req = new NextRequest(url, {
        method,
        headers: {
          ...(a ? { Cookie: "ctdt_access_token=" + a.token } : {}),
          ...(method === "POST"
            ? { Origin: origin, "Content-Type": "application/json" }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const r = await route[method](req, {
        params: Promise.resolve({ path: parts }),
      });
      const data = await r.json();
      same(
        r.status,
        status,
        "Next proxy " + parts.join("/") + " " + JSON.stringify(data?.message),
      );
      return { r, data };
    }
    try {
      await viaProxy([], null, "GET", undefined, 401);
      await viaProxy(["invalid"], fit, "GET", undefined, 404);
      await viaProxy(["..", "auth"], fit, "GET", undefined, 404);
      await viaProxy([], admin, "POST", input("1"), 403);
      await viaProxy(
        [],
        fit,
        "POST",
        input("1"),
        403,
        "https://invalid.example",
      );
      await viaProxy(["1"], fbe, "GET", undefined, 404);
      const unauth = await viaProxy(
        [],
        { token: "invalid" },
        "GET",
        undefined,
        401,
      );
      assert(
        unauth.r.headers.get("set-cookie")?.includes("ctdt_access_token="),
      );
      checks++;
      const proxyItem = (await viaProxy([], fit, "POST", input("1"), 201)).data;
      same(proxyItem.versionStatus, "DRAFT");
      const activated = (
        await viaProxy(
          [proxyItem.id, "phien-ban", proxyItem.latestVersionId, "kich-hoat"],
          fit,
          "POST",
          {},
          201,
        )
      ).data;
      same(activated.activeVersionId, proxyItem.latestVersionId);
      const changedProxy = (
        await viaProxy(
          [proxyItem.id, "phien-ban"],
          fit,
          "POST",
          version(activated),
          201,
        )
      ).data;
      same(changedProxy.versionNo, 2);
      const lockedProxy = (
        await viaProxy(
          [proxyItem.id, "trang-thai"],
          fit,
          "POST",
          { status: "INACTIVE", expectedStatus: "ACTIVE" },
          201,
        )
      ).data;
      same(lockedProxy.status, "INACTIVE");
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () =>
          new Response(JSON.stringify({ message: "private SQL detail" }), {
            status: 500,
          });
        const sanitized = await viaProxy([], fit, "GET", undefined, 502);
        same(
          JSON.stringify(sanitized.data).includes("private SQL detail"),
          false,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    } finally {
      if (originalBase === undefined) delete process.env.BACKEND_API_URL;
      else process.env.BACKEND_API_URL = originalBase;
    }
  }
  // Live revocation: the same token cannot preserve former scope/permissions.
  await db.query("DELETE FROM user_scopes WHERE user_id=?", [fit.id]);
  await api("/" + item.id, fit, 404);
  await api("/" + item.id + "/trang-thai", fit, 404, {
    status: "INACTIVE",
    expectedStatus: "ACTIVE",
  });
  await db.query("DELETE FROM user_roles WHERE user_id=?", [global.id]);
  await api("", global, 403);
  await api("", global, 403, input("1"));
  await db.query("UPDATE users SET account_status='DISABLED' WHERE id=?", [
    fbe.id,
  ]);
  await api("", fbe, 401);
  const [audits] = await db.query(
    "SELECT COUNT(*) total FROM audit_logs WHERE entity_type='course' AND actor_username LIKE ?",
    [marker + "%"],
  );
  assert(Number(audits.total) >= 15);
  checks++;
  if (proxy)
    await api("", admin, 403, {}, { Origin: "https://invalid.example" });
  console.log(
    "PASS: " +
      checks +
      " course HTTP/SQL checks; isolated DB " +
      process.env.DB_DATABASE,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
