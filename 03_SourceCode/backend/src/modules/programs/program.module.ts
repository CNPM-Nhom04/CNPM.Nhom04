import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ProgramRepository } from "./domain/program";
import { MysqlProgramRepository } from "./infrastructure/program.repository";
import { ProgramService } from "./application/program.service";
import { ProgramController } from "./presentation/program.controller";
import { ProgramGuard } from "./presentation/program.guard";
@Module({
  imports: [IdentityModule],
  exports: [ProgramRepository, ProgramService],
  controllers: [ProgramController],
  providers: [
    ProgramService,
    ProgramGuard,
    { provide: ProgramRepository, useClass: MysqlProgramRepository },
  ],
})
export class ProgramModule {}
