/* Explicit maintenance only. Dry run by default; full private backup precedes any write.
   Removes demo programs and their dependents without disabling foreign keys.
   Append-only DELETE triggers are restored in finally, including on rollback. */
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm");
const apply = process.argv.includes("--apply");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  synchronize: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
});
const qi = (s) => "`" + s.replaceAll("`", "``") + "`";
const demo = (s) => /^(?:QA_|VD_|TEST_|test\.)/i.test(String(s || ""));
const hash = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
(async () => {
  let runner;
  const dropped = [];
  try {
    await db.initialize();
    runner = db.createQueryRunner();
    await runner.connect();
    const tables = (
      await runner.query(
        "SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
      )
    ).map((r) => r.name);
    const columns = await runner.query(
      "SELECT TABLE_NAME t,COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_NAME='PRIMARY' ORDER BY TABLE_NAME,ORDINAL_POSITION",
    );
    const fks = await runner.query(
      "SELECT TABLE_NAME child,CONSTRAINT_NAME name,COLUMN_NAME cc,REFERENCED_TABLE_NAME parent,REFERENCED_COLUMN_NAME pc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION",
    );
    const byConstraint = new Map();
    for (const f of fks) {
      const k = f.child + ":" + f.name;
      if (!byConstraint.has(k)) byConstraint.set(k, []);
      byConstraint.get(k).push(f);
    }
    const data = {},
      nodes = [],
      nodeMap = new Map();
    for (const t of tables) {
      const pk = columns.filter((c) => c.t === t).map((c) => c.c);
      if (!pk.length) throw Error("Missing primary key: " + t);
      data[t] = await runner.query(
        "SELECT * FROM " + qi(t) + " ORDER BY " + pk.map(qi).join(","),
      );
      for (const row of data[t]) {
        const key = t + ":" + JSON.stringify(pk.map((k) => String(row[k])));
        const node = { key, t, pk, row, children: [] };
        nodes.push(node);
        nodeMap.set(key, node);
      }
    }
    const roots = new Set();
    const sourcePrograms = new Set(
      data.program_catalog_sources.map((r) => String(r.program_id)),
    );
    const livePrograms = new Set(
      data.training_programs
        .filter((r) => !r.deleted_at)
        .map((r) => String(r.id)),
    );
    const liveVersions = new Set(
      data.program_versions
        .filter((r) => livePrograms.has(String(r.program_id)))
        .map((r) => String(r.id)),
    );
    const liveTracks = new Set(
      data.program_version_tracks
        .filter((r) => liveVersions.has(String(r.program_version_id)))
        .map((r) => String(r.id)),
    );
    const liveCourses = new Set(
      data.curriculum_courses
        .filter((r) => liveTracks.has(String(r.program_version_track_id)))
        .map((r) => String(r.course_id)),
    );
    const legacyCodes = new Set(["MIT", "TEST_MIT_01", "ENG999", "sp", "sp1"]);
    const oldPrograms = new Set(
      data.training_programs
        .filter(
          (r) =>
            r.deleted_at &&
            legacyCodes.has(r.program_code) &&
            !sourcePrograms.has(String(r.id)),
        )
        .map((r) => String(r.id)),
    );
    if (!oldPrograms.size) {
      console.log(
        JSON.stringify({
          mode: apply ? "apply" : "dry-run",
          alreadyClean: true,
          sourceProgramsRetained: sourcePrograms.size,
        }),
      );
      return;
    }
    for (const n of nodes) {
      const r = n.row;
      if (n.t === "training_programs" && oldPrograms.has(String(r.id)))
        roots.add(n.key);
      if (n.t === "courses" && !liveCourses.has(String(r.id))) roots.add(n.key);
      if (n.t === "student_classes" && demo(r.class_code)) roots.add(n.key);
      if (n.t === "majors" && demo(r.major_code)) roots.add(n.key);
      if (n.t === "organizational_units" && demo(r.unit_code)) roots.add(n.key);
      if (n.t === "knowledge_blocks" && demo(r.block_code)) roots.add(n.key);
      if (
        n.t === "public_documents" &&
        (/^(?:QA\s*[—-]|VD[-_])/i.test(r.title || "") ||
          demo(r.reference_number))
      )
        roots.add(n.key);
      if (
        n.t === "admission_subscriptions" &&
        /^qa\./i.test(r.email || "") &&
        /@example\.com$/i.test(r.email || "")
      )
        roots.add(n.key);
    }
    // Graph every actual FK, including composite and self-referencing constraints.
    for (const cols of byConstraint.values()) {
      const { child, parent } = cols[0];
      const parentIndex = new Map();
      for (const p of nodes.filter((n) => n.t === parent))
        parentIndex.set(
          JSON.stringify(cols.map((c) => String(p.row[c.pc]))),
          p,
        );
      for (const c of nodes.filter((n) => n.t === child)) {
        if (cols.some((k) => c.row[k.cc] == null)) continue;
        const p = parentIndex.get(
          JSON.stringify(cols.map((k) => String(c.row[k.cc]))),
        );
        if (p && p !== c) p.children.push(c);
      }
    }
    // Students assigned solely to a removed program are explicitly approved demo data.
    const oldVersions = new Set(
      data.program_versions
        .filter((r) => oldPrograms.has(String(r.program_id)))
        .map((r) => String(r.id)),
    );
    const oldTracks = new Set(
      data.program_version_tracks
        .filter((r) => oldVersions.has(String(r.program_version_id)))
        .map((r) => String(r.id)),
    );
    const affectedStudents = new Set(
      data.student_program_assignments
        .filter((r) => oldTracks.has(String(r.program_version_track_id)))
        .map((r) => String(r.student_id)),
    );
    for (const n of nodes.filter(
      (n) => n.t === "students" && affectedStudents.has(String(n.row.id)),
    )) {
      if (
        data.student_program_assignments.some(
          (a) =>
            String(a.student_id) === String(n.row.id) &&
            !oldTracks.has(String(a.program_version_track_id)),
        )
      )
        throw Error(
          "Student also has a retained assignment; manual review required",
        );
      roots.add(n.key);
    }
    const selected = new Set(),
      order = [],
      visiting = new Set();
    function visit(n) {
      if (selected.has(n.key)) return;
      if (visiting.has(n.key))
        throw Error("Cyclic selected dependencies: " + n.t);
      visiting.add(n.key);
      for (const c of n.children) {
        if (c.t === "audit_logs" || c.t === "users")
          throw Error("Refusing to delete audit/accounts through a cascade");
        visit(c);
      }
      visiting.delete(n.key);
      selected.add(n.key);
      order.push(n);
    }
    for (const key of roots) visit(nodeMap.get(key));
    if (
      order.some(
        (n) =>
          n.t === "program_catalog_sources" ||
          n.t === "program_version_sources" ||
          (n.t === "training_programs" && sourcePrograms.has(String(n.row.id))),
      )
    )
      throw Error("Cleanup would touch AGU source data");
    const studentUserIds = new Set(
      nodes
        .filter(
          (n) =>
            n.t === "students" && selected.has(n.key) && n.row.user_id != null,
        )
        .map((n) => String(n.row.user_id)),
    );
    const studentOnly = (id) => {
      const roles = data.user_roles
        .filter((r) => String(r.user_id) === String(id))
        .map((r) =>
          data.roles.find((role) => String(role.id) === String(r.role_id)),
        )
        .filter((role) => role?.status === "ACTIVE");
      return (
        roles.length > 0 && roles.every((role) => role.role_code === "STUDENT")
      );
    };
    const disabledUsers = data.users
      .filter(
        (u) =>
          !u.deleted_at &&
          ((studentUserIds.has(String(u.id)) && studentOnly(u.id)) ||
            demo(u.username)),
      )
      .map((u) => String(u.id));
    const counts = {};
    for (const n of order) counts[n.t] = (counts[n.t] || 0) + 1;
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          deleteRows: counts,
          disableUsers: disabledUsers.length,
          sourceProgramsRetained: sourcePrograms.size,
        },
        null,
        2,
      ),
    );
    if (!apply) return;
    const directory = path.resolve(__dirname, "../../../../artifacts/backups");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const triggers = await runner.query("SHOW TRIGGERS");
    const definitions = [];
    for (const t of triggers) {
      const [r] = await runner.query("SHOW CREATE TRIGGER " + qi(t.Trigger));
      definitions.push({
        name: t.Trigger,
        table: t.Table,
        event: t.Event,
        sql: r["SQL Original Statement"],
      });
    }
    const backupFile = path.join(
      directory,
      "before-legacy-cleanup-" + Date.now() + ".json",
    );
    fs.writeFileSync(
      backupFile,
      JSON.stringify(
        {
          database: process.env.DB_DATABASE,
          createdAt: new Date().toISOString(),
          tables: data,
          triggers: definitions,
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    const affectedTables = new Set(order.map((n) => n.t));
    // DDL commits implicitly, so disable only DELETE guards before opening the data transaction.
    for (const t of definitions.filter(
      (t) => t.event === "DELETE" && affectedTables.has(t.table),
    )) {
      await runner.query("DROP TRIGGER " + qi(t.name));
      dropped.push(t);
    }
    await runner.startTransaction("SERIALIZABLE");
    // Stop if the snapshot changed during preparation instead of deleting unseen data.
    for (const t of tables) {
      const pk = columns.filter((c) => c.t === t).map((c) => c.c);
      const current = await runner.query(
        "SELECT * FROM " +
          qi(t) +
          " ORDER BY " +
          pk.map(qi).join(",") +
          " FOR UPDATE",
      );
      if (hash(current) !== hash(data[t]))
        throw Error("Data changed while preparing cleanup: " + t);
    }
    for (const n of order)
      await runner.query(
        "DELETE FROM " +
          qi(n.t) +
          " WHERE " +
          n.pk.map((k) => qi(k) + " <=> ?").join(" AND "),
        n.pk.map((k) => n.row[k]),
      );
    for (const id of disabledUsers) {
      await runner.query(
        "UPDATE users SET deleted_at=UTC_TIMESTAMP(6),account_status='DISABLED' WHERE id=?",
        [id],
      );
      await runner.query(
        "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
        [id],
      );
      await runner.query(
        "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
        [id],
      );
    }
    await runner.query(
      "DELETE FROM system_settings WHERE setting_key IN ('training.maxTinChiHocKy','training.thoiHanDangKyToiDa')",
    );
    // Keep AGU rows byte-for-byte unchanged.
    for (const t of ["program_catalog_sources", "program_version_sources"])
      if (
        hash(await runner.query("SELECT * FROM " + qi(t) + " ORDER BY 1")) !==
        hash(data[t])
      )
        throw Error("AGU data changed");
    await runner.commitTransaction();
    console.log(
      "Cleanup committed; private backup: " + path.basename(backupFile),
    );
  } finally {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    let restoreError;
    for (const t of dropped) {
      try {
        await runner.query(
          t.sql.replace(/DEFINER\s*=\s*`[^`]+`@`[^`]+`\s*/i, ""),
        );
      } catch (e) {
        restoreError = e;
      }
    }
    if (runner) await runner.release();
    if (db.isInitialized) await db.destroy();
    if (restoreError) throw restoreError;
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
