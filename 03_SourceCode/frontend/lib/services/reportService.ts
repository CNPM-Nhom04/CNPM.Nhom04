export interface BaoCaoItem {
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
export interface ReportResult {
  data: BaoCaoItem[];
  summary: ReportSummary;
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface ReportFilter {
  searchTerm: string;
  selectedDegree: string;
}
export class ReportApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function reportRequest(
  path: string,
  params?: URLSearchParams,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `/api/bao-cao${path}${params ? "?" + params : ""}`,
    {
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ReportApiError(
      body?.message || "Không thể tải báo cáo. Vui lòng thử lại.",
      response.status,
    );
  }
  return response;
}

export async function getReports(
  filter: ReportFilter,
  page = 1,
  limit = 20,
  signal?: AbortSignal,
): Promise<ReportResult> {
  const params = new URLSearchParams({
    ...filter,
    page: String(page),
    limit: String(limit),
  });
  return (await reportRequest("", params, signal)).json();
}

export async function getReportDegrees(
  signal?: AbortSignal,
): Promise<{ value: string; label: string }[]> {
  return (await reportRequest("/bac-dao-tao", undefined, signal)).json();
}

export async function downloadReport(filter: ReportFilter) {
  const response = await reportRequest(
    "/xuat-excel",
    new URLSearchParams({ ...filter }),
  );
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "Bao_Cao_Tong_Hop_CTDT_SDH.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser start reading the download before releasing its URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getAllReportRows(
  filter: ReportFilter,
): Promise<BaoCaoItem[]> {
  const first = await getReports(filter, 1, 100);
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page++) {
    rows.push(...(await getReports(filter, page, 100)).data);
  }
  return rows;
}
