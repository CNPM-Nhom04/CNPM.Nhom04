import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IdentityModule } from "./modules/identity/identity.module";
import { ThesisDefenseModule } from "./modules/thesis-defense/thesis-defense.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "mysql",
        host: configService.get<string>("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get<string>("DB_USERNAME"),
        password: configService.get<string>("DB_PASSWORD"),
        database: configService.get<string>("DB_DATABASE"),
        autoLoadEntities: true,
        synchronize: false,
        timezone: "Z",
      }),
    }),
    IdentityModule,
    ThesisDefenseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
