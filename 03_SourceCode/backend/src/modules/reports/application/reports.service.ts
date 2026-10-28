import { Inject, Injectable } from "@nestjs/common";
import { Workbook } from "exceljs";
import { REPORT_REPOSITORY, ReportRepository } from "../domain/report";
import { ReportFilterDto, ReportQueryDto } from "./report-query.dto";

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPORT_REPOSITORY) private readonly repository: ReportRepository,
  ) {}

  async findAll(query: ReportQueryDto, actorId?: string) {
    const filter = actorId ? { ...query, actorId } : query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, summary] = await Promise.all([
      this.repository.findAll(filter, (page - 1) * limit, limit),
      this.repository.getSummary(filter),
    ]);
    return {
      data,
      meta: {
        page,
        limit,
        total: summary.tongChuongTrinh,
        totalPages: Math.ceil(summary.tongChuongTrinh / limit),
      },
      summary,
    };
  }

  getSummary(query: ReportFilterDto, actorId?: string) {
    return this.repository.getSummary(actorId ? { ...query, actorId } : query);
  }

  getDegrees() {
    return this.repository.getDegrees();
  }

  async exportExcel(query: ReportFilterDto, actorId?: string): Promise<Buffer> {
    const rows = await this.repository.findAll(
      actorId ? { ...query, actorId } : query,
    );
    const workbook = new Workbook();
    workbook.creator = "CTDT System";
    const sheet = workbook.addWorksheet("Báo cáo CTĐT");
    sheet.columns = [
      { header: "Mã CTĐT", key: "maCTDT", width: 25 },
      { header: "Tên chương trình đào tạo", key: "tenCTDT", width: 50 },
      { header: "Bậc đào tạo", key: "bacDaoTao", width: 20 },
      { header: "Đơn vị quản lý", key: "khoaQuanLy", width: 40 },
      { header: "Định mức tín chỉ", key: "tongTinChi", width: 20 },
      { header: "Sĩ số học viên", key: "soHocVien", width: 20 },
      { header: "Trạng thái", key: "trangThai", width: 25 },
    ];
    // ExcelJS writes strings as text cells, including input beginning with '='.
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:G1";
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
