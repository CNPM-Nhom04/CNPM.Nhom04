"use client";

import { useState } from "react";
import {
  exportAudit,
  type AuditItem as AuditLogItem,
} from "@/lib/services/adminService";
import { useAdminList } from "@/lib/hooks/useAdminList";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
import { History, Search, Download } from "lucide-react";
import { Button } from "@/components/ui";

export default function AuditLogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");

  const list = useAdminList<AuditLogItem>(
    "audit-log",
    searchTerm,
    "selectedAction",
    selectedAction,
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await exportAudit(
        new URLSearchParams({ searchTerm: searchTerm.trim(), selectedAction }),
      );
    } catch (reason) {
      setExportError(
        reason instanceof Error ? reason : new Error("Không thể xuất nhật ký."),
      );
    } finally {
      setExporting(false);
    }
  }

  const getActionBadge = (action: AuditLogItem["hanhDong"]) => {
    switch (action) {
      case "CREATE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Thêm mới
          </span>
        );
      case "UPDATE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Cập nhật
          </span>
        );
      case "APPROVE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Phê duyệt
          </span>
        );
      case "DELETE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Xóa
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700">
            {(
              {
                SUBMIT: "Gửi duyệt",
                COPY: "Sao chép",
                ARCHIVE: "Lưu trữ",
                ROLE_ASSIGN: "Gán vai trò",
                LOGIN_FAILED: "Đăng nhập thất bại",
                LOGIN_SUCCESS: "Đăng nhập",
                LOGOUT: "Đăng xuất",
                CHANGE_PASSWORD: "Đổi mật khẩu",
                RESET_PASSWORD: "Đặt lại mật khẩu",
              } as Record<string, string>
            )[action] || action}
          </span>
        );
    }
  };

  const filteredLogs = list.data;

  return (
    <div className="space-y-6 pb-16">
      <AdminFeedback error={list.error || exportError} retry={list.refresh} />
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            Nhật Ký Hệ Thống & Giám Sát Hoạt Động (Audit Log)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi dấu vết thao tác của người dùng và lịch sử thay đổi dữ liệu
            toàn hệ thống
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          isLoading={exporting}
          disabled={list.loading || !!list.error}
          className="border-slate-300 text-slate-700"
        >
          <Download className="h-4 w-4 mr-1.5 text-blue-600" />
          Xuất Nhật Ký (.xlsx)
        </Button>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên người thực hiện, nội dung, IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full md:w-48 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="CREATE">Thêm mới</option>
            <option value="UPDATE">Cập nhật</option>
            <option value="APPROVE">Phê duyệt</option>
            <option value="DELETE">Xóa</option>
            <option value="SUBMIT">Gửi duyệt</option>
            <option value="COPY">Sao chép</option>
            <option value="ROLE_ASSIGN">Gán vai trò</option>
            <option value="ARCHIVE">Lưu trữ</option>
            <option value="LOGIN_SUCCESS">Đăng nhập thành công</option>
            <option value="LOGOUT">Đăng xuất</option>
            <option value="LOGIN_FAILED">Đăng nhập thất bại</option>
          </select>
        </div>
      </div>

      {/* 3. Bảng nhật ký */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-44 px-5 py-3.5">Thời Gian</th>
                <th className="w-48 px-5 py-3.5">Người Thực Hiện</th>
                <th className="w-32 px-5 py-3.5 text-center">Hành Động</th>
                <th className="px-5 py-3.5">Nội Dung Chi Tiết Thay Đổi</th>
                <th className="w-32 px-5 py-3.5">Địa Chỉ IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600 truncate">
                      {new Date(log.thoiGian).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">
                        {log.nguoiThucHien}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        {log.vaiTro}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getActionBadge(log.hanhDong)}
                    </td>
                    <td className="px-5 py-4 text-slate-800 text-sm font-medium">
                      {log.moTa}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-500 truncate">
                      {log.diaChiIP}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    {list.loading
                      ? "Đang tải nhật ký..."
                      : list.error
                        ? "Không thể tải nhật ký."
                        : "Không tìm thấy bản ghi nhật ký phù hợp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination
        meta={list.meta}
        page={list.page}
        loading={list.loading}
        changePage={list.changePage}
      />
    </div>
  );
}
 
