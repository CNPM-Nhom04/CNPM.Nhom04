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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { ThesisDefenseService } from "../application/thesis-defense.service";
import {
  CreateDefenseDto,
  DefenseQueryDto,
  RecordDefenseResultDto,
  CancelDefenseDto,
} from "../application/thesis-defense.dto";
import {
  DefenseRequest,
  ThesisDefenseGuard,
  DefensePermission,
} from "./thesis-defense.guard";

@ApiTags("Thesis Defense - Bảo vệ luận văn")
@ApiBearerAuth()
@ApiResponse({ status: 400, description: "Dữ liệu không hợp lệ" })
@ApiResponse({
  status: 401,
  description: "Chưa đăng nhập hoặc tài khoản không hoạt động",
})
@ApiResponse({ status: 403, description: "Không có quyền thao tác" })
@ApiResponse({
  status: 404,
  description: "Không tìm thấy hoặc ngoài phạm vi dữ liệu",
})
@ApiResponse({
  status: 409,
  description: "Học viên đã có lịch chờ hoặc kết quả đã được ghi",
})
@UseGuards(JwtAuthGuard, ThesisDefenseGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("bao-ve-luan-van")
export class ThesisDefenseController {
  constructor(private readonly service: ThesisDefenseService) {}
  @Get()
  @ApiOperation({
    summary: "Danh sách bảo vệ, tìm kiếm, lọc trạng thái và phân trang",
  })
  async list(@Query() query: DefenseQueryDto, @Req() request: DefenseRequest) {
    return {
      ...(await this.service.list(query, request.defenseActor)),
      today: this.service.today(),
      permissions: {
        canSchedule: request.defenseActor.canSchedule,
        canRecord: request.defenseActor.canRecord,
      },
    };
  }
  @Get("policy")
  policy() {
    return this.service.policy();
  }
  @Get("hoc-vien")
  @ApiOperation({
    summary: "Tìm học viên SĐH có gán CTĐT ACTIVE và chưa có lịch bảo vệ chờ",
  })
  students(@Query() query: DefenseQueryDto, @Req() request: DefenseRequest) {
    return this.service.students(query, request.defenseActor);
  }
  @Get(":id")
  @ApiOperation({ summary: "Chi tiết lịch, thành phần hội đồng và kết quả" })
  async detail(@Param("id") id: string, @Req() request: DefenseRequest) {
    return {
      ...(await this.service.findById(id, request.defenseActor)),
      today: this.service.today(),
      permissions: {
        canSchedule: request.defenseActor.canSchedule,
        canRecord: request.defenseActor.canRecord,
      },
    };
  }
  @Post(":id/huy")
  @DefensePermission("DEFENSE_SCHEDULE")
  @ApiOperation({ summary: "Hủy lịch chưa có kết quả, giữ lịch sử và lý do" })
  cancel(
    @Param("id") id: string,
    @Body() body: CancelDefenseDto,
    @Req() request: DefenseRequest,
  ) {
    return this.service.cancel(id, body, request.defenseActor);
  }
  @Post()
  @DefensePermission("DEFENSE_SCHEDULE")
  @ApiOperation({
    summary:
      "Lập lịch theo quyền DEFENSE_SCHEDULE và phạm vi học viên/chương trình",
  })
  create(@Body() body: CreateDefenseDto, @Req() request: DefenseRequest) {
    return this.service.create(body, request.defenseActor);
  }
  @Post(":id/ket-qua")
  @DefensePermission("DEFENSE_RESULT")
  @ApiOperation({
    summary:
      "Ghi kết quả một lần theo ngưỡng đã lưu; chưa tới ngày bảo vệ không được ghi",
  })
  result(
    @Param("id") id: string,
    @Body() body: RecordDefenseResultDto,
    @Req() request: DefenseRequest,
  ) {
    return this.service.recordResult(id, body, request.defenseActor);
  }
}
