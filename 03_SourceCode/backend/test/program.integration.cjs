/* Development-only full workflow test. Marked programs/courses are retired, users soft-deleted.
   Approval history, audit, minutes and attachments are intentionally retained. */
const assert = require("node:assert/strict"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
if (process.env.PROGRAM_TEST_ALLOW_WRITES !== "1") {
  console.error(
    "Run only against an isolated database copy with PROGRAM_TEST_ALLOW_WRITES=1.",
  );
  process.exit(1);
}
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
if (process.env.DB_DATABASE === "ctdt_management")
  throw new Error(
    "Workflow tests require an isolated database copy, not ctdt_management.",
  );
const { DataSource } = require("typeorm"),
  { JwtService } = require("@nestjs/jwt"),
  bcrypt = require("bcryptjs");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
const base = process.env.FRONTEND_URL || "http://localhost:3000",
  prefix = "/api/chuong-trinh-dao-tao",
  marker = "program_smoke_" + Date.now();
let checks = 0,
  officerId,
  reviewerId,
  officerCookie,
  reviewerCookie,
  program;
const courseIds = [];
async function call(
  url,
  status = 200,
  { method = "GET", body, cookie = officerCookie, form, origin = base } = {},
) {
  const response = await fetch(base + url, {
    method,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
    signal: AbortSignal.timeout(60000),
  });
  if (response.status !== status) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      method +
        " " +
        url +
        " expected " +
        status +
        ", got " +
        response.status +
        " " +
        JSON.stringify(data),
    );
  }
  checks++;
  return response;
}
async function json(url, status, options) {
  return (await call(url, status, options)).json();
}
async function account(suffix, role) {
  const username = marker + "_" + suffix,
    password = "ProgramSmokePassword123!";
  await db.query(
    "INSERT INTO users (username,email,password_hash,full_name,account_status) VALUES (?,?,?,?,'ACTIVE')",
    [
      username,
      username + "@example.invalid",
      await bcrypt.hash(password, 4),
      "Kiểm thử " + username,
    ],
  );
  const [{ id }] = await db.query(
    "SELECT CAST(id AS CHAR) AS id FROM users WHERE username=?",
    [username],
  );
  if (role === "TRAINING_OFFICER") officerId = id;
  else reviewerId = id;
  await db.query(
    "INSERT INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE role_code=?",
    [id, role],
  );
  await db.query(
    "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
    [id],
  );
  const login = await call("/api/auth/login", 200, {
    method: "POST",
    cookie: "",
    body: { identifier: username, password },
  });
  const header = login.headers
    .getSetCookie()
    .find((value) => value.startsWith("ctdt_access_token="));
  assert.ok(header && /HttpOnly/.test(header));
  return { id, cookie: header.split(";")[0] };
}
function input(item) {
  return {
    maCTDT: item.maCTDT,
    tenCTDT: item.tenCTDT,
    tenTiengAnh: item.tenTiengAnh,
    educationLevelId: item.educationLevelId,
    managingUnitId: item.managingUnitId,
    majorId: item.majorId,
    hinhThucDaoTao: item.hinhThucDaoTao,
    thoiGianDaoTao: item.thoiGianDaoTao,
    khoaTuyenSinh: item.khoaTuyenSinh,
    tongTinChiYeuCau: item.tongTinChiYeuCau,
    chuanDauRaTiengAnh: item.chuanDauRaTiengAnh,
    chuanDauRaTinHoc: item.chuanDauRaTinHoc,
    soQuyetDinhBanHanh: item.soQuyetDinhBanHanh,
    ngayBanHanh: item.ngayBanHanh,
    moTa: item.moTa,
    revision: item.revision,
  };
}
(async () => {
  try {
    await db.initialize();
    ({ id: officerId, cookie: officerCookie } = await account(
      "officer",
      "TRAINING_OFFICER",
    ));
    ({ id: reviewerId, cookie: reviewerCookie } = await account(
      "approver",
      "APPROVER",
    ));
    await call("/dang-nhap", 200, { cookie: "" });
    await call("/dashboard/chuong-trinh-dao-tao", 200);
    await call("/dashboard/chuong-trinh-dao-tao/tao-moi", 200);
    await call(prefix, 401, { cookie: "" });
    await call(prefix, 401, { cookie: "ctdt_access_token=bad" });
    await call(prefix, 403, {
      method: "POST",
      body: {},
      origin: "https://invalid.example",
    });
    const options = await json(prefix + "/options", 200);
    const level = options.levels.find((item) => item.code === "MASTER");
    assert.ok(level && options.majors.length, "Need seeded MASTER and a major");
    const major = options.majors[0],
      unit = options.units.find((item) => major.unitIds.includes(item.id));
    assert.ok(unit);
    const body = {
      maCTDT: marker,
      tenCTDT: "CTĐT kiểm thử " + marker,
      tenTiengAnh: "Smoke Program",
      educationLevelId: level.id,
      managingUnitId: unit.id,
      majorId: major.id,
      hinhThucDaoTao: "CHINH_QUY",
      thoiGianDaoTao: "2 năm",
      khoaTuyenSinh: "2026 - 2028",
      tongTinChiYeuCau: 60,
      chuanDauRaTiengAnh: "B2",
      chuanDauRaTinHoc: "CNTT",
      soQuyetDinhBanHanh: "TEST-" + marker,
      ngayBanHanh: "2026-01-01",
      moTa: "Dữ liệu kiểm thử tự động",
    };
    await call(prefix, 403, { method: "POST", body, cookie: reviewerCookie });
    await call(prefix, 400, {
      method: "POST",
      body: { ...body, khoaTuyenSinh: "2028 - 2026" },
    });
    await call(prefix, 400, {
      method: "POST",
      body: { ...body, ngayBanHanh: "2026-02-30" },
    });
    program = await json(prefix, 201, { method: "POST", body });
    assert.equal(program.status, "DRAFT");
    assert.ok(program.tracks.length >= 2);
    assert.equal(program.revision, 1);
    const baseProgram = await json(
      prefix + "/danh-muc/" + program.programId,
      200,
    );
    assert.equal(baseProgram.maCTDT, program.maCTDT);
    const secondVersion = await json(
      prefix + "/danh-muc/" + program.programId + "/phien-ban",
      201,
      {
        method: "POST",
        body: { ...body, maPhienBan: "v2" },
      },
    );
    assert.equal(secondVersion.programId, program.programId);
    assert.equal(secondVersion.maPhienBan, "v2");
    await call(prefix + "/danh-muc/" + program.programId + "/phien-ban", 409, {
      method: "POST",
      body: { ...body, maPhienBan: "v2" },
    });

    await call(prefix, 409, { method: "POST", body });
    await call("/dashboard/chuong-trinh-dao-tao/" + program.id + "/build", 200);
    await call(
      "/dashboard/chuong-trinh-dao-tao/" + program.id + "/xet-duyet",
      200,
    );
    const found = await json(prefix + "?searchTerm=" + marker, 200);
    assert.equal(found.meta.total, 2);
    await call(prefix + "?page=0", 400);
    const oldRevision = program.revision;
    program = await json(prefix + "/" + program.id, 200, {
      method: "PUT",
      body: { ...input(program), tenCTDT: program.tenCTDT + " v2" },
    });
    await call(prefix + "/" + program.id, 409, {
      method: "PUT",
      body: { ...input(program), revision: oldRevision },
    });
    assert.equal(
      (await json(prefix + "/" + program.id + "/kiem-tra", 200)).valid,
      false,
    );
    await call(prefix + "/" + program.id + "/gui-duyet", 400, {
      method: "POST",
      body: { revision: program.revision },
    });
    await db.query("DELETE FROM user_scopes WHERE user_id=?", [officerId]);
    assert.equal((await json(prefix, 200)).meta.total, 0);
    await call(prefix + "/" + program.id, 404);
    await call(prefix, 403, {
      method: "POST",
      body: { ...body, maCTDT: marker + "_OUT" },
    });
    await db.query(
      "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
      [officerId],
    );
    const versions = [];
    for (const [index, credits] of [54, 6].entries()) {
      const code = marker + "_" + index;
      await db.query(
        "INSERT INTO courses (owning_unit_id,course_code) VALUES (?,?)",
        [unit.id, code],
      );
      const [{ id }] = await db.query(
        "SELECT CAST(id AS CHAR) AS id FROM courses WHERE course_code=?",
        [code],
      );
      courseIds.push(id);
      await db.query(
        "INSERT INTO course_versions (course_id,version_no,course_name,credits,effective_from,status,created_by) VALUES (?,1,?,?,'2026-01-01','ACTIVE',?)",
        [id, "Học phần kiểm thử " + code, credits, officerId],
      );
      const [{ versionId }] = await db.query(
        "SELECT CAST(id AS CHAR) AS versionId FROM course_versions WHERE course_id=?",
        [id],
      );
      versions.push(versionId);
    }
    const structure = {
      revision: program.revision,
      tracks: program.tracks.map((track) => ({
        id: track.id,
        groups: track.groups.map((group, index) => ({
          id: group.id,
          minimumCredits: index === 0 ? 60 : 0,
        })),
        courses: versions.map((courseVersionId, index) => ({
          courseVersionId,
          groupId: track.groups[0].id,
          requirementType: index === 0 ? "REQUIRED" : "ELECTIVE",
          semester: index === 0 ? null : 1,
        })),
      })),
    };
    const firstGroupId = program.tracks[0].groups[0].id;
    await db.query(
      "UPDATE curriculum_groups SET maximum_credits=59 WHERE id=?",
      [firstGroupId],
    );
    await call(prefix + "/" + program.id + "/cau-truc", 400, {
      method: "PUT",
      body: structure,
    });
    await db.query(
      "UPDATE curriculum_groups SET maximum_credits=NULL WHERE id=?",
      [firstGroupId],
    );
    const invalid = JSON.parse(JSON.stringify(structure));
    invalid.tracks[0].courses[0].groupId = "999999999";
    await call(prefix + "/" + program.id + "/cau-truc", 400, {
      method: "PUT",
      body: invalid,
    });
    program = await json(prefix + "/" + program.id + "/cau-truc", 200, {
      method: "PUT",
      body: structure,
    });
    assert.equal(program.tracks[0].courses[0].semester, null);
    await call(prefix + "/" + program.id + "/cau-truc", 409, {
      method: "PUT",
      body: structure,
    });
    assert.equal(
      (await json(prefix + "/" + program.id + "/kiem-tra", 200)).valid,
      true,
    );
    const catalog = await json(prefix + "/hoc-phan?searchTerm=" + marker, 200);
    assert.equal(catalog.meta.total, 2);
    const submit = () =>
      fetch(base + prefix + "/" + program.id + "/gui-duyet", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: officerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ revision: program.revision }),
      });
    const submissions = await Promise.all([submit(), submit()]);
    assert.deepEqual(
      submissions.map((result) => result.status).sort(),
      [201, 409],
    );
    checks += 2;
    program = await submissions.find((result) => result.status === 201).json();
    assert.equal(program.status, "SUBMITTED");
    await call(prefix + "/" + program.id, 409, {
      method: "PUT",
      body: input(program),
    });
    const review = {
      revision: program.revision,
      hoiDongThamDinh: "Hội đồng kiểm thử",
      chuTichHoidong: "Chủ tịch",
      thuKhao: "Thư ký",
      ngayHop: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
      ketLuan: "YEU_CAU_SUA_DOI",
      yKienDongGop: "Điều chỉnh thông tin",
      soBienBan: "TEST-" + marker,
    };
    await db.query(
      "INSERT INTO user_roles (user_id,role_id) SELECT ?,id FROM roles WHERE role_code='APPROVER'",
      [officerId],
    );
    await call(prefix + "/" + program.id + "/xet-duyet", 403, {
      method: "POST",
      body: review,
    });
    await db.query(
      "DELETE ur FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.role_code='APPROVER'",
      [officerId],
    );
    await call(prefix + "/" + program.id + "/xet-duyet", 400, {
      method: "POST",
      body: { ...review, yKienDongGop: "" },
      cookie: reviewerCookie,
    });
    const wrong = new FormData();
    wrong.set("file", new Blob(["text"], { type: "text/plain" }), "bad.txt");
    await call(prefix + "/" + program.id + "/tai-lieu", 400, {
      method: "POST",
      form: wrong,
      cookie: reviewerCookie,
    });
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const form = new FormData();
    form.set(
      "file",
      new Blob([pdf], { type: "application/pdf" }),
      "biên-bản.pdf",
    );
    const document = await json(prefix + "/" + program.id + "/tai-lieu", 201, {
      method: "POST",
      form,
      cookie: reviewerCookie,
    });
    assert.equal(document.name, "biên-bản.pdf");
    const download = await call(
      prefix + "/" + program.id + "/tai-lieu/" + document.id,
      200,
    );
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
    await call(prefix + "/" + program.id + "/tai-lieu/" + document.id, 401, {
      cookie: "",
    });
    await db.query("DELETE FROM user_scopes WHERE user_id=?", [reviewerId]);
    await call(prefix + "/" + program.id, 404, { cookie: reviewerCookie });
    await call(prefix + "/" + program.id + "/xet-duyet", 404, {
      method: "POST",
      body: review,
      cookie: reviewerCookie,
    });
    await call(prefix + "/" + program.id + "/tai-lieu/" + document.id, 404, {
      cookie: reviewerCookie,
    });
    await db.query(
      "INSERT INTO user_scopes (user_id,scope_type) VALUES (?,'GLOBAL')",
      [reviewerId],
    );
    program = await json(prefix + "/" + program.id + "/xet-duyet", 201, {
      method: "POST",
      body: review,
      cookie: reviewerCookie,
    });
    assert.equal(program.status, "RETURNED");
    assert.equal(program.review.ketLuan, "YEU_CAU_SUA_DOI");
    await call(prefix + "/" + program.id + "/xet-duyet", 409, {
      method: "POST",
      body: review,
      cookie: reviewerCookie,
    });
    program = await json(prefix + "/" + program.id, 200, {
      method: "PUT",
      body: { ...input(program), moTa: "Đã sửa " + marker },
    });
    program = await json(prefix + "/" + program.id + "/gui-duyet", 201, {
      method: "POST",
      body: { revision: program.revision },
    });
    const approve = {
      ...review,
      revision: program.revision,
      ketLuan: "DAT_DIEU_KIEN",
      yKienDongGop: "Đủ điều kiện",
    };
    await call(prefix + "/" + program.id + "/xet-duyet", 400, {
      method: "POST",
      body: { ...approve, ngayHop: "2999-01-01" },
      cookie: reviewerCookie,
    });
    const decide = () =>
      fetch(base + prefix + "/" + program.id + "/xet-duyet", {
        method: "POST",
        headers: {
          Origin: base,
          Cookie: reviewerCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approve),
      });
    const decisions = await Promise.all([decide(), decide()]);
    assert.deepEqual(
      decisions.map((result) => result.status).sort(),
      [201, 409],
    );
    checks += 2;
    program = await decisions.find((result) => result.status === 201).json();
    assert.equal(program.status, "PUBLISHED");
    await call(prefix + "/" + program.id, 409, {
      method: "PUT",
      body: input(program),
    });
    assert.equal(program.tracks[0].courses[0].semester, null);
    await call(prefix + "/" + program.id + "/cau-truc", 409, {
      method: "PUT",
      body: { ...structure, revision: program.revision },
    });
    assert.equal(
      (
        await json(
          prefix + "?searchTerm=" + marker + "&selectedStatus=PUBLISHED",
          200,
        )
      ).meta.total,
      1,
    );
    await call(prefix + "/" + program.id + "/tai-lieu", 409, {
      method: "POST",
      form,
      cookie: reviewerCookie,
    });
    const [count] = await db.query(
      "SELECT COUNT(*) AS total FROM program_review_documents WHERE program_version_id=?",
      [program.id],
    );
    assert.equal(Number(count.total), 1);
    const [audit] = await db.query(
      "SELECT COUNT(*) AS total FROM audit_logs WHERE entity_type='program_version' AND entity_id=?",
      [program.id],
    );
    assert.ok(Number(audit.total) >= 8);
  } finally {
    try {
      const owned = await db.query(
        "SELECT CAST(v.id AS CHAR) AS id,CAST(p.id AS CHAR) AS programId,v.status FROM program_versions v JOIN training_programs p ON p.id=v.program_id WHERE p.program_code=?",
        [marker],
      );
      for (const item of owned) {
        if (["SUBMITTED", "REVIEWING"].includes(item.status)) {
          await db.query(
            "UPDATE approval_requests SET current_status='RETURNED',completed_at=UTC_TIMESTAMP(6),latest_comment='Kết thúc kiểm thử' WHERE program_version_id=? AND current_status='PENDING'",
            [item.id],
          );
          await db.query(
            "UPDATE program_versions SET status='RETURNED',status_reason='Kết thúc kiểm thử' WHERE id=?",
            [item.id],
          );
        }
        if (item.status !== "RETIRED")
          await db.query(
            "UPDATE program_versions SET status='RETIRED',retired_at=UTC_TIMESTAMP(6),status_reason='Bản ghi kiểm thử tự động' WHERE id=?",
            [item.id],
          );
        await db.query(
          "UPDATE training_programs SET status='RETIRED' WHERE id=?",
          [item.programId],
        );
      }
      for (const id of courseIds) {
        await db.query(
          "UPDATE course_versions SET status='RETIRED' WHERE course_id=?",
          [id],
        );
        await db.query(
          "UPDATE courses SET status='RETIRED',retired_at=UTC_TIMESTAMP(6) WHERE id=?",
          [id],
        );
      }
      for (const id of [officerId, reviewerId].filter(Boolean)) {
        await db.query("DELETE FROM user_scopes WHERE user_id=?", [id]);
        await db.query(
          "UPDATE users SET account_status='DISABLED',deleted_at=UTC_TIMESTAMP(6) WHERE id=? AND username LIKE ?",
          [id, marker + "_%"],
        );
      }
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  }
  console.log(
    JSON.stringify({
      integration: "passed",
      checks,
      marker,
      cleanup:
        "All writes were confined to the isolated test database; fixtures retired and accounts soft-deleted.",
    }),
  );
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
