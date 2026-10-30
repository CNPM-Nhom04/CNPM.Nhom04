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
import { CourseService } from "../application/course.service";
import {
  CourseQueryDto,
  CourseStatusDto,
  CreateCourseDto,
  ReviseCourseDto,
} from "../application/course.dto";
import { CourseGuard, CourseRequest, ManageCourses } from "./course.guard";
@ApiTags("Courses - Danh mục học phần")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CourseGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller("danh-muc-hoc-phan")
export class CourseController {
  constructor(private readonly service: CourseService) {}
  @Get()
  @ApiOperation({
    summary: "Danh mục theo phạm vi SQL; bản mới nhất và bản ACTIVE riêng biệt",
  })
  list(@Query() query: CourseQueryDto, @Req() req: CourseRequest) {
    return this.service.list(query, req.courseActor);
  }
  @Get("don-vi") units(@Req() req: CourseRequest) {
    return this.service.units(req.courseActor);
  }
  @Get(":id") detail(@Param("id") id: string, @Req() req: CourseRequest) {
    return this.service.detail(id, req.courseActor);
  }
  @Post()
  @ManageCourses()
  @ApiOperation({ summary: "Tạo học phần cùng bản DRAFT trong một giao dịch" })
  create(@Body() body: CreateCourseDto, @Req() req: CourseRequest) {
    return this.service.create(body, req.courseActor);
  }
  @Post(":id/phien-ban")
  @ManageCourses()
  @ApiOperation({
    summary: "Tạo bản sửa đổi DRAFT; giữ nguyên nội dung các bản cũ",
  })
  revise(
    @Param("id") id: string,
    @Body() body: ReviseCourseDto,
    @Req() req: CourseRequest,
  ) {
    return this.service.revise(id, body, req.courseActor);
  }
  @Post(":id/phien-ban/:versionId/kich-hoat")
  @ManageCourses()
  @ApiOperation({ summary: "Kích hoạt bản DRAFT mới nhất, nghỉ bản ACTIVE cũ" })
  activate(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Req() req: CourseRequest,
  ) {
    return this.service.activate(id, versionId, req.courseActor);
  }
  @Post(":id/trang-thai")
  @ManageCourses()
  @ApiOperation({ summary: "Khóa/mở sử dụng học phần, giữ lịch sử" })
  status(
    @Param("id") id: string,
    @Body() body: CourseStatusDto,
    @Req() req: CourseRequest,
  ) {
    return this.service.setStatus(
      id,
      body.status,
      body.expectedStatus,
      req.courseActor,
    );
  }
}
