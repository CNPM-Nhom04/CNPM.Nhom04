import {
  Controller,
  Req,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../../identity/presentation/jwt-auth.guard";
import {
  ReportFilterDto,
  ReportQueryDto,
} from "../application/report-query.dto";
import { ReportsService } from "../application/reports.service";

import { ReportsGuard } from "./reports.guard";
import { Request } from "express";
type ReportRequest = Request & { user: { userId: string } };

@ApiTags("Reports - Báo cáo")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Chưa đăng nhập hoặc JWT hết hạn" })
@ApiResponse({
  status: 400,
  description: "Bộ lọc hoặc phân trang không hợp lệ",
})
@UseGuards(JwtAuthGuard, ReportsGuard)
@Controller("bao-cao")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: "Danh sách báo cáo CTĐT, phân trang và thống kê theo bộ lọc",
  })
  findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ReportQueryDto,
    @Req() request: ReportRequest,
  ) {
    return this.service.findAll(query, request.user.userId);
  }

  @Get("thong-ke")
  @ApiOperation({ summary: "Bốn chỉ số thống kê cho thẻ trên giao diện" })
  getSummary(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ReportFilterDto,
    @Req() request: ReportRequest,
  ) {
    return this.service.getSummary(query, request.user.userId);
  }

  @Get("bac-dao-tao")
  @ApiOperation({ summary: "Danh sách bậc đào tạo từ CSDL cho bộ lọc" })
  getDegrees() {
    return this.service.getDegrees();
  }

  @Get("xuat-excel")
  @ApiOperation({ summary: "Xuất toàn bộ kết quả theo bộ lọc thành file XLSX" })
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  async exportExcel(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ReportFilterDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: ReportRequest,
  ) {
    const buffer = await this.service.exportExcel(query, request.user.userId);
    response.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Bao_Cao_Tong_Hop_CTDT_SDH.xlsx"',
      "Cache-Control": "no-store",
    });
    return new StreamableFile(buffer);
  }
}
 
