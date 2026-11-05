import {
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IdentityModule } from "../identity/identity.module";
import { JwtAuthGuard } from "../identity/presentation/jwt-auth.guard";
import { ExcelRecordsService } from "./excel-records.service";
import { XLSX_MIME } from "../../core/excel/workbook";
@Controller("excel-records")
@UseGuards(JwtAuthGuard)
export class ExcelRecordsController {
  constructor(private readonly service: ExcelRecordsService) {}
  @Get(":resource/template") async template(
    @Param("resource") resource: string,
    @Query("focus") focus: string,
    @Query("baseId") baseId: string,
    @Req() req: any,
  ) {
    const file = await this.service.template(
      resource,
      req.user.userId,
      req.ip,
      focus,
      baseId,
    );
    return new StreamableFile(file.buffer, {
      type: XLSX_MIME,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }
  @Post(":resource/preview")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  preview(
    @Param("resource") resource: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.service.import(resource, req.user.userId, req.ip, file, false);
  }
  @Post(":resource/apply")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  apply(
    @Param("resource") resource: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.service.import(resource, req.user.userId, req.ip, file, true);
  }
}
@Module({
  imports: [IdentityModule],
  controllers: [ExcelRecordsController],
  providers: [ExcelRecordsService],
})
export class ExcelRecordsModule {}
