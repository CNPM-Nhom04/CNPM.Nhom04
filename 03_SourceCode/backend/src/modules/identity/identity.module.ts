import { AuthRateLimitGuard } from "./presentation/auth-rate-limit.guard";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { User } from "./domain/user.entity";
import { PasswordResetToken } from "./domain/password-reset-token.entity";
import { UserRepository } from "./infrastructure/user.repository";
import { PasswordResetTokenRepository } from "./infrastructure/password-reset-token.repository";
import { AuthService } from "./application/auth.service";
import { AuthController } from "./presentation/auth.controller";
import { JwtStrategy } from "./application/jwt.strategy";

import { AuthSecurityRepository } from "./domain/auth-security.repository";
import { MysqlAuthSecurityRepository } from "./infrastructure/auth-security.repository";
import { PasswordMailer } from "./application/password-mailer";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>("JWT_SECRET") ||
          (() => {
            throw new Error("JWT_SECRET is required");
          })(),
        signOptions: {
          expiresIn: "30m",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordMailer,
    AuthRateLimitGuard,
    { provide: AuthSecurityRepository, useClass: MysqlAuthSecurityRepository },
    {
      provide: "IUserRepository",
      useClass: UserRepository,
    },
    {
      provide: "IPasswordResetTokenRepository",
      useClass: PasswordResetTokenRepository,
    },
  ],
  exports: [AuthService, AuthSecurityRepository, JwtModule, PassportModule],
})
export class IdentityModule {}
 
