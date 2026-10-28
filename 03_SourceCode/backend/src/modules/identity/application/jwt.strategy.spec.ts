import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { IUserRepository } from "../domain/user.repository.interface";
import { AuthSecurityRepository } from "../domain/auth-security.repository";
describe("JwtStrategy", () => {
  const users = { findById: jest.fn(), findRoleCodes: jest.fn() };
  const security = { validSession: jest.fn() };
  const payload = { sub: "7", jti: "00000000-0000-4000-8000-000000000001" };
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: "test-only-secret" }),
    users as unknown as IUserRepository,
    security as unknown as AuthSecurityRepository,
  );
  beforeEach(() => {
    users.findById.mockResolvedValue({
      id: "7",
      username: "custom",
      accountStatus: "ACTIVE",
    });
    users.findRoleCodes.mockResolvedValue(["ADMIN"]);
    security.validSession.mockResolvedValue(true);
  });
  it.each([
    {},
    { sub: "7" },
    { sub: "0", jti: payload.jti },
    { sub: "7", jti: "invalid" },
  ])("rejects malformed/legacy identity %j", async (value) => {
    await expect(strategy.validate(value)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("rejects disabled/deleted users and revoked/expired sessions", async () => {
    for (const user of [
      null,
      { id: "7", accountStatus: "DISABLED" },
      { id: "7", accountStatus: "ACTIVE", deletedAt: new Date() },
    ]) {
      users.findById.mockResolvedValue(user);
      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    users.findById.mockResolvedValue({ id: "7", accountStatus: "ACTIVE" });
    security.validSession.mockResolvedValue(false);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it("gets current roles from SQL instead of trusting JWT role claims", async () => {
    expect(await strategy.validate(payload)).toEqual(
      expect.objectContaining({ role: "ADMIN", sessionId: payload.jti }),
    );
    users.findRoleCodes.mockResolvedValue(["LECTURER"]);
    expect(await strategy.validate(payload)).toEqual(
      expect.objectContaining({ role: "LECTURER" }),
    );
  });
});
