import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./login.dto";
import { ChangePasswordDto } from "./change-password.dto";
import { ForgotPasswordDto } from "./forgot-password.dto";
import { ResetPasswordDto } from "./reset-password.dto";
import { IUserRepository } from "../domain/user.repository.interface";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";
import { AuthSecurityRepository } from "../domain/auth-security.repository";
import { PasswordMailer } from "./password-mailer";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

const dummyHash = bcrypt.hashSync("Unknown-account-placeholder-123", 12);
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @Inject("IUserRepository") private readonly users: IUserRepository,
    @Inject("IPasswordResetTokenRepository")
    private readonly tokens: IPasswordResetTokenRepository,
    private readonly jwt: JwtService,
    private readonly security: AuthSecurityRepository,
    private readonly mailer: PasswordMailer,
  ) {}
  private role(roles: string[]) {
    return (
      ["ADMIN", "TRAINING_OFFICER", "APPROVER", "LECTURER", "STUDENT"].find(
        (r) => roles.includes(r),
      ) || "UNASSIGNED"
    );
  }
  async login(dto: LoginDto, ip?: string) {
    const policy = await this.security.policy();
    const user = await this.users.findByUsernameOrEmail(dto.identifier.trim());
    if (!user) {
      await bcrypt.compare(dto.password, dummyHash);
      throw new UnauthorizedException(
        "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đang bị khóa.",
      );
    }
    if (
      user.accountStatus !== "ACTIVE" ||
      user.deletedAt ||
      (user.lockedUntil && user.lockedUntil > new Date())
    ) {
      throw new UnauthorizedException(
        "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đang bị khóa.",
      );
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.security.recordFailure(user.id, user.passwordHash, policy, ip);
      throw new UnauthorizedException(
        "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đang bị khóa.",
      );
    }
    const sessionId = crypto.randomUUID();
    const fresh = await this.security.completeLogin(
      user.id,
      user.passwordHash,
      sessionId,
      policy.sessionMinutes,
      ip,
    );
    if (!fresh)
      throw new UnauthorizedException(
        "Tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
      );
    const roles = await this.users.findRoleCodes(user.id);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, jti: sessionId },
      { expiresIn: policy.sessionMinutes * 60 },
    );
    return {
      access_token: accessToken,
      expiresIn: policy.sessionMinutes * 60,
      user: {
        id: user.id,
        username: fresh.username,
        fullName: fresh.fullName,
        email: fresh.email,
        role: this.role(roles),
        mustChangePassword: fresh.mustChangePassword,
      },
    };
  }
  async passwordPolicy() {
    const { passwordMinLength } = await this.security.policy();
    return { passwordMinLength };
  }
  async getProfile(id: string) {
    const user = await this.users.findById(id);
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const [access, policy] = await Promise.all([
      this.security.access(id),
      this.security.policy(),
    ]);
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: this.role(access.roles),
      ...access,
      orgUnitId: user.organizationalUnitId,
      accountStatus: user.accountStatus,
      mustChangePassword: user.mustChangePassword,
      passwordMinLength: policy.passwordMinLength,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
    };
  }
  private async validatePassword(
    password: string,
    confirmation: string,
    username: string,
  ) {
    const { passwordMinLength } = await this.security.policy();
    if (
      typeof password !== "string" ||
      Array.from(password).length < passwordMinLength ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new BadRequestException(
        `Mật khẩu cần ít nhất ${passwordMinLength} ký tự, có chữ và số, tối đa 72 byte UTF-8.`,
      );
    }
    if (password !== confirmation)
      throw new BadRequestException("Xác nhận mật khẩu không khớp.");
    if (password === username)
      throw new BadRequestException("Mật khẩu không được trùng tên đăng nhập.");
  }
  async changePassword(id: string, _username: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(id);
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    await this.validatePassword(
      dto.newPassword,
      dto.confirmPassword,
      user.username,
    );
    if (!(await bcrypt.compare(dto.oldPassword, user.passwordHash)))
      throw new BadRequestException("Mật khẩu hiện tại không đúng.");
    if (await bcrypt.compare(dto.newPassword, user.passwordHash))
      throw new BadRequestException(
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    const updated = await this.security.changePassword(
      id,
      user.passwordHash,
      await bcrypt.hash(dto.newPassword, 12),
    );
    if (!updated)
      throw new BadRequestException(
        "Tài khoản hoặc mật khẩu vừa thay đổi. Vui lòng đăng nhập lại.",
      );
    return { message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." };
  }
  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    this.mailer.assertConfigured();
    const message =
      "Nếu email thuộc một tài khoản đang hoạt động, hệ thống sẽ gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra cả thư rác.";
    const user = await this.users.findByEmail(dto.email.trim());
    if (
      !user ||
      !user.email ||
      user.deletedAt ||
      user.accountStatus !== "ACTIVE"
    )
      return { message };
    const { resetMinutes } = await this.security.policy();
    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const created = await this.security.createReset(
      user.id,
      hash,
      new Date(Date.now() + resetMinutes * 60000),
      ip,
    );
    if (created) {
      try {
        await this.mailer.sendReset(
          user.email,
          user.fullName,
          token,
          resetMinutes,
        );
      } catch (error) {
        // Never log SMTP credentials or reset links, and do not disclose account existence.
        this.logger.error(
          "Password reset email delivery failed: " +
            (error.code || "SMTP_DELIVERY_FAILED"),
        );
      }
    }
    return { message };
  }
  async resetPassword(dto: ResetPasswordDto) {
    const hash = crypto.createHash("sha256").update(dto.token).digest("hex");
    const token = await this.tokens.findByTokenHash(hash);
    if (!token || token.usedAt || token.expiresAt <= new Date())
      throw new BadRequestException(
        "Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.",
      );
    const user = await this.users.findById(token.userId);
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE")
      throw new BadRequestException(
        "Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.",
      );
    await this.validatePassword(
      dto.newPassword,
      dto.confirmPassword,
      user.username,
    );
    if (await bcrypt.compare(dto.newPassword, user.passwordHash))
      throw new BadRequestException(
        "Mật khẩu mới phải khác mật khẩu hiện tại.",
      );
    if (
      !(await this.security.consumeReset(
        hash,
        await bcrypt.hash(dto.newPassword, 12),
      ))
    )
      throw new BadRequestException(
        "Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.",
      );
    return { message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." };
  }
  async logout(userId: string, sessionId: string) {
    await this.security.revokeSession(userId, sessionId);
    return { message: "Đăng xuất thành công" };
  }
}
