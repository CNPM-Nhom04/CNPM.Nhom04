"use client";

import { useState } from "react";
import { GitCompare, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui";

export default function SoSanhCTDTPage() {
  // Trạng thái chọn 2 chương trình để so sánh
  const [ctdtA, setCtdtA] = useState("MS-KHMT-2026");
  const [ctdtB, setCtdtB] = useState("MS-CNPM-2026");

  // Dữ liệu mẫu mô phỏng thông tin 2 CTĐT được chọn
  const dataMap: Record<string, any> = {
    "MS-KHMT-2026": {
      ma: "MS-KHMT-2026",
      ten: "Thạc sĩ Khoa học Máy tính",
      khoa: "Khoa Công nghệ Thông tin",
      khoaTuyenSinh: "2026 - 2028",
      tongTinChi: 60,
      chuanNgoaiNgu: "VSTEP B2 / IELTS 6.0",
      hinhThuc: "Chính quy",
      soHocPhan: 18,
      trangThai: "Bản nháp",
    },
    "MS-CNPM-2026": {
      ma: "MS-CNPM-2026",
      ten: "Thạc sĩ Kỹ thuật Phần mềm",
      khoa: "Khoa Công nghệ Thông tin",
      khoaTuyenSinh: "2026 - 2028",
      tongTinChi: 60,
      chuanNgoaiNgu: "VSTEP B2 / IELTS 6.0",
      hinhThuc: "Chính quy",
      soHocPhan: 20,
      trangThai: "Chờ duyệt",
    },
    "PHD-KHMT-2025": {
      ma: "PHD-KHMT-2025",
      ten: "Tiến sĩ Khoa học Máy tính",
      khoa: "Khoa Công nghệ Thông tin",
      khoaTuyenSinh: "2025 - 2029",
      tongTinChi: 90,
      chuanNgoaiNgu: "IELTS 6.5 trở lên",
      hinhThuc: "Chính quy tập trung",
      soHocPhan: 25,
      trangThai: "Đã ban hành",
    },
  };

  const infoA = dataMap[ctdtA] || dataMap["MS-KHMT-2026"];
  const infoB = dataMap[ctdtB] || dataMap["MS-CNPM-2026"];

  // Dữ liệu chi tiết các học phần đối chiếu
  const comparisonDetails = [
    {
      ma: "KTM701",
      ten: "Học máy nâng cao",
      tinChi: 3,
      coA: "Có",
      coB: "Có",
      ghiChu: "Giữ nguyên khối lượng",
    },
    {
      ma: "KTPM702",
      ten: "Kiến trúc phần mềm hướng dịch vụ",
      tinChi: 3,
      coA: "Có",
      coB: "Có",
      ghiChu: "Cập nhật nội dung Microservices",
    },
    {
      ma: "DL703",
      ten: "Xử lý dữ liệu lớn (Big Data)",
      tinChi: 4,
      coA: "Không",
      coB: "Có",
      ghiChu: "Môn mới bổ sung ở CTĐT B",
    },
    {
      ma: "AI704",
      ten: "Đạo đức trí tuệ nhân tạo",
      tinChi: 2,
      coA: "Có",
      coB: "Không",
      ghiChu: "Lược bỏ ở CTĐT B",
    },
  ];

  // Hàm xử lý xuất Excel (CSV định dạng chuẩn UTF-8 hỗ trợ tiếng Việt)
  const handleExportExcel = () => {
    const headers = [
      "Mã HP",
      "Tên Học Phần",
      "Số TC",
      `CTĐT A (${infoA.ma})`,
      `CTĐT B (${infoB.ma})`,
      "Ghi Chú Thay Đổi",
    ];

    const rows = comparisonDetails.map((item) => [
      item.ma,
      item.ten,
      item.tinChi,
      item.coA,
      item.coB,
      item.ghiChu,
    ]);

    // Thêm BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt không bị lỗi font
    let csvContent =
      "\uFEFF" +
      [
        headers.join(","),
        ...rows.map((e) => e.map((val) => `"${val}"`).join(",")),
      ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Bao_Cao_So_Sanh_${infoA.ma}_vs_${infoB.ma}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-blue-600" />
            So Sánh Cấu Trúc Chương Trình Đào Tạo
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Đối chiếu song song giữa 2 phiên bản hoặc 2 định hướng chuyên ngành
            khác nhau
          </p>
        </div>
        <Button
          onClick={handleExportExcel}
          variant="outline"
          className="border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
          Xuất Báo Cáo So Sánh (Excel)
        </Button>
      </div>

      {/* 2. Bộ chọn 2 CTĐT để so sánh */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Lựa chọn A */}
        <div className="space-y-2 p-4 rounded-lg bg-blue-50/50 border border-blue-100">
          <label className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
            Chương Trình Gốc (Bản A)
          </label>
          <select
            value={ctdtA}
            onChange={(e) => setCtdtA(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="MS-KHMT-2026">
              MS-KHMT-2026: Thạc sĩ Khoa học Máy tính
            </option>
            <option value="MS-CNPM-2026">
              MS-CNPM-2026: Thạc sĩ Kỹ thuật Phần mềm
            </option>
            <option value="PHD-KHMT-2025">
              PHD-KHMT-2025: Tiến sĩ Khoa học Máy tính
            </option>
          </select>
        </div>

        {/* Lựa chọn B */}
        <div className="space-y-2 p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
          <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
            Chương Trình Đối Chéo (Bản B)
          </label>
          <select
            value={ctdtB}
            onChange={(e) => setCtdtB(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="MS-KHMT-2026">
              MS-KHMT-2026: Thạc sĩ Khoa học Máy tính
            </option>
            <option value="MS-CNPM-2026">
              MS-CNPM-2026: Thạc sĩ Kỹ thuật Phần mềm
            </option>
            <option value="PHD-KHMT-2025">
              PHD-KHMT-2025: Tiến sĩ Khoa học Máy tính
            </option>
          </select>
        </div>
      </div>

      {/* 3. Bảng đối chiếu thông số tổng quan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200">
          <h2 className="font-bold text-slate-800 text-sm">
            Bảng Đối Chiếu Thông Số Tổng Quan
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-64 px-6 py-3">Tiêu Chí So Sánh</th>
                <th className="px-6 py-3 text-blue-700 bg-blue-50/40">
                  {infoA.ten} ({infoA.ma})
                </th>
                <th className="px-6 py-3 text-emerald-700 bg-emerald-50/40">
                  {infoB.ten} ({infoB.ma})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Đơn vị quản lý
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-blue-50/20">
                  {infoA.khoa}
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-emerald-50/20">
                  {infoB.khoa}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Khóa tuyển sinh áp dụng
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-blue-50/20">
                  {infoA.khoaTuyenSinh}
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-emerald-50/20">
                  {infoB.khoaTuyenSinh}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Tổng định mức tín chỉ
                </td>
                <td className="px-6 py-3.5 font-bold text-blue-600 bg-blue-50/20">
                  {infoA.tongTinChi} TC
                </td>
                <td
                  className={`px-6 py-3.5 font-bold bg-emerald-50/20 ${infoA.tongTinChi !== infoB.tongTinChi ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {infoB.tongTinChi} TC{" "}
                  {infoA.tongTinChi !== infoB.tongTinChi && "(Khác biệt)"}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Chuẩn đầu ra ngoại ngữ
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-blue-50/20">
                  {infoA.chuanNgoaiNgu}
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-emerald-50/20">
                  {infoB.chuanNgoaiNgu}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Hình thức đào tạo
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-blue-50/20">
                  {infoA.hinhThuc}
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-emerald-50/20">
                  {infoB.hinhThuc}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-3.5 text-slate-500 font-normal">
                  Tổng số học phần trong cấu trúc
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-blue-50/20">
                  {infoA.soHocPhan} học phần
                </td>
                <td className="px-6 py-3.5 text-slate-900 bg-emerald-50/20">
                  {infoB.soHocPhan} học phần
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
