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
  constructor(private readonly service: GradeService) {}
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
  @Post() @GradePermission() create(
    @Body() b: CreateGradeDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.create(b, r.gradeActor);
  }
  @Post(":id/cap-nhat") @GradePermission() update(
    @Param("id") id: string,
    @Body() b: UpdateGradeDto,
    @Req() r: GradeRequest,
  ) {
    return this.service.update(id, b, r.gradeActor);
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
