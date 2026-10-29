import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
describe("Mandatory password change", () => {
  const guard = new JwtAuthGuard();
  const context = (path: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ path }) }),
    }) as ExecutionContext;
  it("blocks business APIs until the initial password is changed", () => {
    expect(() =>
      guard.handleRequest(
        null,
        { mustChangePassword: true },
        null,
        context("/admin/nguoi-dung"),
      ),
    ).toThrow(ForbiddenException);
  });
  it.each(["/auth/profile", "/auth/change-password", "/auth/logout"])(
    "allows %s while changing the password",
    (path) => {
      const user = { mustChangePassword: true };
      expect(guard.handleRequest(null, user, null, context(path))).toBe(user);
    },
  );
});
 
