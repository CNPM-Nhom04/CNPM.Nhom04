import { GradeRosterService } from "../application/grade-roster.service";
import { GradeExcelService } from "../application/grade-excel.service";
import { XLSX_MIME } from "../../../core/excel/workbook";
import { FileInterceptor } from "@nestjs/platform-express";
import { StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { GradeService } from "../application/grade.service";
import {
  CreateGradeDto,
  GradeActionDto,
  GradePolicyDto,
  GradeQueryDto,
  LegacyGradeDto,
  UpdateGradeDto,
} from "../application/grade.dto";
import { GradeGuard, GradePermission, GradeRequest } from "./grade.guard";
@ApiTags("Grades - Quản lý điểm")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GradeGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("quan-ly-diem")
export class GradeController {
  constructor(
    private readonly service: GradeService,
    private readonly excel: GradeExcelService,
    private readonly roster: GradeRosterService,
  ) {}
  @Get("excel/chuan-bi")
  @GradePermission()
  preparation(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @Req() r: GradeRequest,
  ) {
    return this.roster.data(classId, termId, r.gradeActor);
  }
  @Get("excel/danh-sach-mau")
  @GradePermission()
  async rosterTemplate(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @Query("prefill") prefill: string,
    @Req() r: GradeRequest,
  ) {
    return new StreamableFile(
      await this.roster.template(
        classId,
        termId,
        r.gradeActor,
        prefill === "1",
      ),
      {
        type: XLSX_MIME,
        disposition: 'attachment; filename="Danh_sach_hoc.xlsx"',
      },
    );
  }
  @Post("excel/danh-sach-kiem-tra")
  @GradePermission()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  rosterPreview(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @UploadedFile() file: any,
    @Req() r: GradeRequest,
  ) {
    return this.roster.import(classId, termId, file, r.gradeActor, false);
  }
  @Post("excel/danh-sach-luu")
  @GradePermission()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  rosterSave(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @UploadedFile() file: any,
    @Req() r: GradeRequest,
  ) {
    return this.roster.import(classId, termId, file, r.gradeActor, true);
  }
  @Get("excel/options") excelOptions(@Req() r: GradeRequest) {
    return this.excel.options(r.gradeActor);
  }
  @Get("excel/rows") excelRows(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @Req() r: GradeRequest,
  ) {
    return this.excel.rows(classId, termId, r.gradeActor);
  }
  @Get("excel/mau")
  @GradePermission()
  async excelTemplate(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @Req() r: GradeRequest,
  ) {
    return new StreamableFile(
      await this.excel.template(classId, termId, r.gradeActor),
      { type: XLSX_MIME, disposition: 'attachment; filename="Bang_diem.xlsx"' },
    );
  }
  @Post("excel/kiem-tra")
  @GradePermission()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  excelPreview(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @UploadedFile() file: any,
    @Req() r: GradeRequest,
  ) {
    return this.excel.import(classId, termId, file, r.gradeActor, false);
  }
  @Post("excel/luu")
  @GradePermission()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  excelSave(
    @Query("classId") classId: string,
    @Query("termId") termId: string,
    @UploadedFile() file: any,
    @Req() r: GradeRequest,
  ) {
    return this.excel.import(classId, termId, file, r.gradeActor, true);
  }
  @Get()
  @ApiOperation({
    summary: "Tất cả kết quả SQL, kể cả miễn học phần và dữ liệu lịch sử",
  })
  list(@Query() q: GradeQueryDto, @Req() r: GradeRequest) {
    return this.service.list(q, r.gradeActor);
  }
  @Get("lop-hoc") classes(@Query() q: GradeQueryDto, @Req() r: GradeRequest) {
    return this.service.classes(q, r.gradeActor);
  }
  @Get("dang-ky") registrations(
    @Query() q: GradeQueryDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.registrations(q, r.gradeActor);
  }
  @Get("lop-hoc/:id/quy-tac") policy(
    @Param("id") id: string,
    @Req() r: GradeRequest,
  ) {
    return this.service.policy(id, r.gradeActor);
  }
  @Post("lop-hoc/:id/quy-tac") @GradePermission() savePolicy(
    @Param("id") id: string,
    @Body() b: GradePolicyDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.savePolicy(id, b, r.gradeActor);
  }
  @Get(":id") detail(@Param("id") id: string, @Req() r: GradeRequest) {
    return this.service.detail(id, r.gradeActor);
  }
  @Post(":id/chot") @GradePermission() finalize(
    @Param("id") id: string,
    @Body() b: GradeActionDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.action(id, "finalize", b, r.gradeActor);
  }
  @Post(":id/huy") @GradePermission() void(
    @Param("id") id: string,
    @Body() b: GradeActionDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.action(id, "void", b, r.gradeActor);
  }
  @Post(":id/mo-lai") @GradePermission() reopen(
    @Param("id") id: string,
    @Body() b: GradeActionDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.action(id, "reopen", b, r.gradeActor);
  }
  @Post(":id/dieu-chinh") @GradePermission() legacy(
    @Param("id") id: string,
    @Body() b: LegacyGradeDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.legacy(id, b, r.gradeActor);
  }
}
