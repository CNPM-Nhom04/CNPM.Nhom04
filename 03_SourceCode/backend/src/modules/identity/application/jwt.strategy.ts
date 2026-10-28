import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IUserRepository } from "../domain/user.repository.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject("IUserRepository") private readonly users: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.users.findById(payload.sub);
    if (!user || user.accountStatus !== "ACTIVE") {
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    }
    const roles = await this.users.findRoleCodes(user.id);
    const role =
      ["ADMIN", "TRAINING_OFFICER", "APPROVER", "LECTURER", "STUDENT"].find(
        (code) => roles.includes(code),
      ) || "STUDENT";
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role,
      orgUnitId: user.organizationalUnitId,
    };
  }
}
