import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { GraduationRepository } from "./domain/graduation";
import { MysqlGraduationRepository } from "./infrastructure/graduation.repository";
import { GraduationService } from "./application/graduation.service";
import { GraduationController } from "./presentation/graduation.controller";
import { GraduationGuard } from "./presentation/graduation.guard";
@Module({
  imports: [IdentityModule],
  controllers: [GraduationController],
  providers: [
    GraduationService,
    GraduationGuard,
    { provide: GraduationRepository, useClass: MysqlGraduationRepository },
  ],
})
export class GraduationModule {}
