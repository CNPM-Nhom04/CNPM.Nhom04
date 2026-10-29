import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { DefenseRepository } from "./domain/thesis-defense";
import { MysqlDefenseRepository } from "./infrastructure/thesis-defense.repository";
import { ThesisDefenseService } from "./application/thesis-defense.service";
import { ThesisDefenseController } from "./presentation/thesis-defense.controller";
import { ThesisDefenseGuard } from "./presentation/thesis-defense.guard";
@Module({
  imports: [IdentityModule],
  controllers: [ThesisDefenseController],
  providers: [
    ThesisDefenseService,
    ThesisDefenseGuard,
    { provide: DefenseRepository, useClass: MysqlDefenseRepository },
  ],
})
export class ThesisDefenseModule {}
