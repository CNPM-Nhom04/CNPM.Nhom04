import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { User } from "../domain/user.entity";
import { PasswordResetToken } from "../domain/password-reset-token.entity";
import { IUserRepository } from "../domain/user.repository.interface";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let users: jest.Mocked<IUserRepository>;
  let tokens: jest.Mocked<IPasswordResetTokenRepository>;
  let service: AuthService;
  let signToken: jest.SpyInstance;
  let user: User;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("Correct-password1!", 4);
  });

  beforeEach(() => {
    users = {
      findByUsernameOrEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation(async (value: User) => value),
    };
    tokens = {
      findByTokenHash: jest.fn(),
      save: jest.fn(),
    };
    const jwt = new JwtService();
    signToken = jest.spyOn(jwt, "signAsync").mockResolvedValue("signed-token");
    service = new AuthService(users, tokens, jwt);
    user = Object.assign(new User(), {
      id: "1",
      username: "student01",
      email: "student@example.test",
      fullName: "Test Student",
      accountStatus: "ACTIVE",
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: false,
    });
    users.findByUsernameOrEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
  });

  it("rejects an unknown account without issuing a token", async () => {
    users.findByUsernameOrEmail.mockResolvedValue(null);

    await expect(
      service.login({ identifier: "unknown", password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(users.save).not.toHaveBeenCalled();
    expect(signToken).not.toHaveBeenCalled();
  });

  it("rejects an inactive account even with the correct password", async () => {
    user.accountStatus = "INACTIVE";

    await expect(
      service.login({ identifier: user.username, password: "Correct-password1!" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(signToken).not.toHaveBeenCalled();
  });

  it("rejects a temporarily locked account", async () => {
    user.lockedUntil = new Date(Date.now() + 60_000);

    await expect(
      service.login({ identifier: user.username, password: "Correct-password1!" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(users.save).not.toHaveBeenCalled();
    expect(signToken).not.toHaveBeenCalled();
  });

  it("locks the account for 15 minutes after the fifth wrong password", async () => {
    user.failedLoginCount = 4;
    const before = Date.now();

    await expect(
      service.login({ identifier: user.username, password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginCount).toBe(5);
    expect(user.lockedUntil.getTime()).toBeGreaterThanOrEqual(before + 15 * 60_000);
    expect(user.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(signToken).not.toHaveBeenCalled();
  });

  it("clears failed attempts and returns a token on successful login", async () => {
    user.failedLoginCount = 3;
    user.lockedUntil = new Date(Date.now() - 60_000);

    const result = await service.login({
      identifier: user.username,
      password: "Correct-password1!",
    });

    expect(result.access_token).toBe("signed-token");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(signToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.id, username: user.username }),
    );
  });

  it("rejects password changes when the old password is wrong", async () => {
    await expect(
      service.changePassword(user.id, user.username, {
        oldPassword: "wrong",
        newPassword: "New-password1!",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(user.passwordHash).toBe(passwordHash);
    expect(users.save).not.toHaveBeenCalled();
  });

  it("returns a neutral response for unknown password recovery accounts", async () => {
    users.findByUsernameOrEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: "missing@example.test" });

    expect(result.message).toContain("Nếu email tồn tại");
    expect(tokens.save).not.toHaveBeenCalled();
  });

  it.each(["missing", "used", "expired"])(
    "rejects a %s password reset token without changing the password",
    async (state) => {
      const record = Object.assign(new PasswordResetToken(), {
        userId: user.id,
        usedAt: state === "used" ? new Date() : null,
        expiresAt: new Date(Date.now() + (state === "expired" ? -60_000 : 60_000)),
      });
      tokens.findByTokenHash.mockResolvedValue(state === "missing" ? null : record);

      await expect(
        service.resetPassword({ token: "raw-token", newPassword: "New-password1!" }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tokens.findByTokenHash).toHaveBeenCalledWith(
        crypto.createHash("sha256").update("raw-token").digest("hex"),
      );
      expect(users.save).not.toHaveBeenCalled();
      expect(tokens.save).not.toHaveBeenCalled();
    },
  );
});
