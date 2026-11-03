import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { StudentAccountsRepository } from "./domain/student-accounts";
import { MysqlStudentAccountsRepository } from "./infrastructure/student-accounts.repository";
import { StudentAccountsService } from "./application/student-accounts.service";
import { StudentAccountsGuard } from "./presentation/student-accounts.guard";
import { StudentAccountsController } from "./presentation/student-accounts.controller";
@Module({
  imports: [IdentityModule],
  controllers: [StudentAccountsController],
  providers: [
    StudentAccountsService,
    StudentAccountsGuard,
    {
      provide: StudentAccountsRepository,
      useClass: MysqlStudentAccountsRepository,
    },
  ],
})
export class StudentAccountsModule {}
