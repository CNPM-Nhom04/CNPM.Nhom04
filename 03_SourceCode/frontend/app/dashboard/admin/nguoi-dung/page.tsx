"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface NguoiDungItem {
  id: string;
  hoTen: string;
  email: string;
  donVi: string;
  vaiTro: "QUAN_TRI" | "CAN_BO_DAO_TAO" | "HOI_DONG" | "GIANG_VIEN";
  trangThai: boolean;
}

const MOCK_USERS: NguoiDungItem[] = [
  {
    id: "usr-01",
    hoTen: "Nguyễn Đức Huy",
    email: "huy.nd@agu.edu.vn",
    donVi: "Khoa Công nghệ Thông tin",
    vaiTro: "CAN_BO_DAO_TAO",
    trangThai: true,
  },
  {
    id: "usr-02",
    hoTen: "PGS.TS. Nguyễn Văn A",
    email: "nva@agu.edu.vn",
    donVi: "Khoa Công nghệ Thông tin",
    vaiTro: "HOI_DONG",
    trangThai: true,
  },
  {
    id: "usr-03",
    hoTen: "Trần Thị Phương Dung",
    email: "dung.ttp@agu.edu.vn",
    donVi: "Phòng Đào tạo SĐH",
    vaiTro: "QUAN_TRI",
    trangThai: true,
  },
];

export default function NguoiDungPage() {
  const [users, setUsers] = useState<NguoiDungItem[]>(MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");

  // State quản lý Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NguoiDungItem | null>(null);

  const [formData, setFormData] = useState({
    hoTen: "",
    email: "",
    donVi: "Khoa Công nghệ Thông tin",
    vaiTro: "GIANG_VIEN" as NguoiDungItem["vaiTro"],
  });

  const getRoleBadge = (role: NguoiDungItem["vaiTro"]) => {
    switch (role) {
      case "QUAN_TRI":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Quản trị viên
          </span>
        );
      case "CAN_BO_DAO_TAO":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            Cán bộ Đào tạo
          </span>
        );
      case "HOI_DONG":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Hội đồng KH
          </span>
        );
      case "GIANG_VIEN":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Giảng viên
          </span>
        );
      default:
        return null;
    }
  };

  const filteredUsers = users.filter((item) => {
    const matchesSearch =
      item.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.donVi.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "ALL" || item.vaiTro === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống?")) {
      setUsers(users.filter((u) => u.id !== id));
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      hoTen: "",
      email: "",
      donVi: "Khoa Công nghệ Thông tin",
      vaiTro: "GIANG_VIEN",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: NguoiDungItem) => {
    setEditingItem(user);
    setFormData({
      hoTen: user.hoTen,
      email: user.email,
      donVi: user.donVi,
      vaiTro: user.vaiTro,
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      setUsers(
        users.map((u) => (u.id === editingItem.id ? { ...u, ...formData } : u)),
      );
      alert("Cập nhật thông tin nhân sự thành công!");
    } else {
      const newUser: NguoiDungItem = {
        id: `usr-${Date.now()}`,
        ...formData,
        trangThai: true,
      };
      setUsers([newUser, ...users]);
      alert("Thêm tài khoản nhân sự thành công!");
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Nhân Sự & Phân Quyền Hệ Thống SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý tài khoản cán bộ, giảng viên, hội đồng thẩm định và phân
            quyền chức năng
          </p>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm Tài Khoản Mới
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, đơn vị công tác..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full md:w-56 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
        >
          <option value="ALL">Tất cả vai trò</option>
          <option value="QUAN_TRI">Quản trị viên</option>
          <option value="CAN_BO_DAO_TAO">Cán bộ Đào tạo</option>
          <option value="HOI_DONG">Hội đồng Khoa học</option>
          <option value="GIANG_VIEN">Giảng viên</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-72 px-5 py-3.5">Họ Và Tên / Email</th>
                <th className="w-64 px-5 py-3.5">Đơn Vị Công Tác</th>
                <th className="w-48 px-5 py-3.5 text-center">
                  Vai Trò Hệ Thống
                </th>
                <th className="w-32 px-5 py-3.5 text-center">Trạng Thái</th>
                <th className="w-28 px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 truncate">
                        {user.hoTen}
                      </div>
                      <div className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="h-3 w-3" /> {user.email}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {user.donVi}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {getRoleBadge(user.vaiTro)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Hoạt động
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          title="Chỉnh sửa tài khoản"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          title="Xóa tài khoản"
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
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy nhân sự phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Cập Nhật Nhân Sự */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingItem
            ? "Chỉnh Sửa Tài Khoản Nhân Sự"
            : "Thêm Tài Khoản Nhân Sự Mới"
        }
        description="Khai báo thông tin tài khoản và phân quyền truy cập hệ thống SĐH"
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
              form="user-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              {editingItem ? "Cập Nhật Tài Khoản" : "Lưu Tài Khoản"}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSaveUser} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Họ và Tên Cán Bộ / Giảng Viên
            </label>
            <input
              type="text"
              placeholder="Ví dụ: TS. Nguyễn Văn B"
              required
              value={formData.hoTen}
              onChange={(e) =>
                setFormData({ ...formData, hoTen: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Email Cơ Quan (AGU)
            </label>
            <input
              type="email"
              placeholder="Ví dụ: nvb@agu.edu.vn"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Đơn Vị Công Tác
            </label>
            <input
              type="text"
              required
              value={formData.donVi}
              onChange={(e) =>
                setFormData({ ...formData, donVi: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Vai Trò Hệ Thống
            </label>
            <select
              value={formData.vaiTro}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  vaiTro: e.target.value as NguoiDungItem["vaiTro"],
                })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
            >
              <option value="QUAN_TRI">Quản trị viên</option>
              <option value="CAN_BO_DAO_TAO">Cán bộ Đào tạo</option>
              <option value="HOI_DONG">Hội đồng Khoa học</option>
              <option value="GIANG_VIEN">Giảng viên</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
