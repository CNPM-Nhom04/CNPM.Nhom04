import { DataSource } from "typeorm";
import { MysqlApprovalRepository } from "../../approvals/infrastructure/approval.repository";
import { MysqlComparisonRepository } from "../../comparisons/infrastructure/comparison.repository";
import { MysqlStudentAccountsRepository } from "../../student-accounts/infrastructure/student-accounts.repository";

describe("Removed programs never reappear in new academic selections", () => {
  let query: jest.Mock, db: DataSource;
  beforeEach(() => {
    query = jest.fn(async (sql: string) =>
      sql.includes("COUNT(*)") ? [{ total: 0 }] : [],
    );
    db = {
      query,
      transaction: async (_level, fn) => fn({ query }),
    } as unknown as DataSource;
  });
  it("filters approval rows, totals, summaries and direct detail consistently", async () => {
    const repo = new MysqlApprovalRepository(db);
    await repo.list({ page: 1, limit: 20, status: "ALL" }, "1");
    await expect(repo.detail("7", "1")).rejects.toThrow();
    for (const [sql] of query.mock.calls)
      expect(sql).toContain("p.deleted_at IS NULL");
  });
  it("offers verified source versions for comparison without exposing removed programs", async () => {
    await new MysqlComparisonRepository(db).options("1", {
      page: 1,
      limit: 20,
    });
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain("p.deleted_at IS NULL");
      expect(sql).toContain("program_version_sources");
    }
  });
  it("rejects assigning new students/classes to a removed program", async () => {
    const repo = new MysqlStudentAccountsRepository(db);
    await expect((repo as any).track({ query }, "3", true)).rejects.toThrow();
    expect(query.mock.calls[0][0]).toContain("p.deleted_at IS NULL");
  });
});
