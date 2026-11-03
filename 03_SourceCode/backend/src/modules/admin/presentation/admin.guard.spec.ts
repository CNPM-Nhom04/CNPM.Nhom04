import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { AdminGuard } from "./admin.guard";
describe("AdminGuard", () => {
  const query = jest.fn();
  const guard = new AdminGuard({ query } as unknown as DataSource);
  const request = { user: { userId: "1", username: "spoofed", role: "ADMIN" } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  it("rejects a spoofed ADMIN claim when database membership is absent", async () => {
    query.mockResolvedValue([
      {
        username: "student",
        account_status: "ACTIVE",
        deleted_at: null,
        isAdmin: 0,
      },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("rejects missing and disabled accounts", async () => {
    for (const rows of [
      [],
      [{ account_status: "DISABLED", isAdmin: 1 }],
      [{ account_status: "ACTIVE", deleted_at: new Date(), isAdmin: 1 }],
    ]) {
      query.mockResolvedValue(rows);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
  });
  it("requires MASTERDATA_MANAGE for the majors route", async () => {
    const req = {
      user: { userId: "1", username: "admin" },
      path: "/admin/nganh-dao-tao/options",
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    query.mockResolvedValue([
      {
        username: "admin",
        account_status: "ACTIVE",
        deleted_at: null,
        isAdmin: 1,
        hasPermission: 0,
      },
    ]);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(query.mock.calls.at(-1)[1]).toEqual(["MASTERDATA_MANAGE", "1"]);
  });
  it("uses the database username for the audit actor", async () => {
    query.mockResolvedValue([
      {
        username: "actual-admin",
        account_status: "ACTIVE",
        deleted_at: null,
        isAdmin: 1,
        hasPermission: 1,
      },
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user.username).toBe("actual-admin");
  });
});
