import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { ProgramGuard } from "./program.guard";
describe("ProgramGuard", () => {
  const query = jest.fn(),
    get = jest.fn();
  const guard = new ProgramGuard(
    { query } as unknown as DataSource,
    { get } as unknown as Reflector,
  );
  const request = {
    user: { userId: "1", role: "ADMIN" },
    programActor: null,
    ip: "127.0.0.1",
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
  it("does not grant editing based on JWT role", async () => {
    get.mockReturnValue("PROGRAM_EDIT");
    query.mockResolvedValue([
      {
        username: "admin",
        account_status: "ACTIVE",
        permissionCodes: "PROGRAM_READ",
      },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("rejects revoked accounts", async () => {
    query.mockResolvedValue([
      {
        username: "officer",
        account_status: "DISABLED",
        permissionCodes: "PROGRAM_EDIT",
      },
    ]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("accepts the required current database permission", async () => {
    get.mockReturnValue("PROGRAM_APPROVE");
    query.mockResolvedValue([
      {
        username: "reviewer",
        account_status: "ACTIVE",
        permissionCodes: "PROGRAM_READ,PROGRAM_APPROVE",
      },
    ]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.programActor).toEqual(
      expect.objectContaining({
        username: "reviewer",
        permissions: ["PROGRAM_READ", "PROGRAM_APPROVE"],
      }),
    );
  });
});
