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
} from "../application/thesis-defense.dto";
import { DefenseRequest, ThesisDefenseGuard } from "./thesis-defense.guard";

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
      permissions: {
        canSchedule: request.defenseActor.canSchedule,
        canRecord: request.defenseActor.canRecord,
      },
    };
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
  detail(@Param("id") id: string, @Req() request: DefenseRequest) {
    return this.service.findById(id, request.defenseActor);
  }
  @Post()
  @ApiOperation({ summary: "Lập lịch bảo vệ (ADMIN hoặc TRAINING_OFFICER)" })
  create(@Body() body: CreateDefenseDto, @Req() request: DefenseRequest) {
    return this.service.create(body, request.defenseActor);
  }
  @Post(":id/ket-qua")
  @ApiOperation({
    summary:
      "Ghi kết quả một lần; điểm từ 5.5 là đạt, chưa tới ngày bảo vệ không được ghi",
  })
  result(
    @Param("id") id: string,
    @Body() body: RecordDefenseResultDto,
    @Req() request: DefenseRequest,
  ) {
    return this.service.recordResult(id, body, request.defenseActor);
  }
}
