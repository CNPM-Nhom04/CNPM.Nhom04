import { DataSource } from "typeorm";
import { MysqlGradeRepository } from "./grade.repository";
import { GradeActor } from "../domain/grade";
describe("administrative roster preparation", () => {
  const actor = {
    id: "7",
    username: "officer",
    canManage: true,
    canPrepare: true,
    ip: "127.0.0.1",
  } as GradeActor;
  const input = {
    studentCode: "HV1",
    offeringId: "5",
    note: "Lập danh sách theo hồ sơ",
    reference: "HS1",
  };
  const base = {
    context: { status: "ACTIVE" },
    members: [{ studentId: "1", studentCode: "HV1", studentName: "Một" }],
    offerings: [
      {
        offeringId: "5",
        offeringCode: "IT.1",
        courseCode: "IT",
        capacity: 2,
        enrolled: 1,
      },
    ],
    registrations: [],
  };
  function setup(data: any = base) {
    const query = jest.fn(async (sql: string) =>
      sql.startsWith("SELECT CAST(LAST_INSERT")
        ? [{ id: "21" }]
        : [{ id: "7", allowed: 1 }],
    );
    const manager = { query },
      transaction = jest.fn(async (_isolation, fn) => fn(manager));
    const repository = new MysqlGradeRepository({
      transaction,
    } as unknown as DataSource);
    jest.spyOn(repository, "preparation").mockResolvedValue(data);
    return { repository, query, transaction };
  }
  it("previews without inserting registrations or grades", async () => {
    const { repository, query } = setup();
    expect(
      (await repository.prepareRegistrations("1", "2", [input], actor, false))
        .changed,
    ).toBe(1);
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("inserts only explicit new registrations with audit in one transaction", async () => {
    const { repository, query, transaction } = setup();
    await repository.prepareRegistrations("1", "2", [input], actor, true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(
      query.mock.calls.filter(([sql]) =>
        sql.startsWith("INSERT INTO course_registrations"),
      ),
    ).toHaveLength(1);
    expect(
      query.mock.calls.filter(([sql]) =>
        sql.startsWith("INSERT INTO audit_logs"),
      ),
    ).toHaveLength(1);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO student_course_results"),
      ),
    ).toBe(false);
  });
  it("keeps existing registrations unchanged", async () => {
    const { repository, query } = setup({
      ...base,
      registrations: [
        { studentCode: "HV1", offeringId: "5", status: "REGISTERED" },
      ],
    });
    expect(
      await repository.prepareRegistrations("1", "2", [input], actor, true),
    ).toMatchObject({ changed: 0, unchanged: 1 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it.each([
    { ...base, members: [] },
    { ...base, offerings: [] },
    { ...base, offerings: [{ ...base.offerings[0], capacity: 1 }] },
    {
      ...base,
      registrations: [
        { studentCode: "HV1", offeringId: "5", status: "CANCELLED" },
      ],
    },
    { ...base, context: { status: "INACTIVE" } },
  ])("rejects out-of-scope/invalid context before inserts", async (data) => {
    const { repository, query } = setup(data);
    await expect(
      repository.prepareRegistrations("1", "2", [input], actor, true),
    ).rejects.toThrow();
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("rejects duplicate rows atomically and refuses officers missing registration permission", async () => {
    const { repository, query } = setup();
    await expect(
      repository.prepareRegistrations("1", "2", [input, input], actor, true),
    ).rejects.toThrow("lặp");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
    await expect(
      repository.prepareRegistrations(
        "1",
        "2",
        [input],
        { ...actor, canPrepare: false },
        true,
      ),
    ).rejects.toThrow("REGISTRATION_MANAGE");
  });
});
