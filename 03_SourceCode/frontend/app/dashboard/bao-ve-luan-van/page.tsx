"use client";

import { useState } from "react";
import {
  Award,
  Search,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface BaoVeItem {
  id: string;
  maHocVien: string;
  hoTen: string;
  chuyenNganh: string;
  tenDeTai: string;
  ngayBaoVe: string;
  diaDiem: string;
  chuTichHoidong: string;
  diemTrungBinh: number;
  trangThai: "CHO_BAO_VE" | "DA_DAT" | "CHUA_DAT";
}

const MOCK_BAO_VE: BaoVeItem[] = [
  {
    id: "bv-01",
    maHocVien: "SDH2026-01",
    hoTen: "Lê Văn Nam",
    chuyenNganh: "Thạc sĩ Khoa học Máy tính",
    tenDeTai: "Ứng dụng học sâu trong dự báo phụ tải điện thông minh",
    ngayBaoVe: "2026-06-15",
    diaDiem: "Phòng họp 302 - Khoa CNTT",
    chuTichHoidong: "PGS.TS. Nguyễn Văn A",
    diemTrungBinh: 8.6,
    trangThai: "DA_DAT",
  },
  {
    id: "bv-02",
    maHocVien: "PHD2024-02",
    hoTen: "Hoàng Minh Quân",
    chuyenNganh: "Tiến sĩ Khoa học Máy tính",
    tenDeTai:
      "Mô hình kiến trúc phân tán phục vụ hệ thống xử lý dữ liệu lớn y tế",
    ngayBaoVe: "2026-06-20",
    diaDiem: "Hội trường lớn A1",
    chuTichHoidong: "GS.TS. Phạm Văn F",
    diemTrungBinh: 9.1,
    trangThai: "DA_DAT",
  },
  {
    id: "bv-03",
    maHocVien: "SDH2026-05",
    hoTen: "Nguyễn Thị Kim Oanh",
    chuyenNganh: "Thạc sĩ Kỹ thuật Phần mềm",
    tenDeTai: "Xây dựng hệ thống quản lý học tập tích hợp AI đề xuất lộ trình",
    ngayBaoVe: "2026-07-10",
    diaDiem: "Phòng họp 304 - Khoa CNTT",
    chuTichHoidong: "TS. Trần Minh D",
    diemTrungBinh: 0,
    trangThai: "CHO_BAO_VE",
  },
];

export default function BaoVeLuanVanPage() {
  const [dataList, setDataList] = useState<BaoVeItem[]>(MOCK_BAO_VE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // State quản lý Modal Thêm mới và Modal Chi tiết
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BaoVeItem | null>(null);

  const [formData, setFormData] = useState({
    maHocVien: "",
    hoTen: "",
    chuyenNganh: "Thạc sĩ Khoa học Máy tính",
    tenDeTai: "",
    ngayBaoVe: "",
    diaDiem: "",
    chuTichHoidong: "",
  });

  const getStatusBadge = (status: BaoVeItem["trangThai"]) => {
    switch (status) {
      case "DA_DAT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đã đạt (Bảo vệ thành công)
          </span>
        );
      case "CHO_BAO_VE":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Chờ lịch bảo vệ
          </span>
        );
      case "CHUA_DAT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Chưa đạt
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
      item.tenDeTai.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThai === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSaveBaoVe = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: BaoVeItem = {
      id: `bv-${Date.now()}`,
      ...formData,
      diemTrungBinh: 0,
      trangThai: "CHO_BAO_VE",
    };
    setDataList([newItem, ...dataList]);
    setIsAddModalOpen(false);
    setFormData({
      maHocVien: "",
      hoTen: "",
      chuyenNganh: "Thạc sĩ Khoa học Máy tính",
      tenDeTai: "",
      ngayBaoVe: "",
      diaDiem: "",
      chuTichHoidong: "",
    });
    alert("Lập lịch bảo vệ thành công!");
  };

  const handleOpenDetail = (item: BaoVeItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-600" />
            Quản Lý Hội Đồng & Bảo Vệ Luận Văn / Luận Án
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Lập lịch hội đồng đánh giá, phân công phản biện và ghi nhận kết quả
            bảo vệ của học viên SĐH
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm Lịch Bảo Vệ Mới
        </Button>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, tên học viên, tên đề tài..."
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
          <option value="ALL">Tất cả trạng thái bảo vệ</option>
          <option value="DA_DAT">Đã bảo vệ thành công</option>
          <option value="CHO_BAO_VE">Chờ lịch bảo vệ</option>
        </select>
      </div>

      {/* 3. Bảng danh sách hội đồng bảo vệ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã HV</th>
                <th className="w-56 px-5 py-3.5">Học Viên & Chuyên Ngành</th>
                <th className="px-5 py-3.5">Tên Đề Tài Nghiên Cứu</th>
                <th className="w-40 px-4 py-3.5 text-center">Ngày Bảo Vệ</th>
                <th className="w-48 px-5 py-3.5 text-center">Trạng Thái</th>
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
                    <td className="px-5 py-4 text-slate-800 text-xs font-medium truncate">
                      {item.tenDeTai}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-700 text-xs font-semibold">
                      {item.ngayBaoVe}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(item.trangThai)}
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
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy lịch bảo vệ nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Thêm Lịch Bảo Vệ Mới */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Lập Lịch Bảo Vệ Luận Văn / Luận Án SĐH"
        description="Khai báo thông tin hội đồng đánh giá và thời gian tổ chức bảo vệ"
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="baove-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Lưu Lịch Bảo Vệ
            </Button>
          </>
        }
      >
        <form id="baove-form" onSubmit={handleSaveBaoVe} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã Học Viên
              </label>
              <input
                type="text"
                placeholder="Ví dụ: SDH2026-03"
                required
                value={formData.maHocVien}
                onChange={(e) =>
                  setFormData({ ...formData, maHocVien: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Họ và Tên Học Viên
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn C"
                required
                value={formData.hoTen}
                onChange={(e) =>
                  setFormData({ ...formData, hoTen: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên Đề Tài Luận Văn / Luận Án
            </label>
            <input
              type="text"
              placeholder="Nhập tên đầy đủ đề tài nghiên cứu..."
              required
              value={formData.tenDeTai}
              onChange={(e) =>
                setFormData({ ...formData, tenDeTai: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ngày Tổ Chức Bảo Vệ
              </label>
              <input
                type="date"
                required
                value={formData.ngayBaoVe}
                onChange={(e) =>
                  setFormData({ ...formData, ngayBaoVe: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Địa Điểm (Phòng họp)
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Phòng họp 302 - Khoa CNTT"
                required
                value={formData.diaDiem}
                onChange={(e) =>
                  setFormData({ ...formData, diaDiem: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chủ Tịch Hội Đồng
            </label>
            <input
              type="text"
              placeholder="Ví dụ: PGS.TS. Nguyễn Văn A"
              required
              value={formData.chuTichHoidong}
              onChange={(e) =>
                setFormData({ ...formData, chuTichHoidong: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* 5. Modal Xem Chi Tiết Hội Đồng & Điểm Bảo Vệ */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Thông Tin Chi Tiết Hội Đồng & Kết Quả Bảo Vệ"
        description={`Học viên: ${selectedItem?.hoTen} (${selectedItem?.maHocVien})`}
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <span className="text-slate-500 text-xs block">
                  Đề tài nghiên cứu:
                </span>
                <span className="font-bold text-slate-900">
                  {selectedItem.tenDeTai}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 text-xs block">
                    Ngày tổ chức:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedItem.ngayBaoVe}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">
                    Địa điểm:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedItem.diaDiem}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                Thành phần hội đồng đánh giá:
              </h4>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Chủ tịch hội đồng:</span>
                  <span className="font-bold text-slate-900">
                    {selectedItem.chuTichHoidong}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Phản biện 1:</span>
                  <span className="font-bold text-slate-900">TS. Lê Văn B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Thư ký hội đồng:</span>
                  <span className="font-bold text-slate-900">
                    ThS. Phạm Thị C
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
              <div>
                <span className="text-blue-900 font-bold block">
                  Điểm trung bình hội đồng:
                </span>
                <span className="text-xs text-blue-700">
                  Đạt yêu cầu tối thiểu $\ge$ 5.5 điểm
                </span>
              </div>
              <span className="text-xl font-bold text-blue-600">
                {selectedItem.diemTrungBinh > 0
                  ? `${selectedItem.diemTrungBinh} / 10`
                  : "Chưa chấm điểm"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
