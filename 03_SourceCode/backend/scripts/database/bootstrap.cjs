/* Restore ctdt.sql into an EMPTY database only. */
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
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
    const source = await fs.readFile(
      path.resolve(__dirname, "../../src/core/database/ctdt.sql"),
      "utf8",
    );
    // This directive is for the MariaDB command-line client, not the server.
    const sql = statements(
      source.replace(/^\/\*M!999999\\- enable the sandbox mode \*\/[^\S\r\n]*\r?$/m, ""),
    );
    if (!sql.length) throw new Error("Database dump is empty");
    for (const statement of sql) {
      await db.query(statement);
    }
    console.log("Database restored from ctdt.sql. Run migrations next.");
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
