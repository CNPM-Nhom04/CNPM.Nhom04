import { ExecutionContext } from "@nestjs/common";
import { SubscriptionRateGuard } from "./subscription-rate.guard";
const context = (ip: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as ExecutionContext;
describe("Public subscription throttling", () => {
  it("limits repeats per connection address and recovers after the window", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    try {
      const guard = new SubscriptionRateGuard();
      for (let i = 0; i < 30; i++)
        expect(guard.canActivate(context("127.0.0.1"))).toBe(true);
      expect(() => guard.canActivate(context("127.0.0.1"))).toThrow();
      expect(guard.canActivate(context("127.0.0.2"))).toBe(true);
      now.mockReturnValue(62000);
      expect(guard.canActivate(context("127.0.0.1"))).toBe(true);
    } finally {
      now.mockRestore();
    }
  });
});
