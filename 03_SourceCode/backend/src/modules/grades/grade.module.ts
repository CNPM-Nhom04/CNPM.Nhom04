import { GradeRosterService } from "./application/grade-roster.service";
import { GradeExcelService } from "./application/grade-excel.service";
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
    GradeExcelService,
    GradeRosterService,
    GradeGuard,
    { provide: GradeRepository, useClass: MysqlGradeRepository },
  ],
})
export class GradeModule {}
