import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ProgramModule } from "../programs/program.module";
import { ProgramGuard } from "../programs/presentation/program.guard";
import { ApprovalRepository } from "./domain/approval";
import { MysqlApprovalRepository } from "./infrastructure/approval.repository";
import { ApprovalService } from "./application/approval.service";
import { ApprovalController } from "./presentation/approval.controller";
@Module({
  imports: [IdentityModule, ProgramModule],
  controllers: [ApprovalController],
  providers: [
    ApprovalService,
    ProgramGuard,
    { provide: ApprovalRepository, useClass: MysqlApprovalRepository },
  ],
})
export class ApprovalModule {}
