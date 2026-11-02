import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { ReportsGuard } from "./reports.guard";
describe("ReportsGuard", () => {
  const query = jest.fn();
  const get = jest.fn();
  const guard = new ReportsGuard(
    { query } as unknown as DataSource,
    { get } as unknown as Reflector,
  );
  beforeEach(() => {
    query.mockReset();
    get.mockReset();
  });
  const context = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: "7", role: "ADMIN" } }),
    }),
  } as unknown as ExecutionContext;
  it("does not grant reports based only on a role claim", async () => {
    query.mockResolvedValue([]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("allows a live PROGRAM_READ grant", async () => {
    query.mockResolvedValue([{ granted: 1 }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.any(String), ["7"]);
  });
  it("requires PROGRAM_EXPORT for download even when PROGRAM_READ is granted", async () => {
    get.mockReturnValue(true);
    query.mockResolvedValueOnce([{ granted: 1 }]).mockResolvedValueOnce([]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("permits export only with both live grants", async () => {
    get.mockReturnValue(true);
    query.mockResolvedValue([{ granted: 1 }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
