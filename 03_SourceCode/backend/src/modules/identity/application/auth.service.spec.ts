import {
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { AuthService } from "./auth.service";
import { PasswordMailer } from "./password-mailer";
import { User } from "../domain/user.entity";
import { AuthSecurityRepository } from "../domain/auth-security.repository";
import { IUserRepository } from "../domain/user.repository.interface";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";

describe("AuthService", () => {
  let service: AuthService, user: User;
  let users, tokens, security, mailer, jwt;
  const password = "CorrectPassword123!";
  const newPassword = "DifferentPassword123!";
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });
  beforeEach(() => {
    user = Object.assign(new User(), {
      id: "1",
      username: "student",
      email: "student@example.invalid",
      fullName: "Test",
      passwordHash,
      accountStatus: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
      deletedAt: null,
      mustChangePassword: false,
    });
    users = {
      findByUsernameOrEmail: jest.fn().mockResolvedValue(user),
      findById: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn().mockResolvedValue(user),
      findRoleCodes: jest.fn().mockResolvedValue(["STUDENT"]),
      save: jest.fn(),
    };
    tokens = {
      findByTokenHash: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    security = {
      policy: jest.fn().mockResolvedValue({
        lockThreshold: 5,
        lockMinutes: 15,
        sessionMinutes: 30,
        resetMinutes: 30,
        passwordMinLength: 10,
      }),
      access: jest.fn().mockResolvedValue({
        roles: ["STUDENT"],
        roleNames: ["Student"],
        permissions: ["PROGRAM_READ_OWN"],
        orgUnitName: "Unit",
      }),
      recordFailure: jest.fn(),
      completeLogin: jest.fn().mockImplementation(async () => user),
      validSession: jest.fn().mockResolvedValue(true),
      revokeSession: jest.fn(),
      changePassword: jest.fn().mockResolvedValue(true),
      createReset: jest.fn().mockResolvedValue(true),
      consumeReset: jest.fn().mockResolvedValue(true),
    };
    mailer = { assertConfigured: jest.fn(), sendReset: jest.fn() };
    jwt = { signAsync: jest.fn().mockResolvedValue("signed-token") };
    service = new AuthService(
      users as IUserRepository,
      tokens as IPasswordResetTokenRepository,
      jwt as JwtService,
      security as AuthSecurityRepository,
      mailer as PasswordMailer,
    );
  });
  it("creates a server session and signs only its identity, with configured expiry", async () => {
    const result = await service.login({ identifier: "  student  ", password });
    expect(users.findByUsernameOrEmail).toHaveBeenCalledWith("student");
    expect(security.completeLogin).toHaveBeenCalledWith(
      user.id,
      passwordHash,
      expect.any(String),
      30,
      undefined,
    );
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: "1", jti: expect.any(String) },
      { expiresIn: 1800 },
    );
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.expiresIn).toBe(1800);
  });
  it.each(["missing", "disabled", "deleted", "locked"])(
    "rejects a %s account",
    async (kind) => {
      if (kind === "missing")
        users.findByUsernameOrEmail.mockResolvedValue(null);
      if (kind === "disabled") user.accountStatus = "DISABLED";
      if (kind === "deleted") user.deletedAt = new Date();
      if (kind === "locked") user.lockedUntil = new Date(Date.now() + 60000);
      await expect(
        service.login({ identifier: user.username, password }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );
  it("records a failed attempt through the atomic repository operation", async () => {
    await expect(
      service.login({ identifier: user.username, password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(security.recordFailure).toHaveBeenCalledWith(
      "1",
      passwordHash,
      expect.objectContaining({ lockThreshold: 5 }),
      undefined,
    );
    expect(users.save).not.toHaveBeenCalled();
  });
  it("rejects a password/account changed while the password check was running", async () => {
    security.completeLogin.mockResolvedValue(null);
    await expect(
      service.login({ identifier: user.username, password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it("reads current permissions and role names for the profile", async () => {
    expect(await service.getProfile("1")).toEqual(
      expect.objectContaining({
        roles: ["STUDENT"],
        permissions: ["PROGRAM_READ_OWN"],
        passwordMinLength: 10,
      }),
    );
  });
  it("rejects confirmation mismatch and wrong old password", async () => {
    await expect(
      service.changePassword("1", user.username, {
        oldPassword: password,
        newPassword,
        confirmPassword: "different",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changePassword("1", user.username, {
        oldPassword: "wrong",
        newPassword,
        confirmPassword: newPassword,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(security.changePassword).not.toHaveBeenCalled();
  });
  it.each([
    "short1",
    "LettersOnlyPassword",
    "123456789012",
    "é".repeat(40) + "Password1",
    "student",
  ])("rejects invalid new password %s", async (next) => {
    await expect(
      service.changePassword("1", user.username, {
        oldPassword: password,
        newPassword: next,
        confirmPassword: next,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("enforces the SQL password minimum and rejects reuse", async () => {
    security.policy.mockResolvedValue({ passwordMinLength: 24 });
    await expect(
      service.changePassword("1", user.username, {
        oldPassword: password,
        newPassword,
        confirmPassword: newPassword,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    security.policy.mockResolvedValue({ passwordMinLength: 10 });
    await expect(
      service.changePassword("1", user.username, {
        oldPassword: password,
        newPassword: password,
        confirmPassword: password,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("hashes a new password and uses atomic password/session replacement", async () => {
    await service.changePassword("1", user.username, {
      oldPassword: password,
      newPassword,
      confirmPassword: newPassword,
    });
    const [id, oldHash, hash] = security.changePassword.mock.calls[0];
    expect(id).toBe("1");
    expect(oldHash).toBe(passwordHash);
    expect(await bcrypt.compare(newPassword, hash)).toBe(true);
    expect(users.save).not.toHaveBeenCalled();
  });
  it("returns the same response for unknown, disabled and active reset accounts", async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    const unknown = await service.forgotPassword({ email: user.email });
    user.accountStatus = "DISABLED";
    const disabled = await service.forgotPassword({ email: user.email });
    user.accountStatus = "ACTIVE";
    const active = await service.forgotPassword({ email: user.email });
    expect(unknown).toEqual(disabled);
    expect(active).toEqual(unknown);
    const [id, hash] = security.createReset.mock.calls[0];
    const rawToken = mailer.sendReset.mock.calls[0][2];
    expect(id).toBe("1");
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(hash).not.toBe(rawToken);
  });
  it("does not send another reset email during repository cooldown", async () => {
    security.createReset.mockResolvedValue(false);
    await service.forgotPassword({ email: user.email });
    expect(mailer.sendReset).not.toHaveBeenCalled();
  });
  it("reports missing SMTP configuration before looking up accounts", async () => {
    mailer.assertConfigured.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(
      service.forgotPassword({ email: user.email }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(users.findByUsernameOrEmail).not.toHaveBeenCalled();
    expect(users.findByEmail).not.toHaveBeenCalled();
  });
  it("keeps SMTP failures neutral without logging reset tokens", async () => {
    const log = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    mailer.sendReset.mockRejectedValue({
      code: "EAUTH",
      message: "sensitive message",
    });
    await expect(
      service.forgotPassword({ email: user.email }),
    ).resolves.toHaveProperty("message");
    expect(log).toHaveBeenCalledWith(
      "Password reset email delivery failed: EAUTH",
    );
    log.mockRestore();
  });
  it.each(["missing", "used", "expired"])(
    "rejects a %s reset token",
    async (kind) => {
      if (kind !== "missing")
        tokens.findByTokenHash.mockResolvedValue({
          userId: "1",
          usedAt: kind === "used" ? new Date() : null,
          expiresAt: new Date(
            Date.now() + (kind === "expired" ? -1000 : 60000),
          ),
        });
      await expect(
        service.resetPassword({
          token: "test-token",
          newPassword,
          confirmPassword: newPassword,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(security.consumeReset).not.toHaveBeenCalled();
    },
  );
  it("consumes the reset token atomically and rejects simultaneous reuse", async () => {
    tokens.findByTokenHash.mockResolvedValue({
      userId: "1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    await service.resetPassword({
      token: "test-token",
      newPassword,
      confirmPassword: newPassword,
    });
    expect(security.consumeReset).toHaveBeenCalledWith(
      createHash("sha256").update("test-token").digest("hex"),
      expect.any(String),
    );
    security.consumeReset.mockResolvedValue(false);
    await expect(
      service.resetPassword({
        token: "test-token",
        newPassword,
        confirmPassword: newPassword,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("revokes the current server-side session on logout", async () => {
    await service.logout("1", "session-id");
    expect(security.revokeSession).toHaveBeenCalledWith("1", "session-id");
  });
});
