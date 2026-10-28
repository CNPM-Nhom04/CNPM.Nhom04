export interface ReportFilter {
  actorId?: string;
  searchTerm?: string;
  selectedDegree?: string;
}
export interface ReportItem {
  id: string;
  maCTDT: string;
  tenCTDT: string;
  bacDaoTao: string;
  khoaQuanLy: string;
  tongTinChi: number;
  soHocVien: number;
  trangThai: string;
  status: string | null;
  programVersionId: string | null;
}
export interface ReportSummary {
  tongChuongTrinh: number;
  tongHocVien: number;
  tongHocPhan: number;
  tyLeHoanThanh: number;
}
export const REPORT_REPOSITORY = Symbol("REPORT_REPOSITORY");
export interface ReportRepository {
  findAll(
    filter: ReportFilter,
    offset?: number,
    limit?: number,
  ): Promise<ReportItem[]>;
  getSummary(filter: ReportFilter): Promise<ReportSummary>;
  getDegrees(): Promise<{ value: string; label: string }[]>;
}
