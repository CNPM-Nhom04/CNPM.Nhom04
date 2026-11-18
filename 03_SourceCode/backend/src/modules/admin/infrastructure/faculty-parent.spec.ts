import { DataSource } from "typeorm";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { FacultyInputDto } from "../application/faculty.dto";
import { Actor } from "../domain/admin.repository";
import { MysqlAdminRepository } from "./admin.repository";

describe("Faculty parent selection", () => {
  const input = {
    code: "QA_KHOA",
    name: "Khoa kiểm thử",
    description: "",
    status: "ACTIVE" as const,
    parentId: "6",
  };
  function setup(old: unknown = null) {
    const query = jest.fn();
    const repo = new MysqlAdminRepository({} as DataSource);
    jest
      .spyOn(repo as any, "write")
      .mockImplementation(async (_actor, fn: any) => fn({ query }));
    const faculty = jest
      .spyOn(repo as any, "faculty")
      .mockResolvedValue(old || { id: "20", ...input });
    jest.spyOn(repo as any, "audit").mockResolvedValue(undefined);
    return { repo, query, faculty };
  }
  it("accepts a parent ID or an empty root and rejects names as IDs", async () => {
    expect(
      await validate(plainToInstance(FacultyInputDto, input)),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(FacultyInputDto, { ...input, parentId: "" }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(FacultyInputDto, { ...input, parentId: "AGU" }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("inserts the selected active parent with the new faculty", async () => {
    const { repo, query } = setup();
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "6" }])
      .mockResolvedValueOnce({ insertId: 20 });
    await repo.saveFaculty(null, input, {} as Actor);
    expect(query.mock.calls[1][1]).toEqual(["6"]);
    expect(query.mock.calls[2][0]).toContain("parent_id");
    expect(query.mock.calls[2][1]).toEqual([
      input.code,
      input.name,
      "",
      "ACTIVE",
      "6",
    ]);
  });
  it("rejects a missing or inactive parent before creating a faculty", async () => {
    const { repo, query } = setup();
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(repo.saveFaculty(null, input, {} as Actor)).rejects.toThrow(
      "đơn vị cha đang hoạt động",
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("keeps existing hierarchy immutable before any update", async () => {
    const { repo, query } = setup({
      id: "20",
      parentId: "7",
      updatedAt: "revision",
    });
    query.mockResolvedValueOnce([]);
    await expect(
      repo.saveFaculty("20", input, {} as Actor, "revision"),
    ).rejects.toThrow("Không đổi đơn vị cha");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
