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
import { GraduationService } from "../application/graduation.service";
import {
  GraduationBatchDto,
  GraduationEvidenceDto,
  GraduationHistoryDto,
  GraduationPolicyDto,
  GraduationQueryDto,
} from "../application/graduation.dto";
import {
  GraduationGuard,
  GraduationPermission,
  GraduationRequest,
} from "./graduation.guard";
@ApiTags("Graduation - Xét điều kiện tốt nghiệp")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GraduationGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller("xet-tot-nghiep")
export class GraduationController {
  constructor(private readonly service: GraduationService) {}
  @Get()
  @ApiOperation({
    summary:
      "Đối chiếu SQL hiện tại, tìm kiếm/lọc/phân trang theo cả phạm vi chương trình và học viên",
  })
  list(@Query() q: GraduationQueryDto, @Req() req: GraduationRequest) {
    return this.service.list(q, req.graduationActor);
  }
  @Get("options")
  @ApiOperation({
    summary: "Bậc/hướng đào tạo từ SQL, không gán mặc định 60/90 TC",
  })
  options(@Req() req: GraduationRequest) {
    return this.service.options(req.graduationActor);
  }
  @Get("quy-dinh/:trackId")
  policy(@Param("trackId") id: string, @Req() req: GraduationRequest) {
    return this.service.policy(id, req.graduationActor);
  }
  @Post("quy-dinh/:trackId")
  @GraduationPermission("GRADUATION_POLICY")
  savePolicy(
    @Param("trackId") id: string,
    @Body() body: GraduationPolicyDto,
    @Req() req: GraduationRequest,
  ) {
    return this.service.savePolicy(id, body, req.graduationActor);
  }
  @Post("kiem-tra")
  @GraduationPermission("GRADUATION_CHECK")
  @ApiOperation({
    summary:
      "Lưu snapshot kiểm tra theo bậc, chia lô/cursor; không cấp bằng hay đổi trạng thái học viên",
  })
  batch(@Body() body: GraduationBatchDto, @Req() req: GraduationRequest) {
    return this.service.batch(body, req.graduationActor);
  }
  @Get(":id")
  detail(@Param("id") id: string, @Req() req: GraduationRequest) {
    return this.service.detail(id, req.graduationActor);
  }
  @Get(":id/lich-su")
  history(
    @Param("id") id: string,
    @Query() q: GraduationHistoryDto,
    @Req() req: GraduationRequest,
  ) {
    return this.service.history(id, q.page, req.graduationActor);
  }
  @Post(":id/minh-chung")
  @GraduationPermission("GRADUATION_EVIDENCE")
  evidence(
    @Param("id") id: string,
    @Body() body: GraduationEvidenceDto,
    @Req() req: GraduationRequest,
  ) {
    return this.service.saveEvidence(id, body, req.graduationActor);
  }
  @Post(":id/kiem-tra")
  @GraduationPermission("GRADUATION_CHECK")
  check(@Param("id") id: string, @Req() req: GraduationRequest) {
    return this.service.check(id, req.graduationActor);
  }
}
