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
    AdminGuard,
    { provide: AdminRepository, useClass: MysqlAdminRepository },
  ],
})
export class AdminModule {}
