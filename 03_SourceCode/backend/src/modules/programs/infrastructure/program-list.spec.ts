import { DataSource } from "typeorm";
import { MysqlProgramRepository } from "./program.repository";
import { ProgramActor } from "../domain/program";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ProgramQueryDto } from "../application/program.dto";
describe("Degree filters and official source visibility", () => {
  const actor = { id: "17", permissions: ["PROGRAM_READ"] } as ProgramActor;
  it.each(["ALL", "MASTER", "DOCTOR"] as const)(
    "applies %s to paginated versions, totals and unversioned counts",
    async (level) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }]);
      const repo = new MysqlProgramRepository({
        query,
      } as unknown as DataSource);
      await repo.list({ page: 2, limit: 20, selectedLevel: level }, actor);
      expect(query).toHaveBeenCalledTimes(3);
      for (const [sql, params] of query.mock.calls) {
        expect(sql).toContain("e.level_code=");
        expect(sql).toContain("e.level_code='PHD'");
        expect(sql).toContain("p.deleted_at IS NULL");
        expect(params.slice(0, 4)).toEqual(["17", level, level, level]);
      }
      expect(query.mock.calls[0][1].slice(-2)).toEqual([20, 20]);
    },
  );
  it("filters unversioned roots at the SQL level as well", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    const repo = new MysqlProgramRepository({ query } as unknown as DataSource);
    await repo.unversioned(
      { page: 1, limit: 20, selectedLevel: "MASTER" },
      actor,
    );
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("e.level_code=");
      expect(params.slice(0, 4)).toEqual(["17", "MASTER", "MASTER", "MASTER"]);
    }
  });
  it("allows official public-source reads without using that exception for writes", async () => {
    const query = jest.fn().mockResolvedValue([]);
    const repo = new MysqlProgramRepository({
      query,
      manager: { query },
    } as unknown as DataSource);
    await expect(repo.detail("50", actor)).rejects.toThrow();
    expect(query.mock.calls[0][0]).toContain("OR cs.program_id IS NOT NULL");
    query.mockClear();
    await expect(
      (repo as any).get({ query }, "50", actor, true),
    ).rejects.toThrow();
    expect(query.mock.calls[0][0]).not.toContain(
      "OR cs.program_id IS NOT NULL",
    );
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
  });
  it("rejects invalid degree filter values", async () => {
    expect(
      await validate(
        plainToInstance(ProgramQueryDto, { selectedLevel: "MASTER" }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(ProgramQueryDto, { selectedLevel: "MASTER' OR 1=1" }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
