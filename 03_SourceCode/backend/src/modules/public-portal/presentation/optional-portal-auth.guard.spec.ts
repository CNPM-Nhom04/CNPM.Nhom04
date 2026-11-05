import { ExecutionContext } from "@nestjs/common";
import { OptionalPortalAuthGuard } from "./optional-portal-auth.guard";
describe("Optional portal authentication", () => {
  it("permits a guest only when the Authorization header is absent", () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;
    expect(new OptionalPortalAuthGuard().canActivate(context)).toBe(true);
  });
});
