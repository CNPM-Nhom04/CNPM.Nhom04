import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { REPORT_REPOSITORY } from "./domain/report";
import { MysqlReportRepository } from "./infrastructure/report.repository";
import { ReportsService } from "./application/reports.service";
import { ReportsController } from "./presentation/reports.controller";

@Module({
  imports: [IdentityModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    { provide: REPORT_REPOSITORY, useClass: MysqlReportRepository },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
