"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Search,
  Plus,
  Edit3,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface DiemItem {
  id: string;
  maHocVien: string;
  hoTenHocVien: string;
  tenHocPhan: string;
  diemChuyenCan: number;
  diemGiuaKy: number;
  diemThi: number;
  diemTongKet: number;
  ketQua: "DAT" | "KHONG_DAT" | "CHO_XET";
}

const MOCK_DIEM: DiemItem[] = [
  {
    id: "d-01",
    maHocVien: "SDH2026-01",
    hoTenHocVien: "Lê Văn Nam",
    tenHocPhan: "Học máy nâng cao (Advanced Machine Learning)",
    diemChuyenCan: 9.0,
    diemGiuaKy: 8.5,
    diemThi: 8.0,
    diemTongKet: 8.3,
    ketQua: "DAT",
  },
  {
    id: "d-02",
    maHocVien: "SDH2026-05",
    hoTenHocVien: "Nguyễn Thị Kim Oanh",
    tenHocPhan: "Kiến trúc phần mềm hướng dịch vụ",
    diemChuyenCan: 10.0,
    diemGiuaKy: 7.0,
    diemThi: 6.5,
    diemTongKet: 7.2,
    ketQua: "DAT",
  },
  {
    id: "d-03",
    maHocVien: "SDH2025-08",
    hoTenHocVien: "Phạm Thị Mai",
    tenHocPhan: "Xử lý ngôn ngữ tự nhiên",
    diemChuyenCan: 8.0,
    diemGiuaKy: 5.0,
    diemThi: 4.5,
    diemTongKet: 5.1,
    ketQua: "KHONG_DAT",
  },
];

