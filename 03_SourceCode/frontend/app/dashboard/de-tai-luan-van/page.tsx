"use client";

import { useState } from "react";
import { FileText, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface DeTaiItem {
  id: string;
  maHocVien: string;
  hoTenHocVien: string;
  chuyenNganh: string;
  tenDeTai: string;
  giangVienHD: string;
  trangThai: "CHO_DUYET" | "DANG_THUC_HIEN" | "HOAN_THANH";
}

const MOCK_DE_TAI: DeTaiItem[] = [
  {
    id: "dt-01",
    maHocVien: "SDH2026-01",
    hoTenHocVien: "Lê Văn Nam",
    chuyenNganh: "Thạc sĩ Khoa học Máy tính",
    tenDeTai: "Ứng dụng học sâu trong dự báo phụ tải điện thông minh",
    giangVienHD: "PGS.TS. Nguyễn Văn A",
    trangThai: "DANG_THUC_HIEN",
  },
  {
    id: "dt-02",
    maHocVien: "SDH2026-05",
    hoTenHocVien: "Nguyễn Thị Kim Oanh",
    chuyenNganh: "Thạc sĩ Kỹ thuật Phần mềm",
    tenDeTai: "Xây dựng hệ thống quản lý học tập tích hợp AI đề xuất lộ trình",
    giangVienHD: "TS. Trần Minh D",
    trangThai: "CHO_DUYET",
  },
];

export default function DeTaiLuanVanPage() {
  const [dataList, setDataList] = useState<DeTaiItem[]>(MOCK_DE_TAI);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    maHocVien: "",
    hoTenHocVien: "",
    chuyenNganh: "Thạc sĩ Khoa học Máy tính",
    tenDeTai: "",
    giangVienHD: "",
  });

  const getStatusBadge = (status: DeTaiItem["trangThai"]) => {
    switch (status) {
      case "CHO_DUYET":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Chờ duyệt đề tài
          </span>
        );
      case "DANG_THUC_HIEN":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Đang thực hiện
          </span>
        );
      case "HOAN_THANH":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đã nghiệm thu
          </span>
        );
      default:
        return null;
    }
  };

  const filteredData = dataList.filter((item) => {
    const matchesSearch =
      item.hoTenHocVien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maHocVien.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tenDeTai.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.giangVienHD.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThai === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSaveDeTai = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: DeTaiItem = {
      id: `dt-${Date.now()}`,
      ...formData,
      trangThai: "CHO_DUYET",
    };
    setDataList([newItem, ...dataList]);
    setIsModalOpen(false);
    setFormData({
      maHocVien: "",
      hoTenHocVien: "",
      chuyenNganh: "Thạc sĩ Khoa học Máy tính",
      tenDeTai: "",
      giangVienHD: "",
    });
    alert("Đăng ký đề tài luận văn thành công!");
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Quản Lý Đề Tài Luận Văn & Phân Công GVHD
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Phê duyệt tên đề tài nghiên cứu, phân công giảng viên hướng dẫn cho
            học viên SĐH
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Đăng Ký Đề Tài Mới
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo MSSV, tên học viên, đề tài, GVHD..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="CHO_DUYET">Chờ duyệt đề tài</option>
          <option value="DANG_THUC_HIEN">Đang thực hiện</option>
          <option value="HOAN_THANH">Đã nghiệm thu</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã HV</th>
                <th className="w-64 px-5 py-3.5">Học Viên & Chuyên Ngành</th>
                <th className="px-5 py-3.5">Tên Đề Tài Nghiên Cứu</th>
                <th className="w-48 px-5 py-3.5">Giảng Viên Hướng Dẫn</th>
                <th className="w-36 px-5 py-3.5 text-center">Trạng Thái</th>
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
                        {item.hoTenHocVien}
                      </div>
                      <div className="text-xs text-slate-400 font-medium truncate">
                        {item.chuyenNganh}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-800 text-xs font-semibold truncate">
                      {item.tenDeTai}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.giangVienHD}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getStatusBadge(item.trangThai)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Chi tiết
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
                    Không tìm thấy đề tài nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Đăng Ký Đề Tài Mới */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Đăng Ký Đề Tài Luận Văn & Phân Công GVHD"
        description="Khai báo tên đề tài nghiên cứu chính thức và giảng viên hướng dẫn khoa học"
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
              form="detai-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Lưu Đề Tài
            </Button>
          </>
        }
      >
        <form id="detai-form" onSubmit={handleSaveDeTai} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã Học Viên
              </label>
              <input
                type="text"
                placeholder="Ví dụ: SDH2026-02"
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
              Chuyên Ngành Đào Tạo
            </label>
            <select
              value={formData.chuyenNganh}
              onChange={(e) =>
                setFormData({ ...formData, chuyenNganh: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="Thạc sĩ Khoa học Máy tính">
                Thạc sĩ Khoa học Máy tính
              </option>
              <option value="Thạc sĩ Kỹ thuật Phần mềm">
                Thạc sĩ Kỹ thuật Phần mềm
              </option>
              <option value="Tiến sĩ Khoa học Máy tính">
                Tiến sĩ Khoa học Máy tính
              </option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên Đề Tài Nghiên Cứu
            </label>
            <input
              type="text"
              placeholder="Nhập tên chính thức đề tài luận văn..."
              required
              value={formData.tenDeTai}
              onChange={(e) =>
                setFormData({ ...formData, tenDeTai: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Giảng Viên Hướng Dẫn Khoa Học
            </label>
            <input
              type="text"
              placeholder="Ví dụ: PGS.TS. Nguyễn Văn A"
              required
              value={formData.giangVienHD}
              onChange={(e) =>
                setFormData({ ...formData, giangVienHD: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
