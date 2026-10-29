import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ReportsGuard } from "./reports.guard";
describe("ReportsGuard", () => {
  const query = jest.fn();
  const guard = new ReportsGuard({ query } as unknown as DataSource);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: "7", role: "ADMIN" } }),
    }),
  } as ExecutionContext;
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
});
 
