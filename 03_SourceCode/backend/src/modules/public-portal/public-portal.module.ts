import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AdminGuard } from "../admin/presentation/admin.guard";
import { PortalRepository } from "./domain/portal";
import { MysqlPortalRepository } from "./infrastructure/portal.repository";
import { PortalService } from "./application/portal.service";
import {
  PortalController,
  PortalAdminController,
} from "./presentation/portal.controller";
import { OptionalPortalAuthGuard } from "./presentation/optional-portal-auth.guard";
import { SubscriptionRateGuard } from "./presentation/subscription-rate.guard";
@Module({
  imports: [IdentityModule],
  controllers: [PortalController, PortalAdminController],
  providers: [
    PortalService,
    AdminGuard,
    SubscriptionRateGuard,
    OptionalPortalAuthGuard,
    { provide: PortalRepository, useClass: MysqlPortalRepository },
  ],
})
export class PublicPortalModule {}
