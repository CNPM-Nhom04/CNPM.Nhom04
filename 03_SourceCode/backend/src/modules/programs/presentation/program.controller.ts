import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { ProgramService, ProgramUpload } from "../application/program.service";
import {
  CurriculumDto,
  ProgramInputDto,
  ProgramQueryDto,
  ReviewDto,
  RevisionDto,
} from "../application/program.dto";
import { ProgramActor, ProgramItem } from "../domain/program";
import {
  ProgramGuard,
  ProgramPermission,
  ProgramRequest,
} from "./program.guard";
function permissions(actor: ProgramActor, item?: ProgramItem) {
  return {
    canEdit: actor.permissions.includes("PROGRAM_EDIT"),
    canCreateProgram:
      !!actor.canCreateProgram && actor.permissions.includes("PROGRAM_EDIT"),
    canSubmit: actor.permissions.includes("PROGRAM_SUBMIT"),
    canApprove:
      actor.permissions.includes("PROGRAM_APPROVE") &&
      (!item || item.requestedBy !== actor.id),
  };
}
@ApiTags("Programs - Chương trình đào tạo")
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: "Dữ liệu hoặc cấu trúc tín chỉ không hợp lệ",
})
@ApiResponse({ status: 401, description: "Chưa đăng nhập" })
@ApiResponse({ status: 403, description: "Không có quyền hoặc tự xét duyệt" })
@ApiResponse({ status: 404, description: "Không tồn tại hoặc ngoài phạm vi" })
@ApiResponse({
  status: 409,
  description: "Bản ghi bị khóa, trùng dữ liệu hoặc có người sửa đồng thời",
})
@UseGuards(JwtAuthGuard, ProgramGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("chuong-trinh-dao-tao")
export class ProgramController {
  constructor(private readonly service: ProgramService) {}
  private result(item: ProgramItem, actor: ProgramActor) {
    return { ...item, permissions: permissions(actor, item) };
  }
  @Get()
  @ApiOperation({
    summary: "Danh sách phiên bản CTĐT, tìm kiếm, lọc và phân trang",
  })
  async list(@Query() query: ProgramQueryDto, @Req() req: ProgramRequest) {
    return {
      ...(await this.service.list(query, req.programActor)),
      permissions: permissions(req.programActor),
    };
  }
  @Get("chua-co-phien-ban")
  @ApiOperation({
    summary: "CTĐT gốc chưa có phiên bản, không bỏ sót danh mục SQL",
  })
  async unversioned(
    @Query() query: ProgramQueryDto,
    @Req() req: ProgramRequest,
  ) {
    return {
      ...((await this.service.unversioned(query, req.programActor)) as object),
      permissions: permissions(req.programActor),
    };
  }
  @Get("danh-muc/:programId")
  @ApiOperation({ summary: "Thông tin CTĐT gốc để khởi tạo phiên bản" })
  baseProgram(@Param("programId") id: string, @Req() req: ProgramRequest) {
    return this.service.baseProgram(id, req.programActor);
  }
  @Post("danh-muc/:programId/phien-ban")
  @ProgramPermission("PROGRAM_EDIT")
  @ApiOperation({
    summary: "Tạo phiên bản trên CTĐT đã có, giữ nguyên mã chương trình",
  })
  async createVersion(
    @Param("programId") id: string,
    @Body() body: ProgramInputDto,
    @Req() req: ProgramRequest,
  ) {
    return this.result(
      await this.service.createVersion(id, body, req.programActor),
      req.programActor,
    );
  }
  @Get("options")
  @ApiOperation({ summary: "Bậc đào tạo, ngành và đơn vị quản lý từ database" })
  options(@Req() req: ProgramRequest) {
    return this.service.options(req.programActor);
  }
  @Get("hoc-phan")
  @ApiOperation({
    summary: "Ngân hàng phiên bản học phần ACTIVE để xây dựng cấu trúc",
  })
  catalog(@Query() query: ProgramQueryDto, @Req() req: ProgramRequest) {
    return this.service.catalog(query, req.programActor);
  }
  @Get(":id")
  @ApiOperation({ summary: "Thông tin chung, cấu trúc, hồ sơ thẩm định" })
  async detail(@Param("id") id: string, @Req() req: ProgramRequest) {
    return this.result(
      await this.service.detail(id, req.programActor),
      req.programActor,
    );
  }
  @Post()
  @ProgramPermission("PROGRAM_EDIT")
  @ApiOperation({ summary: "Tạo CTĐT v1 bản nháp và các hướng bắt buộc" })
  async create(@Body() body: ProgramInputDto, @Req() req: ProgramRequest) {
    return this.result(
      await this.service.create(body, req.programActor),
      req.programActor,
    );
  }
  @Put(":id")
  @ProgramPermission("PROGRAM_EDIT")
  @ApiOperation({ summary: "Sửa thông tin bản nháp/trả về; kiểm tra revision" })
  async update(
    @Param("id") id: string,
    @Body() body: ProgramInputDto,
    @Req() req: ProgramRequest,
  ) {
    return this.result(
      await this.service.update(id, body, req.programActor),
      req.programActor,
    );
  }
  @Put(":id/cau-truc")
  @ProgramPermission("PROGRAM_EDIT")
  @ApiOperation({
    summary: "Lưu nhóm, học phần từng hướng; giữ các liên kết hiện có",
  })
  async structure(
    @Param("id") id: string,
    @Body() body: CurriculumDto,
    @Req() req: ProgramRequest,
  ) {
    return this.result(
      await this.service.structure(id, body, req.programActor),
      req.programActor,
    );
  }
  @Get(":id/kiem-tra")
  @ApiOperation({
    summary: "Kiểm tra tổng tín chỉ, nhóm kiến thức, tỷ lệ tự chọn",
  })
  validate(@Param("id") id: string, @Req() req: ProgramRequest) {
    return this.service.validate(id, req.programActor);
  }
  @Post(":id/gui-duyet")
  @ProgramPermission("PROGRAM_SUBMIT")
  @ApiOperation({ summary: "Kiểm tra và gửi bản nháp sang SUBMITTED" })
  async submit(
    @Param("id") id: string,
    @Body() body: RevisionDto,
    @Req() req: ProgramRequest,
  ) {
    return this.result(
      await this.service.submit(id, body.revision, req.programActor),
      req.programActor,
    );
  }
  @Post(":id/xet-duyet")
  @ProgramPermission("PROGRAM_APPROVE")
  @ApiOperation({
    summary: "Ghi biên bản và phê duyệt/trả về trong cùng transaction",
  })
  async review(
    @Param("id") id: string,
    @Body() body: ReviewDto,
    @Req() req: ProgramRequest,
  ) {
    return this.result(
      await this.service.review(id, body, req.programActor),
      req.programActor,
    );
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
  @ApiOperation({
    summary: "Đính kèm PDF/DOCX tối đa 25MB vào hồ sơ đang thẩm định",
  })
  upload(
    @Param("id") id: string,
    @UploadedFile() file: ProgramUpload,
    @Req() req: ProgramRequest,
  ) {
    return this.service.upload(id, file, req.programActor);
  }
  @Get(":id/tai-lieu/:documentId")
  @ApiOperation({ summary: "Tải tài liệu sau khi kiểm tra phạm vi dữ liệu" })
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
