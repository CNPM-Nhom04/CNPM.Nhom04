"use client";

import { useEffect, useState } from "react";
import {
  adminRequest,
  type AdminUser as NguoiDungItem,
} from "@/lib/services/adminService";
import { useAdminList } from "@/lib/hooks/useAdminList";
import {
  AdminFeedback,
  AdminPagination,
} from "@/components/admin/AdminFeedback";
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

export default function NguoiDungPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");

  const list = useAdminList<NguoiDungItem>(
    "nguoi-dung",
    searchTerm,
    "selectedRole",
    selectedRole,
  );
  const users = list.data;
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    adminRequest<{ units: { id: string; name: string }[] }>(
      "nguoi-dung/options",
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setUnits(result.units);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setMutationError(
            reason instanceof Error
              ? reason
              : new Error("Không thể tải đơn vị."),
          );
      });
    return () => controller.abort();
  }, [optionsVersion]);

  // State quản lý Modal Thêm / Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NguoiDungItem | null>(null);

  const [formData, setFormData] = useState({
    hoTen: "",
    email: "",
    donViId: "",
    username: "",
    password: "",
    trangThai: true,
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
        return (
          <span className="text-xs font-semibold text-slate-600">Học viên</span>
        );
    }
  };

  const filteredUsers = users;

  const handleDelete = async (id: string) => {
    if (
      saving ||
      !confirm("Bạn có chắc chắn muốn xóa tài khoản này khỏi hệ thống?")
    )
      return;
    setSaving(true);
    setMutationError(null);
    setMessage("");
    try {
      await adminRequest("nguoi-dung/" + id, { method: "DELETE" });
      setMessage("Đã xóa tài khoản.");
      list.refresh();
    } catch (reason) {
      setMutationError(
        reason instanceof Error
          ? reason
          : new Error("Không thể xóa tài khoản."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setMutationError(null);
    setMessage("");
    setFormData({
      hoTen: "",
      email: "",
      donViId: units[0]?.id ?? "",
      vaiTro: "GIANG_VIEN",
      username: "",
      password: "",
      trangThai: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: NguoiDungItem) => {
    setEditingItem(user);
    setMutationError(null);
    setMessage("");
    setFormData({
      hoTen: user.hoTen,
      email: user.email,
      donViId: user.donViId,
      vaiTro: user.vaiTro,
      username: user.username,
      password: "",
      trangThai: user.trangThai,
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMutationError(null);
    setMessage("");
    const { username, password, ...profile } = formData;
    try {
      await adminRequest(
        editingItem ? "nguoi-dung/" + editingItem.id : "nguoi-dung",
        {
          method: editingItem ? "PUT" : "POST",
          body: JSON.stringify(
            editingItem ? profile : { ...profile, username, password },
          ),
        },
      );
      setMessage(
        editingItem
          ? "Đã cập nhật tài khoản."
          : "Đã tạo tài khoản. Người dùng có thể đăng nhập bằng tên đăng nhập hoặc email.",
      );
      setIsModalOpen(false);
      list.refresh();
    } catch (reason) {
      setMutationError(
        reason instanceof Error
          ? reason
          : new Error("Không thể lưu tài khoản."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <AdminFeedback
        error={list.error || (!isModalOpen ? mutationError : null)}
        message={message}
        retry={() => {
          list.refresh();
          setOptionsVersion((value) => value + 1);
        }}
      />
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
          disabled={saving || units.length === 0}
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
          <option value="HOC_VIEN">Học viên</option>
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
                        <CheckCircle2 className="h-3 w-3" />{" "}
                        {user.trangThai ? "Hoạt động" : "Ngừng hoạt động"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          disabled={saving}
                          onClick={() => handleOpenEdit(user)}
                          title="Chỉnh sửa tài khoản"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          disabled={saving}
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
                    {list.loading
                      ? "Đang tải người dùng..."
                      : list.error
                        ? "Không thể tải danh sách người dùng."
                        : "Không tìm thấy nhân sự phù hợp."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPagination
        meta={list.meta}
        page={list.page}
        loading={list.loading || saving}
        changePage={list.changePage}
      />
      {/* Modal Thêm / Cập Nhật Nhân Sự */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!saving) setIsModalOpen(false);
        }}
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
              disabled={saving}
              onClick={() => setIsModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="user-form"
              isLoading={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
            >
              {editingItem ? "Cập Nhật Tài Khoản" : "Lưu Tài Khoản"}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSaveUser} className="space-y-4">
          <AdminFeedback error={mutationError} />
          {!editingItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-username"
                  className="text-xs font-bold text-slate-700"
                >
                  Tên đăng nhập
                </label>
                <input
                  id="admin-username"
                  required
                  minLength={3}
                  maxLength={100}
                  pattern="[a-zA-Z0-9_.@-]{3,100}"
                  autoComplete="off"
                  value={formData.username}
                  onChange={(event) =>
                    setFormData({ ...formData, username: event.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="text-xs font-bold text-slate-700"
                >
                  Mật khẩu (10–72 ký tự, tối đa 72 byte)
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={72}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
          )}

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
            <select
              required
              value={formData.donViId}
              onChange={(event) =>
                setFormData({ ...formData, donViId: event.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
            >
              <option value="">Chọn đơn vị công tác</option>
              {formData.donViId &&
                !units.some((unit) => unit.id === formData.donViId) && (
                  <option value={formData.donViId}>
                    {editingItem?.donVi || "Đơn vị ngừng hoạt động"}
                  </option>
                )}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
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
              <option value="HOC_VIEN">Học viên</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.trangThai}
              onChange={(event) =>
                setFormData({ ...formData, trangThai: event.target.checked })
              }
            />
            Tài khoản hoạt động
          </label>
        </form>
      </Modal>
    </div>
  );
}
