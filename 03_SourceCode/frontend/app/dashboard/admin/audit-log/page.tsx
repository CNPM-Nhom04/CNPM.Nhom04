"use client";

import { useState } from "react";
import {
  History,
  Search,
  ShieldCheck,
  User,
  Calendar,
  FileText,
  Filter,
  Download,
} from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui";

interface AuditLogItem {
  id: string;
  thoiGian: string;
  nguoiThucHien: string;
  vaiTro: string;
  hanhDong: "CREATE" | "UPDATE" | "APPROVE" | "DELETE";
  moTa: string;
  diaChiIP: string;
}

const MOCK_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: "log-01",
    thoiGian: "10/10/2026 - 11:30:22",
    nguoiThucHien: "Nguyễn Đức Huy",
    vaiTro: "Cán bộ Đào tạo",
    hanhDong: "CREATE",
    moTa: "Khởi tạo mới Chương trình đào tạo: Thạc sĩ Khoa học Máy tính (MS-KHMT-2026)",
    diaChiIP: "192.168.1.45",
  },
  {
    id: "log-02",
    thoiGian: "09/10/2026 - 15:45:10",
    nguoiThucHien: "PGS.TS. Nguyễn Văn A",
    vaiTro: "Hội đồng Khoa học",
    hanhDong: "APPROVE",
    moTa: "Phê duyệt biên bản thẩm định cho CTĐT: Tiến sĩ Khoa học Máy tính (PHD-KHMT-2025)",
    diaChiIP: "192.168.1.88",
  },
  {
    id: "log-03",
    thoiGian: "08/10/2026 - 09:12:04",
    nguoiThucHien: "Trần Thị Phương Dung",
    vaiTro: "Quản trị viên",
    hanhDong: "UPDATE",
    moTa: "Cập nhật danh mục học phần dùng chung: Thêm học phần Trí tuệ Nhân tạo Nâng cao (CS701)",
    diaChiIP: "192.168.1.10",
  },
  {
    id: "log-04",
    thoiGian: "05/10/2026 - 14:20:55",
    nguoiThucHien: "Nguyễn Đức Huy",
    vaiTro: "Cán bộ Đào tạo",
    hanhDong: "DELETE",
    moTa: "Xóa học phần nháp khỏi ngân hàng học phần: Mã HP cũ (OLD-101)",
    diaChiIP: "192.168.1.45",
  },
];

export default function AuditLogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");

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
            Khác
          </span>
        );
    }
  };

  const filteredLogs = MOCK_AUDIT_LOGS.filter((item) => {
    const matchesSearch =
      item.nguoiThucHien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.moTa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.diaChiIP.includes(searchTerm);
    const matchesAction =
      selectedAction === "ALL" || item.hanhDong === selectedAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6 pb-16">
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
        <Button variant="outline" className="border-slate-300 text-slate-700">
          <Download className="h-4 w-4 mr-1.5 text-blue-600" />
          Xuất Nhật Ký (CSV/Excel)
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
                      {log.thoiGian}
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
                    Không tìm thấy bản ghi nhật ký phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
