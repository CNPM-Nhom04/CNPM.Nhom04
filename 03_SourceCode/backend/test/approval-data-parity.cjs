/* Read-only configured DB: no users/sessions/decisions are created. */
const assert = require("node:assert/strict"),
  path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const { DataSource } = require("typeorm"),
  {
    MysqlApprovalRepository,
  } = require("../dist/modules/approvals/infrastructure/approval.repository");
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
  const repo = new MysqlApprovalRepository(db);
  const users = await db.query(
    "SELECT CAST(u.id AS CHAR) id,u.username FROM users u WHERE u.account_status='ACTIVE' AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE' JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND p.permission_code='PROGRAM_APPROVE')",
  );
  let total = 0;
  for (const u of users) {
    const data = [];
    let page = 1,
      result;
    do {
      result = await repo.list(
        { status: "ALL", reviewState: "ALL", page, limit: 100 },
        u.id,
      );
      data.push(...result.data);
      page++;
    } while (page <= result.meta.totalPages);
    const expected = await db.query(
      "SELECT CAST(r.id AS CHAR) id,r.current_status status,r.request_no requestNo,CAST(r.program_version_id AS CHAR) versionId,r.revision FROM approval_requests r JOIN program_versions v ON v.id=r.program_version_id WHERE EXISTS(SELECT 1 FROM vw_user_program_access a WHERE a.user_id=? AND a.program_id=v.program_id) ORDER BY r.requested_at DESC,r.id DESC",
      [u.id],
    );
    same(
      data.map((r) => ({
        id: r.id,
        status: r.status,
        requestNo: r.requestNo,
        versionId: r.versionId,
        revision: r.revision,
      })),
      expected.map((r) => ({ ...r, revision: Number(r.revision) })),
      u.username + " every review cycle",
    );
    same(result.meta.total, expected.length, "SQL count");
    for (const status of ["PENDING", "RETURNED", "APPROVED", "CANCELLED"]) {
      same(
        result.summary[status],
        expected.filter((r) => r.status === status).length,
        "summary " + status,
      );
      same(
        (await repo.list({ status, page: 1, limit: 100 }, u.id)).meta.total,
        expected.filter((r) => r.status === status).length,
        "filter " + status,
      );
    }
    for (const row of data) {
      const detail = await repo.detail(row.id, u.id);
      const actions = await db.query(
        "SELECT CAST(id AS CHAR) id,action_type action,comment_text comment FROM approval_actions WHERE approval_request_id=? ORDER BY created_at,id",
        [row.id],
      );
      same(
        detail.actions.map((a) => ({
          id: a.id,
          action: a.action,
          comment: a.comment,
        })),
        actions,
        "complete action history",
      );
      const [minutes] = await db.query(
        "SELECT conclusion,meeting_date FROM program_review_minutes WHERE approval_request_id=?",
        [row.id],
      );
      same(
        detail.minutes?.ketLuan || null,
        minutes?.conclusion || null,
        "no invented minutes",
      );
      const docs = await db.query(
        "SELECT CAST(id AS CHAR) id,CAST(approval_request_id AS CHAR) requestId FROM program_review_documents WHERE approval_request_id=? OR(program_version_id=? AND approval_request_id IS NULL) ORDER BY id",
        [row.id, row.versionId],
      );
      same(
        detail.documents.map((d) => ({ id: d.id, requestId: d.requestId })),
        docs,
        "document cycle provenance",
      );
      const [meta] = await db.query(
        "SELECT r.review_started_at,r.completed_at,r.reviewing_by,r.reminder_count,r.next_reminder_at FROM approval_requests r WHERE r.id=?",
        [row.id],
      );
      same(
        detail.reviewStartedAt,
        meta.review_started_at?.toISOString() || null,
        "SQL review start",
      );
      same(
        detail.completedAt,
        meta.completed_at?.toISOString() || null,
        "SQL completion",
      );
      same(
        detail.reviewerId,
        meta.reviewing_by == null ? null : String(meta.reviewing_by),
        "SQL reviewer",
      );
      same(
        detail.reminderCount,
        Number(meta.reminder_count),
        "SQL reminder count",
      );
      total++;
    }
  }
  assert(
    users.length > 0 && total > 0,
    "Need scoped approver and real SQL review history.",
  );
  console.log(
    "PASS " +
      checks +
      " read-only approval SQL parity checks; " +
      total +
      " scoped cycles.",
  );
}
run()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => (db.isInitialized ? db.destroy() : undefined));
