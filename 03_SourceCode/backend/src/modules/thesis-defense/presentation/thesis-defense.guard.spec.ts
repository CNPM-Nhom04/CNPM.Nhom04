import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { ThesisDefenseGuard } from "./thesis-defense.guard";
describe("ThesisDefenseGuard", () => {
  const query = jest.fn();
  const guard = new ThesisDefenseGuard({ query } as unknown as DataSource);
  const request = {
    user: { userId: "1", role: "ADMIN" },
    ip: "127.0.0.1",
    defenseActor: null,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  it("ignores spoofed JWT admin claims", async () => {
    query.mockResolvedValue([
      { username: "student", account_status: "ACTIVE", roleCodes: "STUDENT" },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("rejects disabled accounts", async () => {
    query.mockResolvedValue([
      { username: "staff", account_status: "DISABLED", roleCodes: "ADMIN" },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("allows approvers to read/record while excluding scheduling", async () => {
    query.mockResolvedValue([
      { username: "approver", account_status: "ACTIVE", roleCodes: "APPROVER" },
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.defenseActor).toEqual(
      expect.objectContaining({
        canSchedule: false,
        canRecord: true,
        isAdmin: false,
      }),
    );
  });
});
