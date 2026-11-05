import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { ExecutionContext } from "@nestjs/common";
import { GradeGuard } from "./grade.guard";
describe("grade role boundary", () => {
  function setup(roles: string, permissions: string, write = false) {
    const db = {
      query: jest
        .fn()
        .mockResolvedValue([
          {
            username: "test",
            account_status: "ACTIVE",
            deleted_at: null,
            roleCodes: roles,
            permissionCodes: permissions,
          },
        ]),
    };
    const reflector = {
      get: jest.fn().mockReturnValue(write ? "GRADE_MANAGE" : undefined),
    };
    const request: any = { user: { userId: "7" }, ip: "127.0.0.1" };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => {},
    } as unknown as ExecutionContext;
    return {
      guard: new GradeGuard(
        db as unknown as DataSource,
        reflector as unknown as Reflector,
      ),
      request,
      context,
    };
  }
  it("allows lecturers to view with read permission", async () => {
    const { guard, request, context } = setup("LECTURER", "GRADE_READ");
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.gradeActor.canManage).toBe(false);
  });
  it("rejects writes by lecturers even if a point-edit permission was accidentally assigned", async () => {
    const { guard, context } = setup(
      "LECTURER",
      "GRADE_READ,GRADE_MANAGE",
      true,
    );
    await expect(guard.canActivate(context)).rejects.toThrow();
  });
  it("requires both the officer role and edit permission", async () => {
    const { guard, context } = setup("TRAINING_OFFICER", "GRADE_READ", true);
    await expect(guard.canActivate(context)).rejects.toThrow();
  });
  it("allows an authorized training officer", async () => {
    const { guard, request, context } = setup(
      "TRAINING_OFFICER",
      "GRADE_READ,GRADE_MANAGE",
      true,
    );
    expect(await guard.canActivate(context)).toBe(true);
    expect(request.gradeActor.canManage).toBe(true);
  });
  it("does not bypass policy for an admin", async () => {
    const { guard, context } = setup("ADMIN", "GRADE_READ,GRADE_MANAGE", true);
    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});
