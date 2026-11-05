/** Explicit local maintenance, dry-run by default. No user/grade/assignment writes. */
const path = require("node:path"),
  fs = require("node:fs");
require("ts-node/register/transpile-only");
require("dotenv").config({ quiet: true });
const db = require("../src/core/database/data-source").default;
const { manifest } = require("./agu/manifest.cjs");
const apply = process.argv.includes("--apply"),
  replace = process.argv.includes("--replace-old");
const oldCodes = ["MIT", "TEST_MIT_01", "ENG999", "sp", "sp1"];
(async () => {
  const data = manifest();
  await db.initialize();
  const old = await db.query(
    "SELECT CAST(id AS CHAR) id,program_code code FROM training_programs WHERE deleted_at IS NULL AND program_code IN (?,?,?,?,?)",
    oldCodes,
  );
  const [master] = await db.query(
    "SELECT CAST(id AS CHAR) id FROM education_levels WHERE level_code='MASTER' AND status='ACTIVE'",
  );
  if (!master) throw Error("Missing active MASTER education level");
  const stats = {
    majors: data.length,
    versions: data.flatMap((m) => m.programmes).length,
    remove: replace ? old : [],
    apply,
  };
  if (!apply) {
    console.log(JSON.stringify(stats));
    return;
  }
  const [actor] = await db.query(
    "SELECT CAST(u.id AS CHAR) id,u.username FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.role_code='ADMIN' AND r.status='ACTIVE' AND u.account_status='ACTIVE' AND u.deleted_at IS NULL LIMIT 1",
  );
  if (!actor) throw Error("No active admin for maintenance audit");
  const backupDir = path.resolve(__dirname, "../../../artifacts/backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backup = {
    createdAt: new Date().toISOString(),
    reason: "Before AGU catalog replacement",
    tables: {},
  };
  for (const table of [
    "training_programs",
    "program_versions",
    "program_ui_details",
    "program_version_tracks",
    "curriculum_groups",
    "curriculum_courses",
    "curriculum_prerequisites",
    "curriculum_course_plos",
    "program_learning_outcomes",
    "approval_requests",
    "approval_actions",
    "program_review_minutes",
    "program_review_documents",
    "program_catalog_sources",
    "program_version_sources",
  ])
    backup.tables[table] = await db.query(`SELECT * FROM ${table}`);
  const backupFile = path.join(backupDir, "before-agu-" + Date.now() + ".json");
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), {
    mode: 0o600,
  });
  // Verify independently that historical grades and memberships remain byte-for-byte unchanged.
  const protectedTables = [
    "student_course_results",
    "grade_details",
    "grade_revisions",
    "student_program_assignments",
    "student_classes",
    "student_class_memberships",
  ];
  const protectedBefore = {};
  for (const table of protectedTables)
    protectedBefore[table] = JSON.stringify(
      await db.query(`SELECT * FROM ${table} ORDER BY 1,2`),
    );
  await db.transaction("READ COMMITTED", async (manager) => {
    for (const major of data) {
      const unitCode =
        "AGU_SOURCE_" +
        data
          .filter(
            (m, i, a) =>
              a.findIndex((x) => x.institution === m.institution) === i,
          )
          .findIndex((x) => x.institution === major.institution);
      let [unit] = await manager.query(
        "SELECT CAST(id AS CHAR) id FROM organizational_units WHERE unit_code=?",
        [unitCode],
      );
      if (!unit) {
        const result = await manager.query(
          "INSERT INTO organizational_units(unit_code,unit_name,unit_type,status,description) VALUES(?,?,'SCHOOL','ACTIVE',?)",
          [
            unitCode,
            major.institution,
            "Trường đào tạo được công bố tại " + major.url,
          ],
        );
        unit = { id: String(result.insertId) };
      }
      const first = major.programmes[0];
      const majorCode = first
        ? first.code
            .replace(/[^A-Za-z0-9_-]/g, "_")
            .replace(/_+/g, "_")
            .replace(/_$/, "")
        : "AGU_MAJOR_" + major.id;
      let [source] = await manager.query(
        "SELECT CAST(program_id AS CHAR) id FROM program_catalog_sources WHERE source_major_id=?",
        [major.id],
      );
      let programId = source?.id;
      if (!programId) {
        const internalMajorCode = majorCode + "_AGU" + major.id;
        let [m] = await manager.query(
          "SELECT CAST(id AS CHAR) id FROM majors WHERE major_code=?",
          [internalMajorCode],
        );
        if (!m) {
          const inserted = await manager.query(
            "INSERT INTO majors(organizational_unit_id,major_code,major_name,status) VALUES(?,?,?,'ACTIVE')",
            [unit.id, internalMajorCode, major.name],
          );
          m = { id: String(inserted.insertId) };
        }
        const inserted = await manager.query(
          "INSERT INTO training_programs(major_id,education_level_id,managing_unit_id,program_code,program_name,description,status) VALUES(?,?,?,?,?,?,'ACTIVE')",
          [
            m.id,
            master.id,
            unit.id,
            "AGU_" + major.id + "_" + majorCode,
            major.name,
            "Nguồn chính thức: " + major.url,
          ],
        );
        programId = String(inserted.insertId);
        await manager.query(
          "INSERT INTO program_catalog_sources(program_id,source_major_id,source_url,institution_name,original_major_code) VALUES(?,?,?,?,?)",
          [
            programId,
            major.id,
            major.url,
            major.institution,
            first?.code || null,
          ],
        );
      }
      for (const programme of major.programmes) {
        const [existing] = await manager.query(
          "SELECT CAST(program_version_id AS CHAR) id,source_hash hash FROM program_version_sources WHERE source_programme_id=?",
          [programme.id],
        );
        if (existing) {
          if (existing.hash !== programme.hash)
            throw Error(
              "Source has changed for programme " +
                programme.id +
                "; review a new import revision before replacing",
            );
          await manager.query(
            "UPDATE program_version_sources SET total_credits=? WHERE program_version_id=?",
            [programme.credits, existing.id],
          );
          await manager.query(
            "UPDATE program_ui_details SET required_total_credits=?,duration_label=?,english_name=? WHERE program_version_id=?",
            [
              programme.credits,
              programme.duration,
              programme.englishName,
              existing.id,
            ],
          );
          continue;
        }
        const version = await manager.query(
          "INSERT INTO program_versions(program_id,version_code,program_name_snapshot,search_text,cohort_year,status,created_by,status_reason) VALUES(?,?,?,?,?,'DRAFT',?,?)",
          [
            programId,
            "AGU-" + programme.id,
            programme.name,
            [programme.name, major.name, programme.code].join(" "),
            programme.cohortYear,
            actor.id,
            "Bản đối chiếu công bố trên AGU; không giả lập quy trình duyệt nội bộ.",
          ],
        );
        const versionId = String(version.insertId);
        await manager.query(
          "INSERT INTO program_ui_details(program_version_id,english_name,study_form,duration_label,cohort_label,required_total_credits,description) VALUES(?,?,?,?,?,?,?)",
          [
            versionId,
            programme.englishName,
            programme.studyForm === "Vừa làm vừa học"
              ? "VUA_LAM_VUA_HOC"
              : "CHINH_QUY",
            programme.duration,
            programme.cohortLabel,
            programme.credits,
            "Dữ liệu công bố tại " + programme.url,
          ],
        );
        await manager.query(
          "INSERT INTO program_version_sources(program_version_id,source_programme_id,source_url,document_url,source_hash,content_text,total_credits) VALUES(?,?,?,?,?,?,?)",
          [
            versionId,
            programme.id,
            programme.url,
            programme.documentUrl,
            programme.hash,
            programme.content,
            programme.credits,
          ],
        );
      }
    }
    if (replace)
      for (const item of old)
        await manager.query(
          "UPDATE training_programs SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=? AND deleted_at IS NULL",
          [item.id],
        );
    for (const table of protectedTables) {
      const after = JSON.stringify(
        await manager.query(`SELECT * FROM ${table} ORDER BY 1,2`),
      );
      if (after !== protectedBefore[table])
        throw Error("Protected history changed: " + table);
    }
    await manager.query(
      "INSERT INTO audit_logs(actor_id,actor_username,action,entity_type,old_value,new_value,ip_address) VALUES(?,?,'IMPORT_AGU','training_program_catalog',?,?,'127.0.0.1')",
      [
        actor.id,
        actor.username,
        JSON.stringify({
          removedFromCatalog: replace ? old : [],
          backup: path.basename(backupFile),
        }),
        JSON.stringify({
          majors: data.length,
          versions: data.flatMap((m) => m.programmes).length,
          source: "https://pgd.agu.edu.vn/trainings/majors",
        }),
      ],
    );
  });
  console.log(
    JSON.stringify({
      ...stats,
      backup: backupFile,
      historicalDataUnchanged: true,
    }),
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (db.isInitialized) await db.destroy();
  });
