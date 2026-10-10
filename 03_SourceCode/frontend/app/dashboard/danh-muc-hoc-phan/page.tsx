"use client";

import { useState } from "react";
import { BookOpen, Plus, Search, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface HocPhanItem {
  id: string;
  maHocPhan: string;
  tenHocPhan: string;
  soTinChi: number;
  loaiHocPhan: "BAT_BUOC" | "TU_CHON";
  khoiKienThuc: string;
  moTa: string;
}

const MOCK_HOC_PHAN: HocPhanItem[] = [
  {
    id: "hp-01",
    maHocPhan: "KTM701",
    tenHocPhan: "Học máy nâng cao",
    soTinChi: 3,
    loaiHocPhan: "BAT_BUOC",
    khoiKienThuc: "Kiến thức cơ sở ngành",
    moTa: "Cung cấp các thuật toán học máy nâng cao và mạng Nơ-ron sâu",
  },
  {
    id: "hp-02",
    maHocPhan: "KTPM702",
    tenHocPhan: "Kiến trúc phần mềm hướng dịch vụ",
    soTinChi: 3,
    loaiHocPhan: "TU_CHON",
    khoiKienThuc: "Kiến thức chuyên ngành",
    moTa: "Thiết kế hệ thống phần mềm quy mô lớn dựa trên Microservices",
  },
];

export default function DanhMucHocPhanPage() {
  const [hocPhanList, setHocPhanList] = useState<HocPhanItem[]>(MOCK_HOC_PHAN);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    maHocPhan: "",
    tenHocPhan: "",
    soTinChi: 3,
    loaiHocPhan: "BAT_BUOC" as HocPhanItem["loaiHocPhan"],
    khoiKienThuc: "Kiến thức chuyên ngành",
    moTa: "",
  });

  const filteredData = hocPhanList.filter((item) => {
    const matchesSearch =
      item.tenHocPhan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maHocPhan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedType === "ALL" || item.loaiHocPhan === selectedType;
    return matchesSearch && matchesType;
  });

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa học phần này khỏi danh mục?")) {
      setHocPhanList(hocPhanList.filter((hp) => hp.id !== id));
    }
  };

  const handleSaveHocPhan = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: HocPhanItem = {
      id: `hp-${Date.now()}`,
      ...formData,
    };
    setHocPhanList([newItem, ...hocPhanList]);
    setIsModalOpen(false);
    setFormData({
      maHocPhan: "",
      tenHocPhan: "",
      soTinChi: 3,
      loaiHocPhan: "BAT_BUOC",
      khoiKienThuc: "Kiến thức chuyên ngành",
      moTa: "",
    });
    alert("Thêm học phần mới thành công!");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề & Nút Thêm Học Phần Mới */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Danh Mục Học Phần SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý ngân hàng môn học, số tín chỉ và phân loại khối kiến thức
            đào tạo
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm Học Phần Mới
        </Button>
      </div>

      {/* 2. Tìm kiếm & Bộ lọc */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên học phần..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full md:w-52 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả loại học phần</option>
          <option value="BAT_BUOC">Bắt buộc</option>
          <option value="TU_CHON">Tự chọn</option>
        </select>
      </div>

      {/* 3. Bảng danh sách học phần */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã Môn</th>
                <th className="w-64 px-5 py-3.5">Tên Học Phần</th>
                <th className="w-24 px-4 py-3.5 text-center">Số Tín Chỉ</th>
                <th className="w-36 px-4 py-3.5 text-center">Loại HP</th>
                <th className="w-56 px-5 py-3.5">Khối Kiến Thức</th>
                <th className="px-5 py-3.5">Mô Tả</th>
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
                      {item.maHocPhan}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                      {item.tenHocPhan}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-800">
                      {item.soTinChi}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {item.loaiHocPhan === "BAT_BUOC" ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Tự chọn
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.khoiKienThuc}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs truncate">
                      {item.moTa}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy học phần nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Thêm Học Phần Mới */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm Học Phần Mới Vào Danh Mục"
        description="Nhập thông tin mô tả chi tiết học phần để đưa vào chương trình đào tạo SĐH"
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
              form="hocphan-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Lưu Học Phần
            </Button>
          </>
        }
      >
        <form
          id="hocphan-form"
          onSubmit={handleSaveHocPhan}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mã Học Phần
              </label>
              <input
                type="text"
                placeholder="Ví dụ: KTM703"
                required
                value={formData.maHocPhan}
                onChange={(e) =>
                  setFormData({ ...formData, maHocPhan: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Số Tín Chỉ
              </label>
              <input
                type="number"
                min={1}
                max={15}
                required
                value={formData.soTinChi}
                onChange={(e) =>
                  setFormData({ ...formData, soTinChi: Number(e.target.value) })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên Học Phần
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Xử lý dữ liệu lớn trong Y tế"
              required
              value={formData.tenHocPhan}
              onChange={(e) =>
                setFormData({ ...formData, tenHocPhan: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Loại Học Phần
              </label>
              <select
                value={formData.loaiHocPhan}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loaiHocPhan: e.target.value as HocPhanItem["loaiHocPhan"],
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="BAT_BUOC">Bắt buộc</option>
                <option value="TU_CHON">Tự chọn</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Khối Kiến Thức
              </label>
              <select
                value={formData.khoiKienThuc}
                onChange={(e) =>
                  setFormData({ ...formData, khoiKienThuc: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              >
                <option value="Kiến thức chung">Kiến thức chung</option>
                <option value="Kiến thức cơ sở ngành">
                  Kiến thức cơ sở ngành
                </option>
                <option value="Kiến thức chuyên ngành">
                  Kiến thức chuyên ngành
                </option>
                <option value="Luận văn / Luận án tốt nghiệp">
                  Luận văn / Luận án tốt nghiệp
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mô Tả Học Phần
            </label>
            <textarea
              rows={3}
              placeholder="Nhập tóm tắt nội dung để cương chi tiết học phần..."
              value={formData.moTa}
              onChange={(e) =>
                setFormData({ ...formData, moTa: e.target.value })
              }
              className="w-full p-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
        </form>
      </Modal>
    </div>
  );
}
