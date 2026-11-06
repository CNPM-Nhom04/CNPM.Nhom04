import { DataSource } from "typeorm";
import { MysqlReportRepository } from "./report.repository";
import { AdminReportExport1794200000000 } from "../../../core/database/migrations/1794200000000-AdminReportExport";
describe("Reports after AGU catalog import", () => {
  it("uses active source catalog with real credit metadata and preserves local scope checks", async () => {
    const query = jest.fn().mockResolvedValue([
      {
        id: 1,
        programVersionId: 3,
        status: "DRAFT",
        isSourceVersion: 1,
        tongTinChi: null,
        soHocVien: 0,
      },
    ]);
    const repo = new MysqlReportRepository({ query } as unknown as DataSource);
    const rows = await repo.findAll(
      { actorId: "1", selectedDegree: "MASTER" },
      0,
      20,
    );
    expect(rows[0]).toMatchObject({
      tongTinChi: null,
      trangThai: "Công bố trên AGU",
    });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("p.deleted_at IS NULL");
    expect(sql).toContain("program_version_sources");
    expect(sql).toContain("src.total_credits");
    expect(sql).toContain("user_scopes");
    expect(sql).toContain("vw_user_student_access");
    expect(params.slice(0, 2)).toEqual(["1", "1"]);
    expect(params.slice(-2)).toEqual([20, 0]);
  });
  it("only adds the missing export grant to ADMIN", async () => {
    const query = jest.fn();
    await new AdminReportExport1794200000000().up({ query } as any);
    expect(query.mock.calls[0][0]).toContain("r.role_code='ADMIN'");
    expect(query.mock.calls[0][0]).toContain(
      "p.permission_code='PROGRAM_EXPORT'",
    );
    expect(query.mock.calls[0][0]).not.toContain("LECTURER");
  });
});
