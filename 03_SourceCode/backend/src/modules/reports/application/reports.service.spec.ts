import { Readable } from "stream";
import { Workbook } from "exceljs";
import { ReportItem, ReportRepository } from "../domain/report";
import { ReportsService } from "./reports.service";
import { ReportQueryDto } from "./report-query.dto";

describe("ReportsService", () => {
  const item: ReportItem = {
    id: "9007199254740993",
    maCTDT: "=1+1",
    tenCTDT: "Thạc sĩ Khoa học Máy tính",
    bacDaoTao: "Thạc sĩ",
    khoaQuanLy: "Khoa CNTT",
    tongTinChi: 60,
    soHocVien: 45,
    trangThai: "Đã ban hành",
    status: "PUBLISHED",
    programVersionId: "2",
  };
  const summary = {
    tongChuongTrinh: 21,
    tongHocVien: 45,
    tongHocPhan: 24,
    tyLeHoanThanh: 50,
  };
  let repository: jest.Mocked<ReportRepository>;
  let service: ReportsService;
  beforeEach(() => {
    repository = {
      findAll: jest.fn().mockResolvedValue([item]),
      getSummary: jest.fn().mockResolvedValue(summary),
      getDegrees: jest
        .fn()
        .mockResolvedValue([{ value: "MASTER", label: "Thạc sĩ" }]),
    };
    service = new ReportsService(repository);
  });

  it("paginates rows while keeping summary across all matching programs", async () => {
    const query = Object.assign(new ReportQueryDto(), {
      page: 2,
      limit: 20,
      selectedDegree: "Thạc sĩ",
    });
    const result = await service.findAll(query);
    expect(repository.findAll).toHaveBeenCalledWith(query, 20, 20);
    expect(result).toEqual({
      data: [item],
      summary,
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    expect(result.data[0].id).toBe("9007199254740993");
  });

  it("returns zero pages for an empty report", async () => {
    repository.findAll.mockResolvedValue([]);
    repository.getSummary.mockResolvedValue({ ...summary, tongChuongTrinh: 0 });
    expect((await service.findAll(new ReportQueryDto())).meta.totalPages).toBe(
      0,
    );
  });

  it("exports all matching rows as a valid workbook with Unicode and numeric cells", async () => {
    const filter = { selectedDegree: "MASTER", searchTerm: "Máy tính" };
    const buffer = await service.exportExcel(filter);
    expect(repository.findAll).toHaveBeenCalledWith(filter);
    const workbook = new Workbook();
    await workbook.xlsx.read(Readable.from([buffer]));
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell("A2").value).toBe("=1+1");
    expect(sheet.getCell("A2").type).toBe(3); // string, never an executable formula
    expect(sheet.getCell("B2").value).toBe(item.tenCTDT);
    expect(sheet.getCell("E2").value).toBe(60);
    expect(sheet.getCell("F2").value).toBe(45);
    expect(sheet.getCell("G2").value).toBe("Đã ban hành");
  });

  it("exports headers even when no programs match", async () => {
    repository.findAll.mockResolvedValue([]);
    const workbook = new Workbook();
    await workbook.xlsx.read(Readable.from([await service.exportExcel({})]));
    expect(workbook.worksheets[0].rowCount).toBe(1);
  });
});
