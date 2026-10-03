"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Layers,
  Eye,
  Edit3,
  ArrowRight,
} from "lucide-react";
import { Button, Badge, Input, Select } from "@/components/ui";
import { ChuongTrinhDaoTao, TrangThaiCTDT } from "@/types/ctdt";

const MOCK_CTDT: ChuongTrinhDaoTao[] = [
  {
    id: "ctdt-01",
    maCTDT: "MS-KHMT-2026",
    tenCTDT: "Thạc sĩ Khoa học Máy tính",
    bacDaoTao: "ThacSi",
    khoaQuanLy: "Khoa CNTT",
    khoaTuyenSinh: "Khóa 2026 - 2028",
    tongTinChiYeuCau: 60,
    trangThai: "BAN_NHAP",
    ngayCapNhat: "02/10/2026",
    hocPhanNghienCuu: [],
    hocPhanUngDung: [],
  },
  {
    id: "ctdt-02",
    maCTDT: "MS-CNPM-2026",
    tenCTDT: "Thạc sĩ Kỹ thuật Phần mềm",
    bacDaoTao: "ThacSi",
    khoaQuanLy: "Khoa CNTT",
    khoaTuyenSinh: "Khóa 2026 - 2028",
    tongTinChiYeuCau: 60,
    trangThai: "CHO_DUYET",
    ngayCapNhat: "28/09/2026",
    hocPhanNghienCuu: [],
    hocPhanUngDung: [],
  },
  {
    id: "ctdt-03",
    maCTDT: "PHD-KHMT-2025",
    tenCTDT: "Tiến sĩ Khoa học Máy tính",
    bacDaoTao: "TienSi",
    khoaQuanLy: "Khoa CNTT",
    khoaTuyenSinh: "Khóa 2025 - 2029",
    tongTinChiYeuCau: 90,
    trangThai: "DA_BAN_HANH",
    ngayCapNhat: "15/08/2026",
    hocPhanNghienCuu: [],
    hocPhanUngDung: [],
  },
];

export default function DanhSachCTDTPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const getBadgeVariant = (status: TrangThaiCTDT) => {
    switch (status) {
      case "BAN_NHAP":
        return "draft";
      case "CHO_DUYET":
        return "pending";
      case "DA_BAN_HANH":
        return "approved";
      case "YEU_CAU_SUA":
        return "rejected";
      default:
        return "default";
    }
  };

  const getBadgeLabel = (status: TrangThaiCTDT) => {
    switch (status) {
      case "BAN_NHAP":
        return "Bản nháp";
      case "CHO_DUYET":
        return "Chờ duyệt";
      case "DA_BAN_HANH":
        return "Đã ban hành";
      case "YEU_CAU_SUA":
        return "Yêu cầu sửa";
    }
  };

  const filteredData = MOCK_CTDT.filter((item) => {
    const matchesSearch =
      item.tenCTDT.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maCTDT.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThai === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Nút Tạo mới */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Chương trình Đào tạo Sau Đại học
          </h2>
          <p className="text-sm text-slate-500">
            Quản lý phiên bản, cấu trúc tín chỉ và xét duyệt CTĐT
          </p>
        </div>
        <Button className="w-fit">
          <Plus className="h-4 w-4 mr-1.5" />
          Khởi tạo CTĐT Mới
        </Button>
      </div>

      {/* Thanh lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Input
            placeholder="Tìm theo mã hoặc tên CTĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select
            options={[
              { label: "Tất cả trạng thái", value: "ALL" },
              { label: "Bản nháp", value: "BAN_NHAP" },
              { label: "Chờ duyệt", value: "CHO_DUYET" },
              { label: "Đã ban hành", value: "DA_BAN_HANH" },
            ]}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          />
        </div>
      </div>

      {/* Bảng dữ liệu CTĐT */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="px-5 py-3.5">Mã CTĐT</th>
                <th className="px-5 py-3.5">Tên Chương trình</th>
                <th className="px-5 py-3.5">Bậc đào tạo</th>
                <th className="px-5 py-3.5">Khóa tuyển sinh</th>
                <th className="px-5 py-3.5 text-center">Định mức</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((ctdt) => (
                <tr
                  key={ctdt.id}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {ctdt.maCTDT}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-900">
                      {ctdt.tenCTDT}
                    </div>
                    <div className="text-xs text-slate-400">
                      {ctdt.khoaQuanLy}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-slate-700">
                      {ctdt.bacDaoTao === "ThacSi" ? "Thạc sĩ" : "Tiến sĩ"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {ctdt.khoaTuyenSinh}
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-blue-600">
                    {ctdt.tongTinChiYeuCau} TC
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={getBadgeVariant(ctdt.trangThai)}>
                      {getBadgeLabel(ctdt.trangThai)}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/chuong-trinh-dao-tao/${ctdt.id}/build`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Layers className="h-3.5 w-3.5 mr-1" />
                          Xây dựng Cấu trúc
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
