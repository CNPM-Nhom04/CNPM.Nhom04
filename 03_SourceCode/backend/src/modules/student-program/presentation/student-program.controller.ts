import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { StudentProgramService } from "../application/student-program.service";
import {
  StudentProgramGuard,
  StudentProgramRequest,
} from "./student-program.guard";
@ApiTags("Students - CTĐT cá nhân")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StudentProgramGuard)
@Controller("sinh-vien/chuong-trinh-dao-tao")
export class StudentProgramController {
  constructor(private readonly service: StudentProgramService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization")
  @ApiOperation({
    summary:
      "CTĐT đang được phân công cho học viên của tài khoản đăng nhập; không nhận studentId/userId",
  })
  own(@Req() req: StudentProgramRequest) {
    if (Object.keys(req.query).length)
      throw new BadRequestException(
        "API cá nhân không nhận tham số chọn học viên hoặc CTĐT.",
      );
    return this.service.own(req.user.userId);
  }
}
