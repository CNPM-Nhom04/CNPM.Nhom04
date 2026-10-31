import {
  Controller,
  Get,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import { ComparisonService } from "../application/comparison.service";
import {
  ComparisonDto,
  ComparisonOptionsDto,
} from "../application/comparison.dto";
import { ComparisonGuard, ComparisonRequest } from "./comparison.guard";
@ApiTags("Comparisons - So sánh CTĐT")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ComparisonGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
  }),
)
@Controller("so-sanh")
export class ComparisonController {
  constructor(private readonly service: ComparisonService) {}
  @Get("options")
  @ApiOperation({
    summary:
      "Phiên bản và hướng đào tạo trong phạm vi SQL; tìm kiếm, phân trang",
  })
  options(@Query() query: ComparisonOptionsDto, @Req() req: ComparisonRequest) {
    return this.service.options(req.user.userId, query);
  }
  @Get()
  @ApiOperation({
    summary: "So sánh hai phiên bản/hướng, đọc cùng một snapshot SQL",
  })
  compare(@Query() query: ComparisonDto, @Req() req: ComparisonRequest) {
    return this.service.compare(req.user.userId, query);
  }
  @Get("export")
  @ApiOperation({
    summary: "Xuất đối chiếu thật .xlsx, kiểm tra lại quyền và phạm vi",
  })
  async export(@Query() query: ComparisonDto, @Req() req: ComparisonRequest) {
    return new StreamableFile(
      await this.service.export(req.user.userId, query),
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        disposition: 'attachment; filename="so-sanh-ctdt.xlsx"',
      },
    );
  }
}
