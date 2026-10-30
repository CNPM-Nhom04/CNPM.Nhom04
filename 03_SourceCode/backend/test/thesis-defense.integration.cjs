/* Integration writes are permitted only on a disposable database copy. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
if (
  process.env.DEFENSE_TEST_ALLOW_WRITES !== "1" ||
  process.env.DB_DATABASE === "ctdt_management"
)
  throw new Error(
    "Use DEFENSE_TEST_ALLOW_WRITES=1 and an isolated database copy.",
  );
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
const base = process.env.FRONTEND_URL || "http://localhost:3101",
  prefix = "/api/bao-ve-luan-van",
  marker = "defense_review_" + Date.now();
const sessions = [];
let checks = 0;
let sequence = 0;
function same(a, b, msg) {
  assert.deepEqual(a, b, msg);
  checks++;
}
async function token(id) {
  const sid = randomUUID();
  sessions.push(sid);
  await db.query(
    "INSERT INTO auth_sessions(id,user_id,expires_at,timeout_minutes,last_seen_at) VALUES(?,?,TIMESTAMPADD(MINUTE,15,UTC_TIMESTAMP(6)),15,UTC_TIMESTAMP(6))",
    [sid, id],
  );
  return new JwtService({ secret: process.env.JWT_SECRET }).sign(
    { sub: String(id), jti: sid },
    { expiresIn: "15m" },
  );
}
async function raw(route, actor, body, origin = base) {
  return fetch(base + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      ...(actor ? { Cookie: "ctdt_access_token=" + actor.token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
  });
}
async function api(route, actor, status = 200, body, origin = base) {
  const r = await raw(route, actor, body, origin);
  const data = await r.json().catch(() => null);
  same(r.status, status, route + " " + JSON.stringify(data?.message));
  return data;
}
async function actor(suffix, role, scopes) {
  const name = marker + "_" + suffix;
  await db.query(
    "INSERT INTO users(username,email,full_name,password_hash) VALUES(?,?,?,?)",
    [
      name,
      name + "@example.invalid",
      name,
      await bcrypt.hash("DefenseReview123!", 4),
    ],
  );
  const [u] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM users WHERE username=?",
    [name],
  );
  await db.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [u.id, role],
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
      col ? [u.id, type, target] : [u.id, type],
    );
  }
  return { id: u.id, token: await token(u.id), username: name };
}
async function student(unit, track) {
  const code = marker + "_s" + ++sequence;
  await db.query(
    "INSERT INTO students(student_code,full_name,admission_year,organizational_unit_id) VALUES(?,? ,2026,?)",
    [code, "Actual " + code, unit],
  );
  const [s] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM students WHERE student_code=?",
    [code],
  );
  await db.query(
    "INSERT INTO student_program_assignments(student_id,program_version_track_id) VALUES(?,?)",
    [s.id, track],
  );
  const [a] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM student_program_assignments WHERE student_id=? AND assignment_status='ACTIVE'",
    [s.id],
  );
  return {
    id: s.id,
    maHocVien: code,
    assignmentId: a.id,
    programVersionTrackId: track,
  };
}
function input(s, today, extra = {}) {
  return {
    maHocVien: s.maHocVien,
    assignmentId: s.assignmentId,
    tenDeTai: marker + " actual topic",
    ngayBaoVe: today,
    diaDiem: "Room A",
    chuTichHoidong: "Actual Chair",
    phanBien: "Actual Reviewer",
    thuKy: "Actual Secretary",
    eligibilityConfirmed: true,
    eligibilityNote: "Reviewed actual eligibility documents",
    diemDat: 6.25,
    ...extra,
  };
}
async function rejectionSQL(sql, args) {
  await assert.rejects(db.query(sql, args));
  checks++;
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
    const [track] = await db.query(
      "SELECT CAST(t.id AS CHAR) id,CAST(p.id AS CHAR) programId,CAST(p.major_id AS CHAR) majorId,CAST(p.education_level_id AS CHAR) levelId FROM program_version_tracks t JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id WHERE p.managing_unit_id=? AND e.level_code='MASTER' AND v.status='PUBLISHED' AND t.status='ACTIVE' LIMIT 1",
      [fit.id],
    );
    assert.ok(track);
    const global = await actor("global", "TRAINING_OFFICER", [["GLOBAL"]]);
    const it = await actor("it", "TRAINING_OFFICER", [["ORG_UNIT", fit.id]]);
    const it2 = await actor("it2", "TRAINING_OFFICER", [["ORG_UNIT", fit.id]]);
    const econ = await actor("econ", "TRAINING_OFFICER", [
      ["ORG_UNIT", fbe.id],
    ]);
    const reviewer = await actor("reviewer", "APPROVER", [
      ["ORG_UNIT", fit.id],
    ]);
    const none = await actor("none", "TRAINING_OFFICER", []);
    const lecturer = await actor("lecturer", "LECTURER", [["GLOBAL"]]);
    const learner = await actor("learner", "STUDENT", [["GLOBAL"]]);
    const programOnly = await actor("program", "TRAINING_OFFICER", [
      ["PROGRAM", track.programId],
    ]);
    const [au] = await db.query(
      "SELECT CAST(u.id AS CHAR) id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.role_code='ADMIN' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1",
    );
    const admin = { id: au.id, token: await token(au.id) };
    const policy = await api(prefix + "/policy", it);
    same(policy.passingScore, null, "No invented default threshold");
    const today = policy.today;
    const tomorrow = new Date(Date.parse(today + "T12:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10);
    await api(prefix, null, 401);
    await api(prefix, { token: "bad" }, 401);
    await api(prefix, lecturer, 403);
    await api(prefix, learner, 403);
    const adminList = await api(prefix, admin);
    same(
      adminList.permissions,
      { canSchedule: false, canRecord: false },
      "Admin role is read-only by SQL grant",
    );
    await api(prefix, admin, 403, {});
    same(
      (await api(prefix + "/hoc-vien", econ)).meta.total,
      0,
      "No invented economics postgraduate students",
    );
    same(
      (await api(prefix + "/hoc-vien", none)).meta.total,
      0,
      "No-scope actor has no student access",
    );
    same(
      (await api(prefix + "/hoc-vien", programOnly)).meta.total,
      0,
      "Program access alone is not student identity access",
    );
    const seed = await api(prefix + "/hoc-vien?limit=100", it);
    const expected = await db.query(
      "SELECT CAST(a.id AS CHAR) id FROM students s JOIN student_program_assignments a ON a.student_id=s.id AND a.assignment_status='ACTIVE' JOIN program_version_tracks t ON t.id=a.program_version_track_id JOIN program_versions v ON v.id=t.program_version_id JOIN training_programs p ON p.id=v.program_id JOIN education_levels e ON e.id=p.education_level_id JOIN thesis_defense_levels dl ON dl.education_level_id=e.id JOIN vw_user_program_access pa ON pa.user_id=? AND pa.program_id=p.id JOIN vw_user_student_access sa ON sa.user_id=? AND sa.student_id=s.id WHERE s.status='ACTIVE' AND t.status='ACTIVE' AND e.status='ACTIVE' AND p.status='ACTIVE' AND v.status IN ('PUBLISHED','ARCHIVED') AND NOT EXISTS(SELECT 1 FROM thesis_defenses d WHERE d.student_id=s.id AND d.status='CHO_BAO_VE') AND NOT EXISTS(SELECT 1 FROM thesis_defenses d WHERE d.assignment_id=a.id AND d.status='DA_DAT')",
      [it.id, it.id],
    );
    same(
      seed.data.map((x) => x.assignmentId).sort(),
      expected.map((x) => x.id).sort(),
      "Student choices match exact relational assignments, including archived versions",
    );
    const s = await student(fit.id, track.id);
    const body = input(s, today);
    await api(prefix, it, 403, body, "https://invalid.example");
    await api(prefix, it, 400, { ...body, diemDat: undefined });
    await api(prefix, it, 400, { ...body, diemDat: 0 });
    await api(prefix, it, 400, { ...body, diemDat: "6.25" });
    await api(prefix, it, 400, { ...body, eligibilityConfirmed: false });
    await api(prefix, it, 400, { ...body, eligibilityNote: "short" });
    await api(prefix, it, 400, { ...body, ngayBaoVe: "2026-02-30" });
    await api(prefix, it, 400, { ...body, ngayBaoVe: "2000-01-01" });
    await api(prefix, it, 400, { ...body, phanBien: "  ACTUAL CHAIR " });
    await api(prefix, it, 404, { ...body, assignmentId: "999999999" });
    await api(prefix, econ, 404, body);
    await api(prefix, reviewer, 403, body);
    const concurrent = await Promise.all([
      raw(prefix, it, { ...body, hoTen: "Spoof", chuyenNganh: "Spoof" }),
      raw(prefix, it2, body),
    ]);
    same(
      concurrent.map((x) => x.status).sort(),
      [201, 409],
      "One pending defense despite concurrent schedulers",
    );
    const item = await concurrent.find((x) => x.status === 201).json();
    same(item.diemTrungBinh, null, "Unscored is NULL");
    same(item.diemDat, 6.25, "Explicit threshold snapshot");
    same(item.hoTen, "Actual " + s.maHocVien, "Identity cannot be spoofed");
    same(item.assignmentId, s.assignmentId, "Exact assignment persisted");
    await api(prefix, it, 409, body);
    await api(prefix + "/" + item.id, econ, 404);
    await api(prefix + "/" + item.id, none, 404);
    await api(prefix + "/" + item.id, programOnly, 404);
    same(
      (await api(prefix + "/hoc-vien?searchTerm=" + s.maHocVien, it)).meta
        .total,
      0,
      "Pending student excluded",
    );
    const [clock] = await db.query(
      "SELECT TIMESTAMPDIFF(SECOND,created_at,UTC_TIMESTAMP(6)) delta FROM thesis_defenses WHERE id=?",
      [item.id],
    );
    assert.ok(Math.abs(Number(clock.delta)) < 30);
    checks++;
    await api(prefix + "/" + item.id + "/ket-qua", admin, 403, {
      diemTrungBinh: 8,
    });
    await api(prefix + "/" + item.id + "/ket-qua", econ, 404, {
      diemTrungBinh: 8,
    });
    for (const score of [-1, 10.01, 6.251, null, "8", true])
      await api(prefix + "/" + item.id + "/ket-qua", it, 400, {
        diemTrungBinh: score,
      });
    const failed = await api(
      prefix + "/" + item.id + "/ket-qua",
      reviewer,
      201,
      { diemTrungBinh: 0 },
    );
    same(failed.diemTrungBinh, 0, "Zero is a real score");
    same(failed.trangThai, "CHUA_DAT", "Zero fails against explicit threshold");
    await api(prefix + "/" + item.id + "/ket-qua", it, 409, {
      diemTrungBinh: 8,
    });
    await api(prefix + "/" + item.id + "/huy", it, 409, {
      reason: "Cannot cancel final record",
    });
    await rejectionSQL(
      "UPDATE thesis_defenses SET average_score=1 WHERE id=?",
      [item.id],
    );
    await rejectionSQL("DELETE FROM thesis_defenses WHERE id=?", [item.id]);
    const retry = await api(prefix, it, 201, body);
    const decisions = await Promise.all([
      raw(prefix + "/" + retry.id + "/ket-qua", it, { diemTrungBinh: 6.25 }),
      raw(prefix + "/" + retry.id + "/ket-qua", reviewer, {
        diemTrungBinh: 6.25,
      }),
    ]);
    same(decisions.map((x) => x.status).sort(), [201, 409], "One final result");
    const passed = await decisions.find((x) => x.status === 201).json();
    same(passed.trangThai, "DA_DAT", "Exact threshold passes");
    await api(prefix, it, 409, body);
    same(
      (await api(prefix + "/hoc-vien?searchTerm=" + s.maHocVien, it)).meta
        .total,
      0,
      "Passed assignment cannot schedule another attempt",
    );
    const next = await student(fit.id, track.id);
    const future = await api(prefix, it, 201, input(next, tomorrow));
    await api(prefix + "/" + future.id + "/ket-qua", reviewer, 400, {
      diemTrungBinh: 9,
    });
    await api(prefix + "/" + future.id + "/huy", reviewer, 403, {
      reason: "No scheduling grant",
    });
    await api(prefix + "/" + future.id + "/huy", it, 400, { reason: "short" });
    const cancelled = await api(prefix + "/" + future.id + "/huy", it, 201, {
      reason: "Council meeting postponed",
    });
    same(cancelled.trangThai, "DA_HUY", "Cancellation preserved");
    same(cancelled.diemTrungBinh, null, "Cancelled is not failed");
    await api(prefix + "/" + future.id + "/ket-qua", it, 409, {
      diemTrungBinh: 10,
    });
    await api(prefix + "/" + future.id + "/huy", it, 409, {
      reason: "Cancel twice not allowed",
    });
    await api(prefix, it, 201, input(next, tomorrow));
    const changed = await student(fit.id, track.id);
    await db.query(
      "UPDATE student_program_assignments SET assignment_status='ENDED',ended_at=UTC_TIMESTAMP(6) WHERE id=?",
      [changed.assignmentId],
    );
    await db.query(
      "INSERT INTO student_program_assignments(student_id,program_version_track_id) VALUES(?,?)",
      [changed.id, track.id],
    );
    await api(prefix, it, 404, input(changed, today));
    const stale = await student(fit.id, track.id);
    const staleDefense = await api(prefix, it, 201, input(stale, today));
    await db.query(
      "UPDATE student_program_assignments SET assignment_status='ENDED',ended_at=UTC_TIMESTAMP(6) WHERE id=?",
      [stale.assignmentId],
    );
    await api(prefix + "/" + staleDefense.id + "/ket-qua", it, 409, {
      diemTrungBinh: 9,
    });
    await api(prefix + "/" + staleDefense.id + "/huy", it, 201, {
      reason: "Assignment changed before defense",
    });
    // Stored policy is optional, validated and snapshotted, never borrowed from course grades.
    await db.query(
      "INSERT INTO system_settings(setting_key,value_type,setting_value) VALUES('defense.passing_score','DECIMAL','invalid')",
    );
    await api(prefix + "/policy", it, 502);
    const thresholdStudent = await student(fit.id, track.id);
    await api(prefix, it, 502, input(thresholdStudent, today));
    await db.query(
      "UPDATE system_settings SET setting_value='6.10' WHERE setting_key='defense.passing_score'",
    );
    same(
      (await api(prefix + "/policy", it)).passingScore,
      6.1,
      "Read actual SQL policy",
    );
    await api(prefix, it, 409, input(thresholdStudent, today));
    const snapshot = await api(
      prefix,
      it,
      201,
      input(thresholdStudent, today, { diemDat: 6.1 }),
    );
    await db.query(
      "UPDATE system_settings SET setting_value='9' WHERE setting_key='defense.passing_score'",
    );
    const retained = await api(
      prefix + "/" + snapshot.id + "/ket-qua",
      it,
      201,
      { diemTrungBinh: 6.1 },
    );
    same(
      retained.trangThai,
      "DA_DAT",
      "Later policy changes do not change a scheduled threshold",
    );
    await db.query(
      "DELETE FROM system_settings WHERE setting_key='defense.passing_score'",
    );
    // Valid postgraduate fixture in the other faculty verifies actual isolation in both directions.
    const [major] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM majors WHERE organizational_unit_id=? LIMIT 1",
      [fbe.id],
    );
    const code = marker + "_econ";
    await db.query(
      "INSERT INTO training_programs(major_id,education_level_id,managing_unit_id,program_code,program_name) VALUES(?,?,?,?,?)",
      [major.id, track.levelId, fbe.id, code, "Economics postgraduate test"],
    );
    const [p] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM training_programs WHERE program_code=?",
      [code],
    );
    await db.query(
      "INSERT INTO program_versions(program_id,version_code,program_name_snapshot,cohort_year) VALUES(?,'v1','Economics postgraduate test',2026)",
      [p.id],
    );
    const [v] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM program_versions WHERE program_id=?",
      [p.id],
    );
    await db.query(
      "INSERT INTO program_version_tracks(program_version_id,track_code_snapshot,track_name_snapshot,required_total_credits) VALUES(?,'RESEARCH','Research',60)",
      [v.id],
    );
    await db.query(
      "UPDATE program_versions SET status='SUBMITTED',submitted_at=UTC_TIMESTAMP(6) WHERE id=?",
      [v.id],
    );
    await db.query(
      "UPDATE program_versions SET status='PUBLISHED',published_at=UTC_TIMESTAMP(6),locked_at=UTC_TIMESTAMP(6) WHERE id=?",
      [v.id],
    );
    const [t] = await db.query(
      "SELECT CAST(id AS CHAR) id FROM program_version_tracks WHERE program_version_id=?",
      [v.id],
    );
    const es = await student(fbe.id, t.id);
    same(
      (await api(prefix + "/hoc-vien?searchTerm=" + es.maHocVien, it)).meta
        .total,
      0,
      "IT does not see Economics options",
    );
    const er = await api(prefix, econ, 201, input(es, today));
    await api(prefix + "/" + er.id, it, 404);
    await api(prefix + "/" + er.id + "/ket-qua", reviewer, 404, {
      diemTrungBinh: 9,
    });
    same(
      (
        await api(
          prefix + "?searchTerm=" + es.maHocVien + "&actorId=" + global.id,
          it,
        )
      ).meta.total,
      0,
      "Query actor cannot override scope",
    );
    same(
      (await api(prefix + "?searchTerm=" + es.maHocVien, econ)).meta.total,
      1,
      "Economics sees own defense",
    );
    // An active assignment in a different faculty does not leak a student's identity.
    const mismatch = await student(fbe.id, track.id);
    same(
      (await api(prefix + "/hoc-vien?searchTerm=" + mismatch.maHocVien, it))
        .meta.total,
      0,
      "Student and program scope both required",
    );
    same(
      (await api(prefix + "/hoc-vien?searchTerm=" + mismatch.maHocVien, econ))
        .meta.total,
      0,
      "Program access also required",
    );
    await api(prefix, it, 404, input(mismatch, today));
    const all = await api(prefix + "?limit=100", global);
    const [total] = await db.query("SELECT COUNT(*) n FROM thesis_defenses");
    same(all.meta.total, Number(total.n), "List count equals SQL");
    same(
      all.data.length,
      Number(total.n),
      "All SQL defenses returned without fixture filtering",
    );
    for (const status of ["CHO_BAO_VE", "DA_DAT", "CHUA_DAT", "DA_HUY"]) {
      const filtered = await api(
        prefix + "?selectedStatus=" + status + "&limit=100",
        global,
      );
      const [count] = await db.query(
        "SELECT COUNT(*) n FROM thesis_defenses WHERE status=?",
        [status],
      );
      same(filtered.meta.total, Number(count.n), "Filtered status SQL parity");
    }
    const page1 = await api(prefix + "?limit=1&page=1", global);
    same(page1.data.length, 1, "Pagination applied");
    await api(prefix + "?page=0", global, 400);
    await api(prefix + "?selectedStatus=INVALID", global, 400);
    await api(prefix + "/1%20OR%201=1", global, 404);
    await db.query("DELETE FROM user_scopes WHERE user_id=?", [it2.id]);
    same(
      (await api(prefix, it2)).meta.total,
      0,
      "Scope revocation affects existing session",
    );
    await api(prefix + "/" + er.id, it2, 404);
    await db.query("DELETE ur FROM user_roles ur WHERE ur.user_id=?", [it2.id]);
    await api(prefix, it2, 403);
    const [audits] = await db.query(
      "SELECT COUNT(*) n FROM audit_logs WHERE entity_type='thesis_defense'",
    );
    assert.ok(Number(audits.n) >= Number(total.n) + 4);
    checks++;
    console.log(
      JSON.stringify({
        integration: "defense passed",
        checks,
        marker,
        database: "isolated copy",
      }),
    );
  } finally {
    for (const sid of sessions)
      await db.query("DELETE FROM auth_sessions WHERE id=?", [sid]);
    await db.destroy();
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
