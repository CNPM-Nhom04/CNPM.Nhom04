import { DataSource } from "typeorm";
import {
  OfferingExcelRepository,
  OfferingInput,
} from "./offering-excel.repository";
import { GradeActor } from "../domain/grade";

describe("Administrative offering setup and completion", () => {
  const actor = {
    id: "1",
    username: "officer",
    ip: "",
    canManage: true,
    canPrepare: true,
  } as GradeActor;
  const input: OfferingInput = {
    code: "COS707.01",
    courseVersionId: "7",
    termId: "2",
    capacity: 30,
    status: "COMPLETED",
    reason: "Xác nhận hoàn tất giảng dạy",
    reference: "HS-001",
  };
  let query: jest.Mock,
    repo: OfferingExcelRepository,
    old: any,
    allowed: boolean,
    enrolled: number;
  beforeEach(() => {
    allowed = true;
    enrolled = 3;
    old = {
      id: "9",
      course_version_id: "7",
      termId: "2",
      class_code: "COS707.01",
      registration_period_id: "4",
      status: "OPEN",
      periodStatus: "CLOSED",
    };
    query = jest.fn(async (sql: string) => {
      if (sql.startsWith("SELECT u.id")) return allowed ? [{ id: "1" }] : [];
      if (sql.startsWith("SELECT cv.id"))
        return [
          {
            id: "7",
            versionStatus: "ACTIVE",
            courseStatus: "ACTIVE",
            effective: 1,
          },
        ];
      if (sql.startsWith("SELECT id,start_date"))
        return [{ id: "2", status: "ACTIVE" }];
      if (sql.startsWith("SELECT co.*")) return [old];
      if (sql.startsWith("SELECT COUNT(*)")) return [{ n: enrolled }];
      return { affectedRows: 1 };
    });
    repo = new OfferingExcelRepository({
      query,
      transaction: async (_level, fn) => fn({ query }),
    } as unknown as DataSource);
  });
  it("marks the same scoped offering complete and records the evidence", async () => {
    await repo.save(input, "9", actor);
    expect(query).toHaveBeenCalledWith(
      "UPDATE course_offerings SET capacity=?,status=? WHERE id=?",
      [30, "COMPLETED", "9"],
    );
    const audit = query.mock.calls.find(([sql]) =>
      sql.startsWith("INSERT INTO audit_logs"),
    );
    expect(audit?.[1]).toContain("Xác nhận hoàn tất giảng dạy · HS-001");
    expect(
      query.mock.calls.find(([sql]) => sql.startsWith("SELECT co.*"))?.[0],
    ).toContain("vw_user_course_access");
  });
  it("rejects accounts without the training-officer permission combination", async () => {
    allowed = false;
    await expect(repo.save(input, "9", actor)).rejects.toThrow("Cần quyền");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(
      false,
    );
  });
  it.each([
    { patch: { courseVersionId: "8" }, message: "Không đổi mã" },
    { patch: { capacity: 2 }, message: "Sĩ số" },
    { patch: { status: "CANCELLED" }, message: "còn học viên" },
  ])("rejects invalid changes $patch", async ({ patch, message }) => {
    await expect(repo.save({ ...input, ...patch }, "9", actor)).rejects.toThrow(
      message,
    );
    expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(
      false,
    );
  });
  it("does not reopen a completed class", async () => {
    old.status = "COMPLETED";
    await expect(
      repo.save({ ...input, status: "OPEN" }, "9", actor),
    ).rejects.toThrow("không mở lại");
  });
  it.each([
    { capacity: 0 },
    { capacity: 1.5 },
    { reason: "ngắn" },
    { reference: "" },
  ])("rejects invalid spreadsheet values %j", (patch) => {
    expect(() => repo.validate({ ...input, ...patch })).toThrow();
  });
});
