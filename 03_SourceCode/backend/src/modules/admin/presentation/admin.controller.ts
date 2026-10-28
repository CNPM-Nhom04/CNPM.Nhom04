import {
  Body,
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
  constructor(private readonly service: AdminService) {}
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
