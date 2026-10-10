"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui";

interface XetDuyetItem {
  id: string;
  maCTDT: string;
  tenCTDT: string;
  khoaQuanLy: string;
  nguoiTao: string;
  ngayGui: string;
  trangThai: "CHO_DUYET" | "DA_DUYET" | "YEU_CAU_SUA";
}

const MOCK_APPROVAL_LIST: XetDuyetItem[] = [
  {
    id: "ctdt-02",
    maCTDT: "MS-CNPM-2026",
    tenCTDT: "Thạc sĩ Kỹ thuật Phần mềm",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    nguoiTao: "Nguyễn Đức Huy",
    ngayGui: "28/09/2026",
    trangThai: "CHO_DUYET",
  },
  {
    id: "ctdt-01",
    maCTDT: "MS-KHMT-2026",
    tenCTDT: "Thạc sĩ Khoa học Máy tính",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    nguoiTao: "Nguyễn Đức Huy",
    ngayGui: "02/10/2026",
    trangThai: "YEU_CAU_SUA",
  },
  {
    id: "ctdt-03",
    maCTDT: "PHD-KHMT-2025",
    tenCTDT: "Tiến sĩ Khoa học Máy tính",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    nguoiTao: "PGS.TS. Nguyễn Văn A",
    ngayGui: "15/08/2026",
    trangThai: "DA_DUYET",
  },
];

export default function XetDuyetDanhSachPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const getStatusBadge = (status: XetDuyetItem["trangThai"]) => {
    switch (status) {
      case "CHO_DUYET":
        return <Badge variant="pending">Chờ thẩm định</Badge>;
      case "DA_DUYET":
        return <Badge variant="approved">Đã phê duyệt</Badge>;
      case "YEU_CAU_SUA":
        return <Badge variant="rejected">Yêu cầu sửa đổi</Badge>;
      default:
        return <Badge variant="default">Khác</Badge>;
    }
  };

  const filteredData = MOCK_APPROVAL_LIST.filter((item) => {
    const matchesSearch =
      item.tenCTDT.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maCTDT.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThai === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-blue-600" />
            Xét Duyệt & Thẩm Định Chương Trình Đào Tạo
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Danh sách các chương trình đào tạo cần hội đồng khoa học xem xét và
            phê duyệt
          </p>
        </div>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên CTĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="CHO_DUYET">Chờ thẩm định</option>
            <option value="DA_DUYET">Đã phê duyệt</option>
            <option value="YEU_CAU_SUA">Yêu cầu sửa đổi</option>
          </select>
        </div>
      </div>

      {/* 3. Bảng danh sách */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-36 px-5 py-3.5">Mã CTĐT</th>
                <th className="w-96 px-5 py-3.5">Tên Chương Trình</th>
                <th className="w-44 px-5 py-3.5">Người Khởi Tạo</th>
                <th className="w-32 px-5 py-3.5">Ngày Gửi</th>
                <th className="w-36 px-5 py-3.5 text-center">Trạng Thái</th>
                <th className="w-32 px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 font-bold text-slate-800 truncate">
                      {item.maCTDT}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.tenCTDT}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        {item.khoaQuanLy}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.nguoiTao}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs truncate">
                      {item.ngayGui}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(item.trangThai)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/chuong-trinh-dao-tao/${item.id}/xet-duyet`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          Thẩm định
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy chương trình nào cần xét duyệt.
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
