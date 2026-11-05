import { DataSource } from "typeorm";
import { MysqlProgramRepository } from "./program.repository";
import { ProgramActor, ProgramItem } from "../domain/program";

describe("major eligibility lookup", () => {
  const actor = { id: "17", permissions: ["PROGRAM_EDIT"] } as ProgramActor;
  it("uses the target program's major and level within granted scope and approved curricula", async () => {
    const query = jest.fn().mockResolvedValue([{ courseId: "9" }]);
    const repository = new MysqlProgramRepository({
      query,
    } as unknown as DataSource);
    jest
      .spyOn(repository, "detail")
      .mockResolvedValue({
        majorId: "2",
        educationLevelId: "3",
      } as ProgramItem);
    expect(await repository.eligibleCourseIds("5", actor)).toEqual(["9"]);
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual(["2", "3", "17", "17"]);
    expect(sql).toContain("p.major_id=? AND p.education_level_id=?");
    expect(sql).toContain("v.status IN ('PUBLISHED','ARCHIVED')");
    expect(sql).toContain("user_scopes");
    expect(sql).toContain("vw_user_course_access");
  });
  it("does not query candidate courses when the target CTDT is inaccessible", async () => {
    const query = jest.fn();
    const repository = new MysqlProgramRepository({
      query,
    } as unknown as DataSource);
    jest
      .spyOn(repository, "detail")
      .mockRejectedValue(new Error("outside scope"));
    await expect(repository.eligibleCourseIds("5", actor)).rejects.toThrow(
      "outside scope",
    );
    expect(query).not.toHaveBeenCalled();
  });
});
