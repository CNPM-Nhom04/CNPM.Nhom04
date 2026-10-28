import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IUserRepository } from "../domain/user.repository.interface";
import { AuthSecurityRepository } from "../domain/auth-security.repository";
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject("IUserRepository") private readonly users: IUserRepository,
    private readonly security: AuthSecurityRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
      algorithms: ["HS256"],
    });
  }
  async validate(payload: { sub?: string; jti?: string }) {
    if (
      typeof payload.sub !== "string" ||
      !/^[1-9]\d{0,19}$/.test(payload.sub) ||
      typeof payload.jti !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(payload.jti)
    )
      throw new UnauthorizedException("Phiên đăng nhập không hợp lệ.");
    const user = await this.users.findById(payload.sub);
    if (
      !user ||
      user.deletedAt ||
      user.accountStatus !== "ACTIVE" ||
      !(await this.security.validSession(user.id, payload.jti))
    )
      throw new UnauthorizedException(
        "Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động.",
      );
    const roles = await this.users.findRoleCodes(user.id);
    const role =
      ["ADMIN", "TRAINING_OFFICER", "APPROVER", "LECTURER", "STUDENT"].find(
        (code) => roles.includes(code),
      ) || "UNASSIGNED";
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role,
      roles,
      orgUnitId: user.organizationalUnitId,
      mustChangePassword: user.mustChangePassword,
      sessionId: payload.jti,
    };
  }
}
