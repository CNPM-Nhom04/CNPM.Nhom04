import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ComparisonRepository } from "./domain/comparison";
import { MysqlComparisonRepository } from "./infrastructure/comparison.repository";
import { ComparisonService } from "./application/comparison.service";
import { ComparisonController } from "./presentation/comparison.controller";
import { ComparisonGuard } from "./presentation/comparison.guard";
@Module({
  imports: [IdentityModule],
  controllers: [ComparisonController],
  providers: [
    ComparisonService,
    ComparisonGuard,
    { provide: ComparisonRepository, useClass: MysqlComparisonRepository },
  ],
})
export class ComparisonModule {}
