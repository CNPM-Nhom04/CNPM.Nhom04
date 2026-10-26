import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginDto } from "./login.dto";
import { ChangePasswordDto } from "./change-password.dto";
import { ForgotPasswordDto } from "./forgot-password.dto";
import { ResetPasswordDto } from "./reset-password.dto";
import { IUserRepository } from "../domain/user.repository.interface";
import { IPasswordResetTokenRepository } from "../domain/password-reset-token.repository.interface";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

@Injectable()
export class AuthService {
  constructor(
    @Inject("IUserRepository")
    private readonly userRepository: IUserRepository,
    @Inject("IPasswordResetTokenRepository")
    private readonly resetTokenRepository: IPasswordResetTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findByUsernameOrEmail(
      loginDto.identifier,
    );
    if (!user) {
      throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.",
      );
    }

    if (user.accountStatus && user.accountStatus !== "ACTIVE") {
      throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= 5) {
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 15);
        user.lockedUntil = lockTime;
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    let userRole = "STUDENT";
    if (user.username === "admin") userRole = "ADMIN";
    else if (user.username.includes("officer")) userRole = "TRAINING_OFFICER";
    else if (user.username.includes("approver")) userRole = "APPROVER";

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: userRole,
      orgUnitId: user.organizationalUnitId,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: userRole,
        orgUnitId: user.organizationalUnitId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException(
        "Không tìm thấy người dùng hoặc tài khoản đã bị xóa",
      );
    }

    let userRole = "STUDENT";
    if (user.username === "admin") userRole = "ADMIN";
    else if (user.username.includes("officer")) userRole = "TRAINING_OFFICER";
    else if (user.username.includes("approver")) userRole = "APPROVER";

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: userRole,
      accountStatus: user.accountStatus,
      orgUnitId: user.organizationalUnitId,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  async changePassword(
    userId: string,
    username: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Không tìm thấy người dùng");
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException("Mật khẩu hiện tại không đúng");
    }

    if (dto.newPassword === username) {
      throw new BadRequestException(
        "Mật khẩu mới không được trùng với tên đăng nhập",
      );
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(dto.newPassword, salt);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;

    await this.userRepository.save(user);
    return { message: "Đổi mật khẩu thành công" };
  }

  async forgotPassword(dto: ForgotPasswordDto, requestedIp?: string) {
    const neutralResponse = {
      message:
        "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi.",
    };

    const user = await this.userRepository.findByUsernameOrEmail(dto.email);
    if (!user || !user.email) {
      return neutralResponse;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await this.resetTokenRepository.save({
      userId: user.id,
      tokenHash: tokenHash,
      expiresAt: expiresAt,
      usedAt: null,
      requestedIp: requestedIp || null,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.sendResetPasswordEmail(user.email, user.fullName, resetLink);

    return neutralResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(dto.token)
      .digest("hex");

    const tokenRecord =
      await this.resetTokenRepository.findByTokenHash(tokenHash);

    if (
      !tokenRecord ||
      tokenRecord.usedAt !== null ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn",
      );
    }

    const user = await this.userRepository.findById(tokenRecord.userId);
    if (!user) {
      throw new BadRequestException("Không tìm thấy người dùng");
    }

    if (dto.newPassword === user.username) {
      throw new BadRequestException(
        "Mật khẩu mới không được trùng với tên đăng nhập",
      );
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(dto.newPassword, salt);
    user.passwordChangedAt = new Date();
    user.mustChangePassword = false;
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await this.userRepository.save(user);

    tokenRecord.usedAt = new Date();
    await this.resetTokenRepository.save(tokenRecord);

    return { message: "Đặt lại mật khẩu thành công" };
  }

  async logout() {
    return { message: "Đăng xuất thành công" };
  }

  private async sendResetPasswordEmail(
    toEmail: string,
    fullName: string,
    resetLink: string,
  ): Promise<void> {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.log(`[DEV SMTP EMAIL] To: ${toEmail} | Reset Link: ${resetLink}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: toEmail,
          subject: "[Hệ thống Quản lý CTĐT] Liên kết đặt lại mật khẩu",
          html: `
            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
            <p>Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu mới (liên kết chỉ sử dụng 1 lần và hết hạn sau <strong>30 phút</strong>):</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
          `,
        });
        console.log(
          `[SMTP SUCCESS] Đã gửi email đặt lại mật khẩu tới ${toEmail}`,
        );
        return;
      } catch (error) {
        console.error(
          `[SMTP ERROR] Gửi email lần ${attempt}/3 thất bại:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}
