"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  Search,
  Printer,
  BarChart3,
  Layers,
  BookOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  getReports,
  getReportDegrees,
  downloadReport,
  getAllReportRows,
  ReportApiError,
  type BaoCaoItem,
  type ReportResult,
} from "@/lib/services/reportService";

export default function BaoCaoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDegree, setSelectedDegree] = useState("ALL");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [degrees, setDegrees] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printRows, setPrintRows] = useState<BaoCaoItem[] | null>(null);
  const [error, setError] = useState("");
  const [degreeError, setDegreeError] = useState("");
  const [actionError, setActionError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const filteredData = printRows ?? report?.data ?? [];
  const summary = loading || error ? null : report?.summary;
  const filter = { searchTerm: searchTerm.trim(), selectedDegree };

  useEffect(() => {
    const controller = new AbortController();
    // Cancel requests for outdated search text/page changes.
    const timer = window.setTimeout(() => {
      getReports(
        { searchTerm: searchTerm.trim(), selectedDegree },
        page,
        20,
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setReport(result);
          setError("");
          setNeedsLogin(false);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setReport(null);
          setError(
            reason instanceof Error ? reason.message : "Không thể tải báo cáo.",
          );
          setNeedsLogin(
            reason instanceof ReportApiError && reason.status === 401,
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, selectedDegree, page, refresh]);

  useEffect(() => {
    const controller = new AbortController();
    getReportDegrees(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDegrees(result);
          setDegreeError("");
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setDegreeError(
            reason instanceof Error
              ? reason.message
              : "Không thể tải bậc đào tạo.",
          );
        }
      });
    return () => controller.abort();
  }, [refresh]);

  function retry() {
    setLoading(true);
    setError("");
    setActionError("");
    setRefresh((value) => value + 1);
  }

  function showActionError(reason: unknown) {
    setActionError(
      reason instanceof Error ? reason.message : "Không thể thực hiện yêu cầu.",
    );
    if (reason instanceof ReportApiError && reason.status === 401)
      setNeedsLogin(true);
  }

  async function handleExportExcel() {
    setExporting(true);
    setActionError("");
    try {
      await downloadReport(filter);
    } catch (reason) {
      showActionError(reason);
    } finally {
      setExporting(false);
    }
  }

  async function handlePrint() {
    setPrinting(true);
    setActionError("");
    try {
      const rows = await getAllReportRows(filter);
      flushSync(() => setPrintRows(rows));
      window.print();
    } catch (reason) {
      showActionError(reason);
    } finally {
      setPrintRows(null);
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* CSS ẩn Sidebar và các nút điều hướng khi in báo cáo */}
      <style jsx global>{`
        @media print {
          aside,
          nav,
          header,
          button,
          [data-report-controls] {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }
          html,
          body,
          .h-screen,
          .overflow-hidden,
          .overflow-y-auto {
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {(error || actionError || degreeError) && (
        <div
          role="alert"
          data-report-controls
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{error || actionError || degreeError}</p>
          {needsLogin ? (
            <Link
              href="/dang-nhap?next=/dashboard/bao-cao"
              className="mt-2 inline-block font-semibold underline"
            >
              Đăng nhập để xem báo cáo
            </Link>
          ) : (
            <Button
              onClick={retry}
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={loading}
            >
              Thử lại
            </Button>
          )}
        </div>
      )}

      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            Tra Cứu & Báo Cáo Thống Kê Tổng Hợp
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Trích xuất dữ liệu đào tạo, thống kê số liệu tín chỉ và học viên
            toàn hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            isLoading={printing}
            disabled={loading || !!error || !report?.meta.total || exporting}
            className="border-slate-300 text-slate-700 text-xs cursor-pointer"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            In Báo Cáo
          </Button>
          <Button
            onClick={handleExportExcel}
            isLoading={exporting}
            disabled={loading || !!error || !report?.meta.total || printing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Xuất Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* 2. Thẻ thống kê nhanh */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tổng số CTĐT
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              {summary?.tongChuongTrinh ?? "—"} Chương trình
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tổng học viên
            </p>
            <h3 className="text-xl font-bold text-emerald-600">
              {summary?.tongHocVien ?? "—"} Học viên
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Học phần ngân hàng
            </p>
            <h3 className="text-xl font-bold text-slate-900">
              {summary?.tongHocPhan ?? "—"} Học phần
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tỷ lệ CTĐT đã ban hành
            </p>
            <h3 className="text-xl font-bold text-amber-600">
              {summary ? summary.tyLeHoanThanh + "%" : "—"}
            </h3>
          </div>
        </div>
      </div>

      {/* 3. Bộ lọc & Tìm kiếm */}
      <div
        data-report-controls
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên chương trình..."
            value={searchTerm}
            disabled={printing || exporting}
            maxLength={255}
            aria-label="Tìm theo mã hoặc tên chương trình"
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
              setLoading(true);
              setActionError("");
            }}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDegree}
            disabled={printing || exporting}
            aria-label="Bậc đào tạo"
            onChange={(e) => {
              setSelectedDegree(e.target.value);
              setPage(1);
              setLoading(true);
              setActionError("");
            }}
            className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả bậc đào tạo</option>
            {degrees.map((degree) => (
              <option key={degree.value} value={degree.value}>
                {degree.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Bảng dữ liệu báo cáo */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-36 px-5 py-3.5">Mã CTĐT</th>
                <th className="w-80 px-5 py-3.5">Tên Chương Trình Đào Tạo</th>
                <th className="w-32 px-5 py-3.5">Bậc Đào Tạo</th>
                <th className="w-48 px-5 py-3.5">Đơn Vị Quản Lý</th>
                <th className="w-28 px-5 py-3.5 text-center">Định Mức</th>
                <th className="w-28 px-5 py-3.5 text-center">Sĩ Số</th>
                <th className="w-36 px-5 py-3.5 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody aria-busy={loading} className="divide-y divide-slate-100">
              {loading || error ? (
                <tr>
                  <td
                    colSpan={7}
                    role="status"
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    {loading
                      ? "Đang tải dữ liệu báo cáo..."
                      : "Không thể tải dữ liệu. Vui lòng thử lại."}
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 font-bold text-slate-800 truncate">
                      {item.maCTDT}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                      {item.tenCTDT}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.bacDaoTao}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs truncate">
                      {item.khoaQuanLy}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-blue-600">
                      {item.tongTinChi} TC
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-800">
                      {item.soHocVien} HV
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.trangThai === "Đã ban hành"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {item.trangThai}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy dữ liệu báo cáo phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        data-report-controls
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
      >
        <span>
          {loading
            ? "Đang tải..."
            : error
              ? "Chưa tải được báo cáo"
              : `Tổng ${report?.meta.total ?? 0} chương trình`}
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || printing || exporting || !!error || page <= 1}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            Trang trước
          </Button>
          <span>
            Trang {report?.meta.totalPages ? page : 0} /{" "}
            {report?.meta.totalPages ?? 0}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={
              loading ||
              printing ||
              exporting ||
              !!error ||
              page >= (report?.meta.totalPages ?? 0)
            }
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}
