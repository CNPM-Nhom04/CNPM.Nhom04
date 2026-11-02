import { ExecutionContext } from "@nestjs/common";
import { DataSource } from "typeorm";
import { StudentProgramGuard } from "./student-program.guard";
const context = (userId?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { userId } : undefined }),
    }),
  }) as ExecutionContext;
describe("Own curriculum authorization", () => {
  const active = {
    account_status: "ACTIVE",
    deleted_at: null,
    isStudent: "1",
    canRead: "1",
  };
  it("requires an authenticated subject", async () => {
    const db = { query: jest.fn() };
    await expect(
      new StudentProgramGuard(db as unknown as DataSource).canActivate(
        context(),
      ),
    ).rejects.toThrow("đăng nhập");
    expect(db.query).not.toHaveBeenCalled();
  });
  it("requires STUDENT and PROGRAM_READ_OWN; no admin/global-scope bypass", async () => {
    for (const patch of [{ isStudent: "0" }, { canRead: "0" }]) {
      const db = {
        query: jest.fn().mockResolvedValue([{ ...active, ...patch }]),
      };
      await expect(
        new StudentProgramGuard(db as unknown as DataSource).canActivate(
          context("17"),
        ),
      ).rejects.toThrow("PROGRAM_READ_OWN");
    }
  });
  it("blocks inactive or deleted accounts", async () => {
    for (const row of [
      undefined,
      { ...active, account_status: "DISABLED" },
      { ...active, deleted_at: "2026-01-01" },
    ]) {
      const db = { query: jest.fn().mockResolvedValue(row ? [row] : []) };
      await expect(
        new StudentProgramGuard(db as unknown as DataSource).canActivate(
          context("17"),
        ),
      ).rejects.toThrow("không còn hoạt động");
    }
  });
  it("uses the JWT subject for the SQL permission lookup", async () => {
    const db = { query: jest.fn().mockResolvedValue([active]) };
    expect(
      await new StudentProgramGuard(db as unknown as DataSource).canActivate(
        context("17"),
      ),
    ).toBe(true);
    expect(db.query.mock.calls[0][1]).toEqual(["17"]);
  });
});
