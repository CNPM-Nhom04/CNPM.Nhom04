import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import {
  ProgramGuard,
  ProgramPermission,
  ProgramRequest,
} from "../../programs/presentation/program.guard";
import { ProgramUpload } from "../../programs/application/program.service";
import { ApprovalService } from "../application/approval.service";
import {
  ApprovalDecisionDto,
  ApprovalQueryDto,
  ApprovalRevisionDto,
} from "../application/approval.dto";
@ApiTags("Approvals - Xét duyệt CTĐT")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProgramGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("xet-duyet")
export class ApprovalController {
  constructor(private readonly service: ApprovalService) {}
  @Get()
  @ProgramPermission("PROGRAM_APPROVE")
  @ApiOperation({
    summary: "Hồ sơ từng lượt gửi, lọc/tìm/phân trang theo phạm vi SQL",
  })
  list(@Query() query: ApprovalQueryDto, @Req() req: ProgramRequest) {
    return this.service.list(query, req.programActor);
  }
  @Get(":id")
  @ProgramPermission("PROGRAM_APPROVE")
  @ApiOperation({
    summary: "Chi tiết lượt duyệt, biên bản, tài liệu và lịch sử SQL",
  })
  detail(@Param("id") id: string, @Req() req: ProgramRequest) {
    return this.service.detail(id, req.programActor);
  }
  @Post(":id/bat-dau")
  @ProgramPermission("PROGRAM_APPROVE")
  @ApiOperation({
    summary: "Bắt đầu thẩm định, ghi START_REVIEW và chống cập nhật đồng thời",
  })
  start(
    @Param("id") id: string,
    @Body() input: ApprovalRevisionDto,
    @Req() req: ProgramRequest,
  ) {
    return this.service.start(id, input, req.programActor);
  }
  @Post(":id/ket-luan")
  @ProgramPermission("PROGRAM_APPROVE")
  @ApiOperation({
    summary:
      "Phê duyệt/ban hành hoặc trả về, ghi biên bản trong cùng transaction",
  })
  decide(
    @Param("id") id: string,
    @Body() input: ApprovalDecisionDto,
    @Req() req: ProgramRequest,
  ) {
    return this.service.decide(id, input, req.programActor);
  }
  @Post(":id/tai-lieu")
  @ProgramPermission("PROGRAM_APPROVE")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  upload(
    @Param("id") id: string,
    @UploadedFile() file: ProgramUpload,
    @Req() req: ProgramRequest,
  ) {
    return this.service.upload(id, file, req.programActor);
  }
  @Get(":id/tai-lieu/:documentId")
  @ProgramPermission("PROGRAM_APPROVE")
  async download(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Req() req: ProgramRequest,
  ) {
    const file = await this.service.download(id, documentId, req.programActor);
    return new StreamableFile(file.stream, {
      type: file.mime,
      disposition: `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }
}
