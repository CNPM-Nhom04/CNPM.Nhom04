/* Initialize an EMPTY database only. Never imports the old MIT demo records. */
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { statements } = require("./sql-statements.cjs");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: "Z",
  });
  try {
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) total FROM information_schema.tables WHERE table_schema=DATABASE()",
    );
    if (Number(total)) {
      if (process.argv.includes("--if-empty")) {
        console.log("Existing schema preserved; bootstrap skipped.");
        return;
      }
      throw new Error(
        "Database is not empty. Bootstrap refuses to replace existing data.",
      );
    }
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
    if (password.length < 10 || password.length > 72)
      throw new Error(
        "Set BOOTSTRAP_ADMIN_PASSWORD to 10–72 characters for a new database.",
      );
    const sql = statements(
      await fs.readFile(
        path.resolve(__dirname, "../../src/core/database/CSDL.sql"),
        "utf8",
      ),
    );
    const schema = sql.slice(
      0,
      sql.findIndex((s) => /^INSERT INTO education_levels\b/i.test(s)),
    );
    if (!schema.length) throw new Error("Cannot locate base schema");
    for (const statement of schema) {
      if (/^(?:DROP DATABASE|CREATE DATABASE|USE)\b/i.test(statement)) continue;
      await db.query(statement);
    }
    const referenceTables = new Set([
      "education_levels",
      "study_tracks",
      "education_level_tracks",
      "roles",
      "permissions",
      "role_permissions",
      "system_settings",
      "api_scopes",
      "workflow_transitions",
    ]);
    for (const statement of sql) {
      const match = statement.match(/^INSERT INTO (\w+)\b/i);
      if (match && referenceTables.has(match[1])) await db.query(statement);
    }
    await db.query(
      "INSERT INTO organizational_units(unit_code,unit_name,unit_type) VALUES('AGU_SOURCE_0','Trường Đại học An Giang','SCHOOL')",
    );
    const [unit] = await db.query(
      "SELECT id FROM organizational_units WHERE unit_code='AGU_SOURCE_0'",
    );
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
    await db.query(
      "INSERT INTO users(organizational_unit_id,username,password_hash,full_name,account_status,must_change_password) VALUES(?,?,?,'Quản trị hệ thống','ACTIVE',1)",
      [unit[0].id, username, await bcrypt.hash(password, 12)],
    );
    const [users] = await db.query("SELECT id FROM users WHERE username=?", [
      username,
    ]);
    await db.query(
      "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_code='ADMIN'",
      [users[0].id],
    );
    await db.query(
      "INSERT INTO user_scopes(user_id,scope_type) VALUES(?,'GLOBAL')",
      [users[0].id],
    );
    console.log(
      "Empty database initialized with reference data and an admin requiring password change. Run migrations next.",
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
