import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { AuthService } from "./auth.service";
import { User } from "../domain/user.entity";
import { PasswordResetToken } from "../domain/password-reset-token.entity";
import { IUserRepository } from "../domain/user.repository.interface";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";

describe("AuthService", () => {
  let service: AuthService;
  let users: jest.Mocked<IUserRepository>;
  let tokens: jest.Mocked<IPasswordResetTokenRepository>;
  let jwt: JwtService;
  let user: User;
  let passwordHash: string;
  const password = "CorrectPassword123!";

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  beforeEach(() => {
    user = Object.assign(new User(), {
      id: "1",
      username: "student",
      email: "student@example.com",
      fullName: "Test Student",
      organizationalUnitId: "2",
      passwordHash,
      accountStatus: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      mustChangePassword: true,
    });
    users = {
      findRoleCodes: jest.fn().mockResolvedValue(["STUDENT"]),
      findById: jest.fn().mockResolvedValue(user),
      findByUsernameOrEmail: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockImplementation(async (value: User) => value),
    };
    tokens = {
      findByTokenHash: jest.fn().mockResolvedValue(null),
      save: jest
        .fn()
        .mockImplementation(async (value: Partial<PasswordResetToken>) =>
          Object.assign(new PasswordResetToken(), value),
        ),
    };
    jwt = new JwtService();
    jest.spyOn(jwt, "signAsync").mockResolvedValue("signed-token");
    service = new AuthService(users, tokens, jwt);
  });

  it("issues a token and clears previous login failures after a valid login", async () => {
    user.failedLoginCount = 3;
    user.lockedUntil = new Date(Date.now() - 1000);

    const result = await service.login({ identifier: user.email, password });

    expect(result.access_token).toBe("signed-token");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(users.save).toHaveBeenCalledWith(user);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        role: "STUDENT",
      }),
    );
  });

  it("rejects an unknown account without issuing a token", async () => {
    users.findByUsernameOrEmail.mockResolvedValue(null);

    await expect(
      service.login({ identifier: "missing", password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it("rejects an inactive account even when the password is correct", async () => {
    user.accountStatus = "INACTIVE";

    await expect(
      service.login({ identifier: user.username, password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("rejects a temporarily locked account", async () => {
    user.lockedUntil = new Date(Date.now() + 15 * 60_000);

    await expect(
      service.login({ identifier: user.username, password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.save).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("records an incorrect password without locking the first attempt", async () => {
    await expect(
      service.login({ identifier: user.username, password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginCount).toBe(1);
    expect(user.lockedUntil).toBeNull();
    expect(users.save).toHaveBeenCalledWith(user);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("locks the account for fifteen minutes after the fifth incorrect password", async () => {
    user.failedLoginCount = 4;
    const startedAt = Date.now();

    await expect(
      service.login({ identifier: user.username, password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(user.failedLoginCount).toBe(5);
    expect(user.lockedUntil.getTime()).toBeGreaterThanOrEqual(
      startedAt + 15 * 60_000,
    );
    expect(user.lockedUntil.getTime()).toBeLessThanOrEqual(
      Date.now() + 15 * 60_000,
    );
    expect(users.save).toHaveBeenCalledWith(user);
  });

  it("rejects a profile request for a deleted account", async () => {
    users.findById.mockResolvedValue(null);

    await expect(service.getProfile("missing")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a password change when the current password is incorrect", async () => {
    await expect(
      service.changePassword(user.id, user.username, {
        oldPassword: "wrong",
        newPassword: "NewPassword123!",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it("rejects a new password equal to the username", async () => {
    await expect(
      service.changePassword(user.id, user.username, {
        oldPassword: password,
        newPassword: user.username,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it("hashes the new password and clears the mandatory password change flag", async () => {
    const newPassword = "NewPassword123!";

    await service.changePassword(user.id, user.username, {
      oldPassword: password,
      newPassword,
    });

    expect(await bcrypt.compare(newPassword, user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toBe(newPassword);
    expect(user.mustChangePassword).toBe(false);
    expect(user.passwordChangedAt).toBeInstanceOf(Date);
    expect(users.save).toHaveBeenCalledWith(user);
  });

  it("returns a neutral response for an unknown password reset email", async () => {
    users.findByUsernameOrEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({
      email: "missing@example.com",
    });

    expect(result).toEqual({ message: expect.any(String) });
    expect(tokens.save).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it.each(["missing", "expired", "used"])(
    "rejects a %s password reset token",
    async (state) => {
      if (state !== "missing") {
        tokens.findByTokenHash.mockResolvedValue(
          Object.assign(new PasswordResetToken(), {
            userId: user.id,
            expiresAt: new Date(
              Date.now() + (state === "expired" ? -60_000 : 60_000),
            ),
            usedAt: state === "used" ? new Date() : null,
          }),
        );
      }

      await expect(
        service.resetPassword({
          token: "raw-token",
          newPassword: "NewPassword123!",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.save).not.toHaveBeenCalled();
      expect(tokens.save).not.toHaveBeenCalled();
    },
  );

  it("consumes a valid reset token and clears the account lock", async () => {
    const rawToken = "raw-token";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const token = Object.assign(new PasswordResetToken(), {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60_000),
      usedAt: null,
    });
    tokens.findByTokenHash.mockResolvedValue(token);
    user.failedLoginCount = 5;
    user.lockedUntil = new Date(Date.now() + 60_000);
    const newPassword = "ResetPassword123!";

    await service.resetPassword({ token: rawToken, newPassword });

    expect(tokens.findByTokenHash).toHaveBeenCalledWith(tokenHash);
    expect(await bcrypt.compare(newPassword, user.passwordHash)).toBe(true);
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.mustChangePassword).toBe(false);
    expect(token.usedAt).toBeInstanceOf(Date);
    expect(tokens.save).toHaveBeenCalledWith(token);
  });
});
