import { DataSource } from "typeorm";
import { MysqlGradeRepository } from "./grade.repository";
import { GradeActor } from "../domain/grade";
describe("atomic differential grade import", () => {
  const actor = { id: "7", canManage: true } as GradeActor;
  const base = {
    registrationId: "11",
    studentId: "31",
    studentCode: "HV1",
    courseCode: "IT1",
    offeringId: "5",
    offeringCode: "LOP",
    classStatus: "OPEN",
    registrationStatus: "REGISTERED",
    state: "DRAFT",
    resultId: "21",
    revision: 2,
    policyId: "9",
    policyRevision: 1,
    attendanceScore: 5,
    midtermScore: 5,
    examScore: 5,
  };
  const policy = {
    attendanceWeight: 20,
    midtermWeight: 30,
    examWeight: 50,
    decimalPlaces: 2,
    rounding: "HALF_UP",
    passingScore: 5,
  };
  const input = (original: any, patch: any) => ({
    registrationId: original.registrationId,
    original,
    values: {
      attendanceScore: original.attendanceScore,
      midtermScore: original.midtermScore,
      examScore: original.examScore,
      ...patch,
    },
    note: "Điều chỉnh theo hồ sơ",
    reference: "HS1",
  });
  function setup(current: any[] = [base]) {
    const manager = { query: jest.fn().mockResolvedValue([{ id: "7" }]) };
    const transaction = jest.fn(async (_isolation, fn) => fn(manager));
    const repository = new MysqlGradeRepository({
      transaction,
    } as unknown as DataSource);
    jest.spyOn(repository, "excelRows").mockResolvedValue(current);
    jest.spyOn(repository as any, "getPolicy").mockResolvedValue(policy);
    const update = jest.spyOn(repository, "update").mockResolvedValue({}),
      create = jest.spyOn(repository, "create").mockResolvedValue({});
    return { repository, update, create, transaction, manager };
  }
  it("does not write or increment revisions for unchanged rows", async () => {
    const { repository, update, create } = setup();
    const result = await repository.importRows(
      "1",
      "2",
      [input(base, {})],
      actor,
      true,
    );
    expect(result.changed).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("updates only changed cells and retains a concurrent change in another cell", async () => {
    const { repository, update, transaction, manager } = setup([
      { ...base, midtermScore: 9, revision: 3 },
    ]);
    const result = await repository.importRows(
      "1",
      "2",
      [input(base, { examScore: 8 })],
      actor,
      true,
    );
    expect(result.changes[0].fields).toEqual([
      { key: "examScore", before: 5, after: 8 },
    ]);
    expect(update).toHaveBeenCalledWith(
      "21",
      expect.objectContaining({
        attendanceScore: 5,
        midtermScore: 9,
        examScore: 8,
        revision: 3,
      }),
      actor,
      manager,
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
  it("previews without writing", async () => {
    const { repository, update } = setup();
    expect(
      (
        await repository.importRows(
          "1",
          "2",
          [input(base, { examScore: 8 })],
          actor,
          false,
        )
      ).changed,
    ).toBe(1);
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects overlapping concurrent edits", async () => {
    const { repository, update } = setup([{ ...base, examScore: 9 }]);
    await expect(
      repository.importRows(
        "1",
        "2",
        [input(base, { examScore: 8 })],
        actor,
        true,
      ),
    ).rejects.toThrow("cùng ô");
    expect(update).not.toHaveBeenCalled();
  });
  it("validates the entire workbook before any row is written", async () => {
    const other = {
      ...base,
      registrationId: "12",
      studentId: "32",
      resultId: "22",
    };
    const { repository, update } = setup([base, { ...other, examScore: 9 }]);
    await expect(
      repository.importRows(
        "1",
        "2",
        [input(base, { examScore: 8 }), input(other, { examScore: 7 })],
        actor,
        true,
      ),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("distinguishes clearing a score from entering zero", async () => {
    const { repository } = setup();
    const r = await repository.importRows(
      "1",
      "2",
      [input(base, { attendanceScore: 0, examScore: null })],
      actor,
      false,
    );
    expect(r.changes[0].fields).toEqual([
      { key: "attendanceScore", before: 5, after: 0 },
      { key: "examScore", before: 5, after: null },
    ]);
  });
  it.each([
    { canManage: false },
    { state: "VOIDED" },
    { state: "FINALIZED", classStatus: "OPEN" },
    { registrationStatus: "CANCELLED" },
    { policyRevision: 2 },
  ])("rejects invalid role/state/context %j", async (patch) => {
    const { repository, update } = setup([{ ...base, ...patch }]);
    await expect(
      repository.importRows(
        "1",
        "2",
        [input(base, { examScore: 8 })],
        {
          ...actor,
          ...("canManage" in patch ? { canManage: patch.canManage } : {}),
        },
        true,
      ),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
