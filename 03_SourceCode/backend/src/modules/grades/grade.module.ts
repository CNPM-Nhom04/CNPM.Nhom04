import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { GradeRepository } from "./domain/grade";
import { MysqlGradeRepository } from "./infrastructure/grade.repository";
import { GradeService } from "./application/grade.service";
import { GradeController } from "./presentation/grade.controller";
import { GradeGuard } from "./presentation/grade.guard";
@Module({
  imports: [IdentityModule],
  controllers: [GradeController],
  providers: [
    GradeService,
    GradeGuard,
    { provide: GradeRepository, useClass: MysqlGradeRepository },
  ],
})
export class GradeModule {}
