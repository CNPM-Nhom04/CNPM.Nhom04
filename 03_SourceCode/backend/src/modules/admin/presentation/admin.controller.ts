import { FacultyService } from "../application/faculty.service";
import {
  FacultyInputDto,
  FacultyQueryDto,
  FacultyVersionDto,
  UpdateFacultyDto,
} from "../application/faculty.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  MajorImportService,
  MajorUpload,
} from "../application/major-import.service";
import { MAJOR_UPLOAD_BYTES } from "../application/major-import.parser";
import {
  Body,
  UploadedFile,
  UseInterceptors,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { Actor } from "../domain/admin.repository";
import { AdminService } from "../application/admin.service";
import {
  AuditQueryDto,
  CategoriesQueryDto,
  CategoryInputDto,
  CreateUserDto,
  SettingsDto,
  UserInputDto,
  UsersQueryDto,
} from "../application/admin.dto";
import {
  MajorInputDto,
  CommitMajorImportDto,
  MajorVersionDto,
  MajorsQueryDto,
  UpdateMajorDto,
} from "../application/major.dto";
import { AdminGuard, AdminRequest } from "./admin.guard";

@ApiTags("Admin - Quản trị")
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  description: "JWT không hợp lệ hoặc tài khoản đã ngừng hoạt động",
})
@ApiResponse({
  status: 403,
  description: "Không có vai trò ADMIN trong database",
})
@ApiResponse({ status: 400, description: "Dữ liệu không hợp lệ" })
@ApiResponse({
  status: 409,
  description:
    "Trùng dữ liệu, danh mục đang sử dụng hoặc thao tác tự khóa/xóa/hạ quyền",
})
@UseGuards(JwtAuthGuard, AdminGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly majorImport: MajorImportService,
    private readonly faculties: FacultyService,
  ) {}
  private actor(request: AdminRequest): Actor {
    return {
      id: request.user.userId,
      permission: request.adminPermission,
      username: request.user.username,
      ip: request.ip || "",
    };
  }

  @Get("nguoi-dung")
  @ApiOperation({ summary: "Tìm kiếm, lọc và phân trang người dùng" })
  listUsers(@Query() query: UsersQueryDto) {
    return this.service.listUsers(query);
  }

  @Get("nguoi-dung/options")
  @ApiOperation({ summary: "Đơn vị công tác để thêm/sửa người dùng" })
  userOptions() {
    return this.service.userOptions();
  }

  @Post("nguoi-dung")
  @ApiOperation({ summary: "Tạo tài khoản và gán vai trò" })
  createUser(@Body() body: CreateUserDto, @Req() request: AdminRequest) {
    return this.service.createUser(body, this.actor(request));
  }

  @Put("nguoi-dung/:id")
  @ApiOperation({
    summary:
      "Cập nhật hồ sơ, trạng thái và vai trò (không đổi username/mật khẩu)",
  })
  updateUser(
    @Param("id") id: string,
    @Body() body: UserInputDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.updateUser(id, body, this.actor(request));
  }

  @Delete("nguoi-dung/:id")
  @ApiOperation({ summary: "Xóa mềm tài khoản, giữ lịch sử tham chiếu" })
  deleteUser(@Param("id") id: string, @Req() request: AdminRequest) {
    return this.service.deleteUser(id, this.actor(request));
  }

  @Get("khoa")
  @ApiOperation({ summary: "Danh sách khoa (FACULTY) từ organizational_units" })
  listFaculties(@Query() query: FacultyQueryDto) {
    return this.faculties.list(query);
  }
  @Post("khoa")
  createFaculty(@Body() body: FacultyInputDto, @Req() req: AdminRequest) {
    return this.faculties.save(null, body, this.actor(req));
  }
  @Put("khoa/:id")
  updateFaculty(
    @Param("id") id: string,
    @Body() body: UpdateFacultyDto,
    @Req() req: AdminRequest,
  ) {
    return this.faculties.save(
      id,
      body,
      this.actor(req),
      body.expectedUpdatedAt,
    );
  }
  @Delete("khoa/:id")
  deleteFaculty(
    @Param("id") id: string,
    @Query() query: FacultyVersionDto,
    @Req() req: AdminRequest,
  ) {
    return this.faculties.remove(id, query.expectedUpdatedAt, this.actor(req));
  }

  @Get("nganh-dao-tao")
  @ApiOperation({
    summary: "Ngành đào tạo từ SQL, tìm/lọc khoa/trạng thái và phân trang",
  })
  listMajors(@Query() query: MajorsQueryDto) {
    return this.service.listMajors(query);
  }

  @Get("nganh-dao-tao/options")
  @ApiOperation({ summary: "Đơn vị đang hoạt động từ SQL để quản lý ngành" })
  majorOptions() {
    return this.service.majorOptions();
  }

  @Get("nganh-dao-tao/import/options")
  majorImportOptions() {
    return this.majorImport.limits();
  }

  @Get("nganh-dao-tao/import/mau-excel")
  async majorImportTemplate() {
    return new StreamableFile(await this.majorImport.template(), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: 'attachment; filename="Mau_Nganh_Dao_Tao.xlsx"',
    });
  }

  @Post("nganh-dao-tao/import/kiem-tra")
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
      limits: { fileSize: MAJOR_UPLOAD_BYTES, files: 1, fields: 0, parts: 2 },
    }),
  )
  previewMajorImport(@UploadedFile() file: MajorUpload) {
    return this.majorImport.preview(file);
  }

  @Post("nganh-dao-tao/import/luu")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        previewHash: { type: "string" },
      },
      required: ["file", "previewHash"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: MAJOR_UPLOAD_BYTES,
        files: 1,
        fields: 1,
        parts: 3,
        fieldSize: 128,
      },
    }),
  )
  commitMajorImport(
    @UploadedFile() file: MajorUpload,
    @Body() body: CommitMajorImportDto,
    @Req() request: AdminRequest,
  ) {
    return this.majorImport.commit(file, body.previewHash, this.actor(request));
  }

  @Get("nganh-dao-tao/:id")
  majorDetail(@Param("id") id: string) {
    return this.service.majorDetail(id);
  }

  @Post("nganh-dao-tao")
  createMajor(@Body() body: MajorInputDto, @Req() request: AdminRequest) {
    return this.service.createMajor(body, this.actor(request));
  }

  @Put("nganh-dao-tao/:id")
  updateMajor(
    @Param("id") id: string,
    @Body() body: UpdateMajorDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.updateMajor(id, body, this.actor(request));
  }

  @Delete("nganh-dao-tao/:id")
  @ApiOperation({
    summary: "Xóa ngành chưa có liên kết; chặn ghi đè dữ liệu cũ",
  })
  deleteMajor(
    @Param("id") id: string,
    @Query() query: MajorVersionDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.deleteMajor(
      id,
      query.expectedUpdatedAt,
      this.actor(request),
    );
  }

  @Get("master-data")
  @ApiOperation({
    summary: "Danh mục khoa/đơn vị, bậc đào tạo, khối kiến thức",
  })
  listCategories(@Query() query: CategoriesQueryDto) {
    return this.service.listCategories(query);
  }

  @Post("master-data")
  @ApiOperation({ summary: "Tạo danh mục" })
  createCategory(@Body() body: CategoryInputDto, @Req() request: AdminRequest) {
    return this.service.saveCategory(null, body, this.actor(request));
  }

  @Put("master-data/:id")
  @ApiOperation({ summary: "Sửa danh mục; id dạng KHOA_QUAN_LY:1" })
  updateCategory(
    @Param("id") id: string,
    @Body() body: CategoryInputDto,
    @Req() request: AdminRequest,
  ) {
    return this.service.saveCategory(id, body, this.actor(request));
  }

  @Delete("master-data/:id")
  @ApiOperation({ summary: "Xóa danh mục chưa được sử dụng" })
  deleteCategory(@Param("id") id: string, @Req() request: AdminRequest) {
    return this.service.deleteCategory(id, this.actor(request));
  }

  @Get("cau-hinh")
  @ApiOperation({ summary: "Đọc cấu hình tham số đào tạo" })
  getSettings() {
    return this.service.getSettings();
  }

  @Put("cau-hinh")
  @ApiOperation({ summary: "Lưu 7 tham số đào tạo" })
  saveSettings(@Body() body: SettingsDto, @Req() request: AdminRequest) {
    return this.service.saveSettings(body, this.actor(request));
  }

  @Post("cau-hinh/mac-dinh")
  @ApiOperation({ summary: "Lưu lại cấu hình mặc định" })
  resetSettings(@Req() request: AdminRequest) {
    return this.service.resetSettings(this.actor(request));
  }

  @Get("audit-log")
  @ApiOperation({ summary: "Xem, tìm kiếm, lọc và phân trang nhật ký" })
  listAudit(@Query() query: AuditQueryDto) {
    return this.service.listAudit(query);
  }

  @Get("audit-log/xuat-excel")
  @ApiOperation({ summary: "Xuất XLSX toàn bộ nhật ký khớp bộ lọc" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  async exportAudit(@Query() query: AuditQueryDto) {
    return new StreamableFile(await this.service.exportAudit(query), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: 'attachment; filename="Nhat_Ky_He_Thong.xlsx"',
    });
  }
}
