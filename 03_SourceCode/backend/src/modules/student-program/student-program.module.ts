import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { StudentProgramRepository } from "./domain/student-program";
import { MysqlStudentProgramRepository } from "./infrastructure/student-program.repository";
import { StudentProgramService } from "./application/student-program.service";
import { StudentProgramController } from "./presentation/student-program.controller";
import { StudentProgramGuard } from "./presentation/student-program.guard";
@Module({
  imports: [IdentityModule],
  controllers: [StudentProgramController],
  providers: [
    StudentProgramService,
    StudentProgramGuard,
    {
      provide: StudentProgramRepository,
      useClass: MysqlStudentProgramRepository,
    },
  ],
})
export class StudentProgramModule {}
