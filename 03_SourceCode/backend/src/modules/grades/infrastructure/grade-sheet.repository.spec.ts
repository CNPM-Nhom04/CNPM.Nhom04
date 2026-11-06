import { DataSource } from "typeorm";
import { MysqlGradeRepository } from "./grade.repository";
import { GradeActor } from "../domain/grade";

describe("class and curriculum based grade sheets", () => {
  const actor = {
    id: "7",
    username: "officer",
    canManage: true,
    canPrepare: true,
    ip: "",
  } as GradeActor;
  function setup({
    course = true,
    existing = [],
    offerings = [],
  }: { course?: boolean; existing?: any[]; offerings?: any[] } = {}) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM curriculum_courses cc"))
        return course
          ? [
              {
                id: "3",
                status: "ACTIVE",
                courseStatus: "ACTIVE",
                effective: 1,
              },
            ]
          : [];
      if (sql === "SELECT * FROM academic_terms WHERE id=? FOR UPDATE")
        return [
          {
            id: "2",
            status: "ACTIVE",
            start_date: "2026-01-01",
            end_date: "2026-12-31",
          },
        ];
      if (sql.startsWith("SELECT CAST(id AS CHAR) id FROM course_offerings"))
        return [];
      if (sql.includes("SELECT CAST(id AS CHAR) id FROM registration_periods"))
        return [{ id: "8" }];
      if (sql.startsWith("INSERT INTO course_offerings"))
        return { insertId: 9 };
      return [{ id: "7", allowed: 1 }];
    });
    const manager = { query };
    const transaction = jest.fn(async (_isolation, fn) => fn(manager));
    const repo = new MysqlGradeRepository({
      manager,
      transaction,
    } as unknown as DataSource);
    jest.spyOn(repo, "preparation").mockResolvedValue({
      context: { status: "ACTIVE", trackId: "4" },
      members: [{ studentId: "1", studentCode: "HV1" }],
      offerings,
      registrations: [],
      permissions: { canPrepare: true },
    });
    jest.spyOn(repo, "excelRows").mockResolvedValue(existing);
    const prepare = jest.spyOn(repo, "prepareRegistrations").mockResolvedValue({
      changed: 1,
      changes: [],
      unchanged: 0,
      applied: true,
    });
    return { repo, query, transaction, prepare, manager };
  }
  it("prepares only the selected curriculum course and class members atomically", async () => {
    const { repo, prepare, manager, transaction } = setup();
    expect(await repo.openSheet("1", "2", "3", actor)).toEqual({
      offeringId: "9",
      added: 1,
    });
    expect(prepare).toHaveBeenCalledWith(
      "1",
      "2",
      [expect.objectContaining({ studentCode: "HV1", offeringId: "9" })],
      actor,
      true,
      manager,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("reuses existing grade links without creating a second offering", async () => {
    const { repo, query } = setup({
      existing: [{ courseVersionId: "3", offeringId: "12" }],
    });
    expect((await repo.openSheet("1", "2", "3", actor)).offeringId).toBe("12");
    expect(
      query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO course_offerings"),
      ),
    ).toBe(false);
  });
  it("keeps existing sheets downloadable when the class is no longer active", async () => {
    const { repo, prepare } = setup({
      existing: [{ courseVersionId: "3", offeringId: "12" }],
    });
    jest
      .mocked(repo.preparation)
      .mockResolvedValue({
        context: { status: "INACTIVE", trackId: "4" },
        members: [],
        offerings: [],
        registrations: [],
        permissions: { canPrepare: true },
      });
    expect(await repo.openSheet("1", "2", "3", actor)).toEqual({
      offeringId: "12",
      added: 0,
    });
    expect(prepare).not.toHaveBeenCalled();
  });
  it("reuses one unused manual offering, preserving its configured policy", async () => {
    const { repo } = setup({
      offerings: [
        { courseVersionId: "3", offeringId: "14", enrolled: 0, status: "OPEN" },
      ],
    });
    expect((await repo.openSheet("1", "2", "3", actor)).offeringId).toBe("14");
  });
  it("rejects a course outside the class curriculum before inserting", async () => {
    const { repo, query } = setup({ course: false });
    await expect(repo.openSheet("1", "2", "3", actor)).rejects.toThrow(
      "Môn không thuộc",
    );
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("does not silently merge multiple existing teaching groups", async () => {
    const { repo, prepare } = setup({
      existing: [
        { courseVersionId: "3", offeringId: "12" },
        { courseVersionId: "3", offeringId: "13" },
      ],
    });
    await expect(repo.openSheet("1", "2", "3", actor)).rejects.toThrow(
      "nhiều lớp",
    );
    expect(prepare).not.toHaveBeenCalled();
  });
  it("denies lecturers before starting a write transaction", async () => {
    const { repo, transaction } = setup();
    await expect(
      repo.openSheet("1", "2", "3", { ...actor, canManage: false }),
    ).rejects.toThrow("cán bộ");
    expect(transaction).not.toHaveBeenCalled();
  });
});
