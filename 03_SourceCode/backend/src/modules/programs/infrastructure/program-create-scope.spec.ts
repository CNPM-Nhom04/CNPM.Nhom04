import { DataSource } from "typeorm";
import { MysqlProgramRepository } from "./program.repository";
import { ProgramActor, ProgramInput } from "../domain/program";

describe("new program scope regression (BUG-001)", () => {
  const input = {
    educationLevelId: "2",
    managingUnitId: "6",
    majorId: "12",
  } as ProgramInput;
  const actor = { id: "2", permissions: ["PROGRAM_EDIT"] } as ProgramActor;
  function setup(allowed: boolean) {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: "12" }])
      .mockResolvedValueOnce(allowed ? [{ allowed: 1 }] : [])
      .mockRejectedValueOnce(new Error("reached insert"));
    const repo = new MysqlProgramRepository({} as DataSource);
    jest
      .spyOn(repo as any, "write")
      .mockImplementation(async (_actor, _permission, fn: any) =>
        fn({ query }),
      );
    return { repo, query };
  }
  it("does not reference a deleted_at column on the synthetic new program", async () => {
    const { repo, query } = setup(true);
    await expect(repo.create(input, actor)).rejects.toThrow("reached insert");
    expect(query.mock.calls[1][0]).toContain("major_id");
    expect(query.mock.calls[1][0]).not.toContain("p.deleted_at");
    expect(query.mock.calls[1][1]).toEqual(["12", "6", "2"]);
    expect(query.mock.calls[2][0]).toContain("INSERT INTO training_programs");
  });
  it("still rejects a new program outside the actor scope before inserting", async () => {
    const { repo, query } = setup(false);
    await expect(repo.create(input, actor)).rejects.toThrow(
      "Không có quyền tạo CTĐT",
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
});