export default function QuanLyDiemPage() {
  const [diemList, setDiemList] = useState<DiemItem[]>(MOCK_DIEM);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResult, setSelectedResult] = useState("ALL");

  // State quản lý Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DiemItem | null>(null);

  const [formData, setFormData] = useState({
    maHocVien: "",
    hoTenHocVien: "",
    tenHocPhan: "Học máy nâng cao",
    diemChuyenCan: 0,
    diemGiuaKy: 0,
    diemThi: 0,
  });

  const getResultBadge = (ketQua: DiemItem["ketQua"]) => {
    switch (ketQua) {
      case "DAT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đạt học phần
          </span>
        );
      case "KHONG_DAT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Chưa đạt (&lt;5.5)
          </span>
        );
      case "CHO_XET":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Chờ cập nhật
          </span>
        );
      default:
        return null;
    }
  };

  const filteredData = diemList.filter((item) => {
    const matchesSearch =
      item.hoTenHocVien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maHocVien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tenHocPhan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesResult =
      selectedResult === "ALL" || item.ketQua === selectedResult;
    return matchesSearch && matchesResult;
  });

  // Mở modal thêm mới
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      maHocVien: "",
      hoTenHocVien: "",
      tenHocPhan: "Học máy nâng cao",
      diemChuyenCan: 0,
      diemGiuaKy: 0,
      diemThi: 0,
    });
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa điểm
  const handleOpenEdit = (item: DiemItem) => {
    setEditingItem(item);
    setFormData({
      maHocVien: item.maHocVien,
      hoTenHocVien: item.hoTenHocVien,
      tenHocPhan: item.tenHocPhan,
      diemChuyenCan: item.diemChuyenCan,
      diemGiuaKy: item.diemGiuaKy,
      diemThi: item.diemThi,
    });
    setIsModalOpen(true);
  };

  // Lưu thông tin (Thêm hoặc Cập nhật)
  const handleSaveDiem = (e: React.FormEvent) => {
    e.preventDefault();
    // Tính tổng kết: Chuyên cần 10% + Giữa kỳ 30% + Thi 60%
    const tongKet = Number(
      (
        Number(formData.diemChuyenCan) * 0.1 +
        Number(formData.diemGiuaKy) * 0.3 +
        Number(formData.diemThi) * 0.6
      ).toFixed(1),
    );
    const ketQua: DiemItem["ketQua"] = tongKet >= 5.5 ? "DAT" : "KHONG_DAT";

    if (editingItem) {
      // Cập nhật
      setDiemList(
        diemList.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                ...formData,
                diemTongKet: tongKet,
                ketQua,
              }
            : item,
        ),
      );
      alert("Cập nhật điểm thành công!");
    } else {
      // Thêm mới
      const newItem: DiemItem = {
        id: `d-${Date.now()}`,
        ...formData,
        diemTongKet: tongKet,
        ketQua,
      };
      setDiemList([newItem, ...diemList]);
      alert("Thêm bảng điểm mới thành công!");
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            Quản Lý Điểm Số & Đánh Giá Học Phần SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Nhập điểm thành phần, tổng kết học phần và kiểm tra chuẩn điểm đạt
            tối thiểu (5.5)
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nhập Bảng Điểm Mới
        </Button>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, tên học viên, học phần..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedResult}
          onChange={(e) => setSelectedResult(e.target.value)}
          className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả kết quả</option>
          <option value="DAT">Đạt học phần</option>
          <option value="KHONG_DAT">Chưa đạt</option>
        </select>
      </div>

      {/* 3. Bảng danh sách điểm số */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã HV</th>
                <th className="w-56 px-5 py-3.5">Học Viên</th>
                <th className="px-5 py-3.5">Tên Học Phần</th>
                <th className="w-24 px-4 py-3.5 text-center">Chuyên cần</th>
                <th className="w-24 px-4 py-3.5 text-center">Giữa kỳ</th>
                <th className="w-24 px-4 py-3.5 text-center">Thi</th>
                <th className="w-24 px-4 py-3.5 text-center font-bold text-blue-600">
                  Tổng kết
                </th>
                <th className="w-36 px-5 py-3.5 text-center">Kết Quả</th>
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
                    <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                      {item.hoTenHocVien}
                    </td>
                    <td className="px-5 py-4 text-slate-800 text-xs font-medium truncate">
                      {item.tenHocPhan}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600 font-medium">
                      {item.diemChuyenCan}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600 font-medium">
                      {item.diemGiuaKy}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600 font-medium">
                      {item.diemThi}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-900">
                      {item.diemTongKet}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getResultBadge(item.ketQua)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Chỉnh sửa điểm"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy dữ liệu điểm phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Thêm / Cập Nhật Điểm */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Chỉnh Sửa Điểm Học Phần" : "Nhập Bảng Điểm Mới"}
        description="Điểm tổng kết sẽ được tự động tính toán theo hệ số (Chuyên cần 10% - Giữa kỳ 30% - Thi 60%)"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="diem-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              {editingItem ? "Cập Nhật Điểm" : "Lưu Điểm"}
            </Button>
          </>
        }
      >
        <form id="diem-form" onSubmit={handleSaveDiem} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã Học Viên
              </label>
              <input
                type="text"
                placeholder="Ví dụ: SDH2026-01"
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
                placeholder="Ví dụ: Nguyễn Văn A"
                required
                value={formData.hoTenHocVien}
                onChange={(e) =>
                  setFormData({ ...formData, hoTenHocVien: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Học Phần Đánh Giá
            </label>
            <select
              value={formData.tenHocPhan}
              onChange={(e) =>
                setFormData({ ...formData, tenHocPhan: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="Học máy nâng cao (Advanced Machine Learning)">
                Học máy nâng cao (Advanced Machine Learning)
              </option>
              <option value="Kiến trúc phần mềm hướng dịch vụ">
                Kiến trúc phần mềm hướng dịch vụ
              </option>
              <option value="Xử lý ngôn ngữ tự nhiên">
                Xử lý ngôn ngữ tự nhiên
              </option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Điểm Chuyên Cần (10%)
              </label>
              <input
                type="number"
                step="0.1"
                max="10"
                min="0"
                required
                value={formData.diemChuyenCan}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    diemChuyenCan: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Điểm Giữa Kỳ (30%)
              </label>
              <input
                type="number"
                step="0.1"
                max="10"
                min="0"
                required
                value={formData.diemGiuaKy}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    diemGiuaKy: Number(e.target.value),
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Điểm Thi (60%)
              </label>
              <input
                type="number"
                step="0.1"
                max="10"
                min="0"
                required
                value={formData.diemThi}
                onChange={(e) =>
                  setFormData({ ...formData, diemThi: Number(e.target.value) })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
