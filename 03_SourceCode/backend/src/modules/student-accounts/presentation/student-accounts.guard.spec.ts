import { ExecutionContext } from "@nestjs/common";
import { DataSource } from "typeorm";
import { StudentAccountsGuard } from "./student-accounts.guard";
const ctx = {
  switchToHttp: () => ({ getRequest: () => ({ user: { userId: "12" } }) }),
} as ExecutionContext;
describe("Bulk account authority", () => {
  it("requires an active Admin and all three explicit permissions", async () => {
    for (const patch of [{ isAdmin: "0" }, { permissionCount: "2" }]) {
      const db = {
        query: jest
          .fn()
          .mockResolvedValue([
            {
              account_status: "ACTIVE",
              deleted_at: null,
              isAdmin: "1",
              permissionCount: "3",
              ...patch,
            },
          ]),
      };
      await expect(
        new StudentAccountsGuard(db as unknown as DataSource).canActivate(ctx),
      ).rejects.toThrow("STUDENT_ACCOUNT_IMPORT");
    }
  });
  it("permits only the complete SQL authorization and blocks a disabled account", async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { account_status: "ACTIVE", isAdmin: 1, permissionCount: 3 },
      ]);
    expect(
      await new StudentAccountsGuard({
        query,
      } as unknown as DataSource).canActivate(ctx),
    ).toBe(true);
    query.mockResolvedValue([
      { account_status: "DISABLED", isAdmin: 1, permissionCount: 3 },
    ]);
    await expect(
      new StudentAccountsGuard({ query } as unknown as DataSource).canActivate(
        ctx,
      ),
    ).rejects.toThrow("không còn hoạt động");
  });
});
