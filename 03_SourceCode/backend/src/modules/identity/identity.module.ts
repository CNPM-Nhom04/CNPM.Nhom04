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
          "dev_secret_key_change_in_env",
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
    {
      provide: "IUserRepository",
      useClass: UserRepository,
    },
    {
      provide: "IPasswordResetTokenRepository",
      useClass: PasswordResetTokenRepository,
    },
  ],
  exports: [AuthService, JwtModule, PassportModule],
})
export class IdentityModule {}
