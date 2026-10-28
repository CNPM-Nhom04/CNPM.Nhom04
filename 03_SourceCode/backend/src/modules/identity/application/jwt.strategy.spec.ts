import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { IUserRepository } from "../domain/user.repository.interface";

describe("JwtStrategy live account checks", () => {
  const users = { findById: jest.fn(), findRoleCodes: jest.fn() };
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: "test-only-secret" }),
    users as unknown as IUserRepository,
  );
  it("denies a token after its user is removed or disabled", async () => {
    for (const user of [null, { id: "1", accountStatus: "DISABLED" }]) {
      users.findById.mockResolvedValue(user);
      await expect(strategy.validate({ sub: "1" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
  });
  it("reads current assigned roles rather than inferring from the username", async () => {
    users.findById.mockResolvedValue({
      id: "7",
      username: "custom-account",
      accountStatus: "ACTIVE",
    });
    users.findRoleCodes.mockResolvedValue(["ADMIN"]);
    expect(await strategy.validate({ sub: "7" })).toEqual(
      expect.objectContaining({ role: "ADMIN", username: "custom-account" }),
    );
    users.findRoleCodes.mockResolvedValue(["LECTURER"]);
    expect(await strategy.validate({ sub: "7" })).toEqual(
      expect.objectContaining({ role: "LECTURER" }),
    );
  });
});
