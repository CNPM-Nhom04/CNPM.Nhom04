"use client";

import { useState } from "react";
import {
  Database,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface MasterItem {
  id: string;
  maDanhMuc: string;
  tenDanhMuc: string;
  loaiDanhMuc: "KHOA_QUAN_LY" | "BAC_DAO_TAO" | "KHOI_KIEN_THUC";
  moTa: string;
  trangThai: boolean;
}

const MOCK_MASTER_DATA: MasterItem[] = [
  {
    id: "md-01",
    maDanhMuc: "CNTT",
    tenDanhMuc: "Khoa Công nghệ Thông tin",
    loaiDanhMuc: "KHOA_QUAN_LY",
    moTa: "Đơn vị quản lý chuyên ngành CNTT và kỹ thuật phần mềm",
    trangThai: true,
  },
  {
    id: "md-02",
    maDanhMuc: "THAC_SI",
    tenDanhMuc: "Bậc Thạc sĩ",
    loaiDanhMuc: "BAC_DAO_TAO",
    moTa: "Chương trình đào tạo trình độ thạc sĩ định mức 60 tín chỉ",
    trangThai: true,
  },
];

export default function MasterDataPage() {
  const [dataList, setDataList] = useState<MasterItem[]>(MOCK_MASTER_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");

  // State quản lý Modal và Thêm/Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);
  const [formData, setFormData] = useState({
    maDanhMuc: "",
    tenDanhMuc: "",
    loaiDanhMuc: "KHOA_QUAN_LY" as MasterItem["loaiDanhMuc"],
    moTa: "",
  });

  const getCategoryLabel = (type: MasterItem["loaiDanhMuc"]) => {
    switch (type) {
      case "KHOA_QUAN_LY":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Khoa / Đơn vị
          </span>
        );
      case "BAC_DAO_TAO":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Bậc đào tạo
          </span>
        );
      case "KHOI_KIEN_THUC":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Khối kiến thức
          </span>
        );
      default:
        return null;
    }
  };

  const filteredData = dataList.filter((item) => {
    const matchesSearch =
      item.tenDanhMuc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maDanhMuc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedType === "ALL" || item.loaiDanhMuc === selectedType;
    return matchesSearch && matchesType;
  });

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa danh mục này?")) {
      setDataList(dataList.filter((item) => item.id !== id));
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      maDanhMuc: "",
      tenDanhMuc: "",
      loaiDanhMuc: "KHOA_QUAN_LY",
      moTa: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MasterItem) => {
    setEditingItem(item);
    setFormData({
      maDanhMuc: item.maDanhMuc,
      tenDanhMuc: item.tenDanhMuc,
      loaiDanhMuc: item.loaiDanhMuc,
      moTa: item.moTa,
    });
    setIsModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setDataList(
        dataList.map((item) =>
          item.id === editingItem.id ? { ...item, ...formData } : item,
        ),
      );
      alert("Cập nhật danh mục thành công!");
    } else {
      const newItem: MasterItem = {
        id: `md-${Date.now()}`,
        ...formData,
        trangThai: true,
      };
      setDataList([newItem, ...dataList]);
      alert("Thêm danh mục thành công!");
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-600" />
            Quản Lý Danh Mục Dùng Chung (Master Data)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản trị các tham số danh mục nền tảng phục vụ thiết lập chương
            trình đào tạo SĐH
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm Danh Mục Mới
        </Button>
      </div>

      {/* 2. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên danh mục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-full md:w-56 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả loại danh mục</option>
          <option value="KHOA_QUAN_LY">Khoa / Đơn vị</option>
          <option value="BAC_DAO_TAO">Bậc đào tạo</option>
          <option value="KHOI_KIEN_THUC">Khối kiến thức</option>
        </select>
      </div>

      {/* 3. Bảng dữ liệu danh mục */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã Danh Mục</th>
                <th className="w-72 px-5 py-3.5">Tên Danh Mục</th>
                <th className="w-44 px-5 py-3.5 text-center">Phân Loại</th>
                <th className="px-5 py-3.5">Mô Tả Chi Tiết</th>
                <th className="w-28 px-5 py-3.5 text-center">Trạng Thái</th>
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
                      {item.maDanhMuc}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                      {item.tenDanhMuc}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getCategoryLabel(item.loaiDanhMuc)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs truncate font-medium">
                      {item.moTa}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Hoạt động
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Chỉnh sửa danh mục"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Xóa danh mục"
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
                    colSpan={6}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy danh mục phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Thêm / Cập Nhật Danh Mục */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingItem
            ? "Chỉnh Sửa Danh Mục Dùng Chung"
            : "Thêm Danh Mục Dùng Chung Mới"
        }
        description="Khai báo các tham số hệ thống phục vụ quản lý đào tạo SĐH"
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
              form="master-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              {editingItem ? "Cập Nhật Danh Mục" : "Lưu Danh Mục"}
            </Button>
          </>
        }
      >
        <form
          id="master-form"
          onSubmit={handleSaveCategory}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mã Danh Mục
            </label>
            <input
              type="text"
              placeholder="Ví dụ: KHOA_CNTT, THAC_SI..."
              required
              value={formData.maDanhMuc}
              onChange={(e) =>
                setFormData({ ...formData, maDanhMuc: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên Danh Mục
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Khoa Công nghệ Thông tin"
              required
              value={formData.tenDanhMuc}
              onChange={(e) =>
                setFormData({ ...formData, tenDanhMuc: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Phân Loại Danh Mục
            </label>
            <select
              value={formData.loaiDanhMuc}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  loaiDanhMuc: e.target.value as MasterItem["loaiDanhMuc"],
                })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="KHOA_QUAN_LY">Khoa / Đơn vị</option>
              <option value="BAC_DAO_TAO">Bậc đào tạo</option>
              <option value="KHOI_KIEN_THUC">Khối kiến thức</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mô Tả Chi Tiết
            </label>
            <textarea
              rows={3}
              placeholder="Nhập mô tả chi tiết chức năng danh mục..."
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
