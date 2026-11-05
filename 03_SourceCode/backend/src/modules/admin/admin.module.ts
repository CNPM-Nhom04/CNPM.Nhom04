import { CategoryExcelService } from "./application/category-excel.service";
import { FacultyService } from "./application/faculty.service";
import { MajorImportService } from "./application/major-import.service";
import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AdminRepository } from "./domain/admin.repository";
import { MysqlAdminRepository } from "./infrastructure/admin.repository";
import { AdminService } from "./application/admin.service";
import { AdminController } from "./presentation/admin.controller";
import { AdminGuard } from "./presentation/admin.guard";

@Module({
  imports: [IdentityModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    FacultyService,
    MajorImportService,
    CategoryExcelService,
    AdminGuard,
    { provide: AdminRepository, useClass: MysqlAdminRepository },
  ],
})
export class AdminModule {}
