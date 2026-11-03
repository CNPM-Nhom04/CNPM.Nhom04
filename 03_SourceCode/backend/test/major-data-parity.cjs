/* Read-only parity against the configured MariaDB. Does not create users or sessions. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
require("ts-node/register/transpile-only");
const { DataSource } = require("typeorm"),
  {
    MysqlAdminRepository,
  } = require("../src/modules/admin/infrastructure/admin.repository");
const db = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
});
let checks = 0;
const same = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
async function run() {
  await db.initialize();
  const repo = new MysqlAdminRepository(db);
  const rows = await db.query(
    "SELECT CAST(m.id AS CHAR) id,m.major_code majorCode,m.major_name majorName,CAST(m.organizational_unit_id AS CHAR) unitId,m.status,u.unit_code unitCode,u.unit_name unitName FROM majors m JOIN organizational_units u ON u.id=m.organizational_unit_id ORDER BY m.major_code,m.id",
  );
  for (const status of ["ALL", "ACTIVE", "INACTIVE"]) {
    const expected = rows.filter(
        (r) => status === "ALL" || r.status === status,
      ),
      actual = await repo.listMajors({ page: 1, limit: 100, status });
    same(actual.meta.total, expected.length, "status count " + status);
    same(
      actual.data.map((r) => r.id),
      expected.slice(0, 100).map((r) => r.id),
      "status IDs " + status,
    );
  }
  for (const row of rows) {
    const item = await repo.majorDetail(row.id);
    for (const key of [
      "id",
      "majorCode",
      "majorName",
      "unitId",
      "unitCode",
      "unitName",
      "status",
    ])
      same(item[key], row[key], key);
    const [usage] = await db.query(
      "SELECT (SELECT COUNT(*) FROM training_programs WHERE major_id=?) p,(SELECT COUNT(*) FROM user_scopes WHERE major_id=?) u,(SELECT COUNT(*) FROM registration_period_scopes WHERE major_id=?) r",
      [row.id, row.id, row.id],
    );
    same(item.programCount, Number(usage.p), "program references");
    same(item.userScopeCount, Number(usage.u), "user scopes");
    same(item.registrationScopeCount, Number(usage.r), "registration scopes");
    same(
      item.identityLocked,
      Number(usage.p) + Number(usage.u) + Number(usage.r) > 0,
      "identity lock",
    );
    assert.match(
      item.updatedAt,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/,
    );
    checks++;
    const result = await repo.listMajors({
      page: 1,
      limit: 100,
      unitId: row.unitId,
      searchTerm: row.majorCode,
    });
    same(
      result.data.some((r) => r.id === row.id),
      true,
      "unit/search",
    );
  }
  const units = await repo.majorOptions(),
    raw = await db.query(
      "SELECT CAST(id AS CHAR) id,unit_code code,unit_name name FROM organizational_units WHERE status='ACTIVE' ORDER BY unit_name,id",
    );
  same(units.units, raw, "SQL options");
  same(
    (
      await repo.listMajors({
        page: 1,
        limit: 20,
        searchTerm: "__NO_SUCH_MAJOR_PARITY__",
      })
    ).meta.total,
    0,
    "empty result",
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      checks,
      sourceMajors: rows.length,
      readOnly: true,
    }),
  );
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
