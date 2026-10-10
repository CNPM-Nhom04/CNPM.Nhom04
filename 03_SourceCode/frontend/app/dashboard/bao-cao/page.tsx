"use client";

import { useState } from "react";
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

interface BaoCaoItem {
  id: string;
  maCTDT: string;
  tenCTDT: string;
  bacDaoTao: string;
  khoaQuanLy: string;
  tongTinChi: number;
  soHocVien: number;
  trangThai: string;
}

const MOCK_BAO_CAO_DATA: BaoCaoItem[] = [
  {
    id: "bc-01",
    maCTDT: "MS-KHMT-2026",
    tenCTDT: "Thạc sĩ Khoa học Máy tính",
    bacDaoTao: "Thạc sĩ",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    tongTinChi: 60,
    soHocVien: 45,
    trangThai: "Đã ban hành",
  },
  {
    id: "bc-02",
    maCTDT: "MS-CNPM-2026",
    tenCTDT: "Thạc sĩ Kỹ thuật Phần mềm",
    bacDaoTao: "Thạc sĩ",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    tongTinChi: 60,
    soHocVien: 38,
    trangThai: "Chờ duyệt",
  },
  {
    id: "bc-03",
    maCTDT: "PHD-KHMT-2025",
    tenCTDT: "Tiến sĩ Khoa học Máy tính",
    bacDaoTao: "Tiến sĩ",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    tongTinChi: 90,
    soHocVien: 12,
    trangThai: "Đã ban hành",
  },
];

export default function BaoCaoPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDegree, setSelectedDegree] = useState("ALL");

  const filteredData = MOCK_BAO_CAO_DATA.filter((item) => {
    const matchesSearch =
      item.tenCTDT.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maCTDT.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDegree =
      selectedDegree === "ALL" || item.bacDaoTao === selectedDegree;
    return matchesSearch && matchesDegree;
  });

  const handleExportExcel = () => {
    const headers = [
      "Mã CTĐT",
      "Tên Chương Trình Đào Tạo",
      "Bậc Đào Tạo",
      "Đơn Vị Quản Lý",
      "Định Mức Tín Chỉ",
      "Sĩ Số Học Viên",
      "Trạng Thái",
    ];
    const rows = filteredData.map((item) => [
      item.maCTDT,
      item.tenCTDT,
      item.bacDaoTao,
      item.khoaQuanLy,
      `${item.tongTinChi} TC`,
      `${item.soHocVien} HV`,
      item.trangThai,
    ]);

    const csvContent =
      "\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) => e.map((val) => `"${val}"`).join(",")),
      ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_Cao_Tong_Hop_CTDT_SDH.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-16">
      {/* CSS ẩn Sidebar và các nút điều hướng khi in báo cáo */}
      <style jsx global>{`
        @media print {
          aside,
          nav,
          header,
          button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

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
            className="border-slate-300 text-slate-700 text-xs cursor-pointer"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            In Báo Cáo
          </Button>
          <Button
            onClick={handleExportExcel}
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
              03 Chương trình
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tổng học viên SĐH
            </p>
            <h3 className="text-xl font-bold text-emerald-600">95 Học viên</h3>
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
            <h3 className="text-xl font-bold text-slate-900">24 Học phần</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Tỷ lệ hoàn thành
            </p>
            <h3 className="text-xl font-bold text-amber-600">92.5%</h3>
          </div>
        </div>
      </div>

      {/* 3. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên chương trình..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDegree}
            onChange={(e) => setSelectedDegree(e.target.value)}
            className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả bậc đào tạo</option>
            <option value="Thạc sĩ">Thạc sĩ</option>
            <option value="Tiến sĩ">Tiến sĩ</option>
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
    </div>
  );
}
