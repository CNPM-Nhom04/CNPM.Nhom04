import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { XLSX_MIME } from "../../../core/excel/workbook";
import {
  StudentAccountsService,
  StudentAccountUpload,
} from "../application/student-accounts.service";
import {
  LinkStudentAccountDto,
  ConfirmStudentAccountsDto,
  CreateStudentClassDto,
  StudentClassQueryDto,
  StudentClassRevisionDto,
  UpdateStudentClassDto,
} from "../application/student-accounts.dto";
import {
  StudentAccountsGuard,
  StudentAccountsRequest,
} from "./student-accounts.guard";
@ApiTags("Admin - Lớp và tài khoản học viên")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StudentAccountsGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller("admin/lop-hoc-vien")
export class StudentAccountsController {
  constructor(private readonly service: StudentAccountsService) {}
  private actor(req: StudentAccountsRequest) {
    return {
      id: req.user.userId,
      username: req.user.username,
      ip: req.ip || "",
    };
  }
  @Get() list(@Query() q: StudentClassQueryDto) {
    return this.service.list(q);
  }
  @Get("options") options() {
    return this.service.options();
  }
  @Post() create(
    @Body() body: CreateStudentClassDto,
    @Req() req: StudentAccountsRequest,
  ) {
    return this.service.create(body, this.actor(req));
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.service.detail(id);
  }
  @Put(":id") update(
    @Param("id") id: string,
    @Body() body: UpdateStudentClassDto,
    @Req() req: StudentAccountsRequest,
  ) {
    return this.service.update(id, body, this.actor(req));
  }
  @Delete(":id") remove(
    @Param("id") id: string,
    @Query() q: StudentClassRevisionDto,
    @Req() req: StudentAccountsRequest,
  ) {
    return this.service.remove(id, q.revision, this.actor(req));
  }
  @Get(":id/lien-ket/tai-khoan") linkAccounts(
    @Param("id") id: string,
    @Query() q: StudentClassQueryDto,
  ) {
    return this.service.linkAccounts(id, q);
  }
  @Get(":id/lien-ket/ho-so") linkProfiles(
    @Param("id") id: string,
    @Query() q: StudentClassQueryDto,
  ) {
    return this.service.linkProfiles(id, q);
  }
  @Post(":id/lien-ket") link(
    @Param("id") id: string,
    @Body() input: LinkStudentAccountDto,
    @Req() req: StudentAccountsRequest,
  ) {
    return this.service.link(id, input, this.actor(req));
  }
  @Get(":id/hoc-vien") members(
    @Param("id") id: string,
    @Query() q: StudentClassQueryDto,
  ) {
    return this.service.members(id, q);
  }
  @Get(":id/import/mau-excel") async template(@Param("id") id: string) {
    return new StreamableFile(await this.service.template(id), {
      type: XLSX_MIME,
      disposition: 'attachment; filename="Mau_Hoc_Vien.xlsx"',
    });
  }
  @Post(":id/import/kiem-tra")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
      required: ["file"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    }),
  )
  preview(@Param("id") id: string, @UploadedFile() file: StudentAccountUpload) {
    return this.service.preview(id, file);
  }
  @Post(":id/import/luu")
  @Header("Cache-Control", "private, no-store")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        previewHash: { type: "string" },
        classRevision: { type: "integer" },
      },
      required: ["file", "previewHash", "classRevision"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 2,
        parts: 4,
        fieldSize: 128,
      },
    }),
  )
  async commit(
    @Param("id") id: string,
    @UploadedFile() file: StudentAccountUpload,
    @Body() body: ConfirmStudentAccountsDto,
    @Req() req: StudentAccountsRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.commit(
      id,
      file,
      body.previewHash,
      body.classRevision,
      this.actor(req),
    );
    response.setHeader("X-Imported-Count", String(result.created));
    return new StreamableFile(result.buffer, {
      type: XLSX_MIME,
      disposition: 'attachment; filename="Ban_Giao_Tai_Khoan_Hoc_Vien.xlsx"',
    });
  }
}
