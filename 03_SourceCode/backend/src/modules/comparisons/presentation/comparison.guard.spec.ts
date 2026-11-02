import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { ComparisonGuard } from "./comparison.guard";
describe("ComparisonGuard export boundary", () => {
  const query = jest.fn(),
    get = jest.fn();
  const guard = new ComparisonGuard(
    { query } as unknown as DataSource,
    { get } as unknown as Reflector,
  );
  const context = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: "7" } }) }),
  } as unknown as ExecutionContext;
  beforeEach(() => {
    query.mockReset();
    get.mockReset();
  });
  it("rejects an inactive account", async () => {
    query.mockResolvedValue([{ account_status: "DISABLED", allowed: 1 }]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("rejects export-only access without compare permission", async () => {
    query.mockResolvedValue([{ account_status: "ACTIVE", allowed: 0 }]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("allows comparison without export", async () => {
    query.mockResolvedValue([{ account_status: "ACTIVE", allowed: 1 }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("rejects exporting when the export grant is missing", async () => {
    get.mockReturnValue(true);
    query
      .mockResolvedValueOnce([{ account_status: "ACTIVE", allowed: 1 }])
      .mockResolvedValueOnce([]);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("allows exporting with both live grants", async () => {
    get.mockReturnValue(true);
    query
      .mockResolvedValueOnce([{ account_status: "ACTIVE", allowed: 1 }])
      .mockResolvedValueOnce([{ granted: 1 }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
