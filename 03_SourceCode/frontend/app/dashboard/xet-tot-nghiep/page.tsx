"use client";

import { useState } from "react";
import {
  Award,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  GraduationCap,
  FileText,
  Eye,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface TotNghiepItem {
  id: string;
  maHocVien: string;
  hoTen: string;
  bacDaoTao: "THAC_SI" | "TIEN_SI";
  chuyenNganh: string;
  tinChiTichLuy: number;
  yeuCauTinChi: number;
  diemTrungBinh: number;
  ngoaiNgu: string;
  baoVeLuanVan: "DAT" | "CHUA_DAT" | "CHO_BAO_VE";
  trangThaiXet: "DU_DIEN_KIEN" | "CHUA_DU_DIEN_KIEN" | "DANG_XET";
}

const MOCK_XET_TOT_NGHIEP: TotNghiepItem[] = [
  {
    id: "tn-01",
    maHocVien: "SDH2026-01",
    hoTen: "Lê Văn Nam",
    bacDaoTao: "THAC_SI",
    chuyenNganh: "Thạc sĩ Khoa học Máy tính",
    tinChiTichLuy: 62,
    yeuCauTinChi: 60,
    diemTrungBinh: 8.4,
    ngoaiNgu: "VSTEP B2 (Đạt)",
    baoVeLuanVan: "DAT",
    trangThaiXet: "DU_DIEN_KIEN",
  },
  {
    id: "tn-02",
    maHocVien: "SDH2025-08",
    hoTen: "Phạm Thị Mai",
    bacDaoTao: "THAC_SI",
    chuyenNganh: "Thạc sĩ Kỹ thuật Phần mềm",
    tinChiTichLuy: 58,
    yeuCauTinChi: 60,
    diemTrungBinh: 7.2,
    ngoaiNgu: "IELTS 5.5 (Chưa đạt)",
    baoVeLuanVan: "CHO_BAO_VE",
    trangThaiXet: "CHUA_DU_DIEN_KIEN",
  },
  {
    id: "tn-03",
    maHocVien: "PHD2024-02",
    hoTen: "Hoàng Minh Quân",
    bacDaoTao: "TIEN_SI",
    chuyenNganh: "Tiến sĩ Khoa học Máy tính",
    tinChiTichLuy: 94,
    yeuCauTinChi: 90,
    diemTrungBinh: 8.9,
    ngoaiNgu: "IELTS 7.0 (Đạt)",
    baoVeLuanVan: "DAT",
    trangThaiXet: "DU_DIEN_KIEN",
  },
];

export default function XetTotNghiepPage() {
  const [dataList, setDataList] =
    useState<TotNghiepItem[]>(MOCK_XET_TOT_NGHIEP);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // States Modal chi tiết và Modal chạy tự động
  const [selectedItem, setSelectedItem] = useState<TotNghiepItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRunAutoModalOpen, setIsRunAutoModalOpen] = useState(false);
  const [selectedBacKiemTra, setSelectedBacKiemTra] = useState("THAC_SI");
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusBadge = (status: TotNghiepItem["trangThaiXet"]) => {
    switch (status) {
      case "DU_DIEN_KIEN":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đủ điều kiện tốt nghiệp
          </span>
        );
      case "CHUA_DU_DIEN_KIEN":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Chưa đủ điều kiện
          </span>
        );
      case "DANG_XET":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Đang xét duyệt
          </span>
        );
      default:
        return null;
    }
  };

  const filteredData = dataList.filter((item) => {
    const matchesSearch =
      item.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maHocVien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.chuyenNganh.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThaiXet === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDetail = (item: TotNghiepItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  // Hàm thực thi thuật toán quét điều kiện tự động
  const handleExecuteAutoCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      // Cập nhật lại trạng thái dựa trên quy tắc tự động
      setDataList(
        dataList.map((item) => {
          if (item.bacDaoTao === selectedBacKiemTra) {
            const isEligible =
              item.tinChiTichLuy >= item.yeuCauTinChi &&
              item.diemTrungBinh >= 7.0 &&
              item.baoVeLuanVan === "DAT";
            return {
              ...item,
              trangThaiXet: isEligible ? "DU_DIEN_KIEN" : "CHUA_DU_DIEN_KIEN",
            };
          }
          return item;
        }),
      );
      setIsProcessing(false);
      setIsRunAutoModalOpen(false);
      alert(
        "Đã hoàn tất chạy kiểm tra tự động chuẩn đầu ra cho toàn bộ học viên!",
      );
    }, 800);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-600" />
            Xét Điều Kiện Tốt Nghiệp & Cấp Bằng SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kiểm tra tự động các tiêu chí chuẩn đầu ra: tín chỉ tích lũy, điểm
            trung bình, ngoại ngữ và luận văn
          </p>
        </div>
        <Button
          onClick={() => setIsRunAutoModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Chạy Kiểm Tra Tự Động
        </Button>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, tên học viên, chuyên ngành..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-full md:w-56 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả trạng thái xét</option>
          <option value="DU_DIEN_KIEN">Đủ điều kiện tốt nghiệp</option>
          <option value="CHUA_DU_DIEN_KIEN">Chưa đủ điều kiện</option>
        </select>
      </div>

      {/* 3. Bảng dữ liệu xét tốt nghiệp */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã HV</th>
                <th className="w-56 px-5 py-3.5">Học Viên & Chuyên Ngành</th>
                <th className="w-32 px-4 py-3.5 text-center">
                  Tín Chỉ Tích Lũy
                </th>
                <th className="w-28 px-4 py-3.5 text-center">ĐTB Thang 10</th>
                <th className="px-5 py-3.5">Chuẩn Ngoại Ngữ</th>
                <th className="w-48 px-5 py-3.5 text-center">
                  Trạng Thái Xét Tốt Nghiệp
                </th>
                <th className="w-28 px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 font-bold text-blue-600 truncate">
                      {item.maHocVien}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.hoTen}
                      </div>
                      <div className="text-xs text-slate-400 font-medium truncate">
                        {item.chuyenNganh}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-slate-700">
                      <span
                        className={
                          item.tinChiTichLuy >= item.yeuCauTinChi
                            ? "text-emerald-600 font-bold"
                            : "text-red-600 font-bold"
                        }
                      >
                        {item.tinChiTichLuy}
                      </span>{" "}
                      / {item.yeuCauTinChi}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">
                      {item.diemTrungBinh}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.ngoaiNgu}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(item.trangThaiXet)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(item)}
                        className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Chi tiết
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy học viên phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Chạy Kiểm Tra Tự Động */}
      <Modal
        isOpen={isRunAutoModalOpen}
        onClose={() => setIsRunAutoModalOpen(false)}
        title="Thiết Lập Quét Chuẩn Đầu Ra Tự Động"
        description="Hệ thống sẽ đối chiếu toàn bộ bảng điểm, tín chỉ, chứng chỉ ngoại ngữ và luận văn"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRunAutoModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="autocheck-form"
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              {isProcessing ? "Đang quét dữ liệu..." : "Thực Thi Quét"}
            </Button>
          </>
        }
      >
        <form
          id="autocheck-form"
          onSubmit={handleExecuteAutoCheck}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chọn Bậc Đào Tạo Cần Xét
            </label>
            <select
              value={selectedBacKiemTra}
              onChange={(e) => setSelectedBacKiemTra(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="THAC_SI">Bậc Thạc sĩ (Định mức 60 TC)</option>
              <option value="TIEN_SI">Bậc Tiến sĩ (Định mức 90 TC)</option>
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
            <p className="font-bold text-slate-800">
              Quy tắc tự động kiểm tra:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tổng tín chỉ tích lũy $\ge$ định mức đào tạo.</li>
              <li>Điểm trung bình chung tích lũy $\ge$ 7.0 / 10.</li>
              <li>Đạt chuẩn ngoại ngữ đầu ra (VSTEP B2 / IELTS $\ge$ 6.0).</li>
              <li>Kết quả bảo vệ luận văn / luận án đạt yêu cầu.</li>
            </ul>
          </div>
        </form>
      </Modal>

      {/* 5. Modal Chi Tiết Kiểm Tra Điều Kiện Tốt Nghiệp */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Báo Cáo Chi Tiết Kiểm Tra Điều Kiện Tốt Nghiệp"
        description={`Học viên: ${selectedItem?.hoTen} (${selectedItem?.maHocVien})`}
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">
                  Chuyên ngành đào tạo:
                </span>
                <span className="font-bold text-slate-900">
                  {selectedItem.chuyenNganh}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">
                  Bậc đào tạo:
                </span>
                <span className="font-bold text-slate-900">
                  {selectedItem.bacDaoTao === "THAC_SI" ? "Thạc sĩ" : "Tiến sĩ"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                Danh mục tiêu chí kiểm tra tự động:
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white text-sm">
                  <span className="font-medium text-slate-700">
                    1. Tổng số tín chỉ tích lũy (Yêu cầu $\ge${" "}
                    {selectedItem.yeuCauTinChi})
                  </span>
                  <span
                    className={`font-bold ${selectedItem.tinChiTichLuy >= selectedItem.yeuCauTinChi ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {selectedItem.tinChiTichLuy} tín chỉ (
                    {selectedItem.tinChiTichLuy >= selectedItem.yeuCauTinChi
                      ? "Đạt"
                      : "Chưa đạt"}
                    )
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white text-sm">
                  <span className="font-medium text-slate-700">
                    2. Điểm trung bình chung tích lũy (Yêu cầu $\ge$ 7.0)
                  </span>
                  <span
                    className={`font-bold ${selectedItem.diemTrungBinh >= 7.0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {selectedItem.diemTrungBinh} (
                    {selectedItem.diemTrungBinh >= 7.0 ? "Đạt" : "Chưa đạt"})
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white text-sm">
                  <span className="font-medium text-slate-700">
                    3. Chuẩn đầu ra ngoại ngữ (VSTEP B2 / IELTS $\ge$ 6.0)
                  </span>
                  <span className="font-bold text-emerald-600">
                    {selectedItem.ngoaiNgu}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white text-sm">
                  <span className="font-medium text-slate-700">
                    4. Kết quả bảo vệ luận văn / luận án
                  </span>
                  <span
                    className={`font-bold ${selectedItem.baoVeLuanVan === "DAT" ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {selectedItem.baoVeLuanVan === "DAT"
                      ? "Đạt yêu cầu"
                      : selectedItem.baoVeLuanVan === "CHO_BAO_VE"
                        ? "Chờ bảo vệ"
                        : "Chưa đạt"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
