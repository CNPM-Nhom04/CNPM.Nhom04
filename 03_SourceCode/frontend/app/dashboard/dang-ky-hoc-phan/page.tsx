"use client";

import { useState } from "react";
import {
  CalendarDays,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Lock,
  Unlock,
  Eye,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";

interface LopHocPhan {
  id: string;
  maLop: string;
  tenHocPhan: string;
  giangVien: string;
  soTinChi: number;
  siSoToiDa: number;
  daDangKy: number;
  trangThai: "DANG_MO" | "SAP_MO" | "DA_DONG";
  phongHoc?: string;
  lichHoc?: string;
}

const MOCK_CLASSES: LopHocPhan[] = [
  {
    id: "lhp-01",
    maLop: "PHIL601-01",
    tenHocPhan: "Triết học (Dành cho SĐH)",
    giangVien: "PGS.TS. Nguyễn Văn C",
    soTinChi: 3,
    siSoToiDa: 40,
    daDangKy: 35,
    trangThai: "DANG_MO",
    phongHoc: "Phòng 301 - Tòa nhà A",
    lichHoc: "Thứ 7 (Tiết 1 - 4)",
  },
  {
    id: "lhp-02",
    maLop: "CS701-01",
    tenHocPhan: "Trí tuệ Nhân tạo Nâng cao",
    giangVien: "TS. Trần Minh D",
    soTinChi: 3,
    siSoToiDa: 30,
    daDangKy: 28,
    trangThai: "DANG_MO",
    phongHoc: "Phòng Máy tính 2 - Khoa CNTT",
    lichHoc: "Chủ nhật (Tiết 1 - 4)",
  },
  {
    id: "lhp-03",
    maLop: "SE703-01",
    tenHocPhan: "Kiến trúc Phần mềm Doanh nghiệp",
    giangVien: "TS. Lê Hoàng E",
    soTinChi: 3,
    siSoToiDa: 25,
    daDangKy: 25,
    trangThai: "DA_DONG",
    phongHoc: "Phòng 405 - Tòa nhà B",
    lichHoc: "Thứ 7 (Tiết 6 - 9)",
  },
  {
    id: "lhp-04",
    maLop: "RES801-01",
    tenHocPhan: "Phương pháp Nghiên cứu Khoa học",
    giangVien: "GS.TS. Phạm Văn F",
    soTinChi: 2,
    siSoToiDa: 45,
    daDangKy: 12,
    trangThai: "SAP_MO",
    phongHoc: "Hội trường C",
    lichHoc: "Chủ nhật (Tiết 6 - 8)",
  },
];

export default function DangKyHocPhanPage() {
  const [classList, setClassList] = useState<LopHocPhan[]>(MOCK_CLASSES);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Thông tin đợt đăng ký hiện tại
  const [dotDangKy, setDotDangKy] = useState({
    tenDot: "Đợt Đăng Ký Chính Thức - Khóa 2026 SĐH",
    hocKy: "Học kỳ 1 - Năm học 2026-2027",
    tuNgay: "2026-10-15",
    denNgay: "2026-10-30",
    isLocked: false,
  });

  // States quản lý Modal
  const [isMoDotModalOpen, setIsMoDotModalOpen] = useState(false);
  const [isCauHinhModalOpen, setIsCauHinhModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<LopHocPhan | null>(null);

  // Form đợt mới
  const [formDotMoi, setFormDotMoi] = useState({
    tenDot: "",
    hocKy: "Học kỳ 1 - Năm học 2026-2027",
    tuNgay: "",
    denNgay: "",
  });

  const getStatusBadge = (status: LopHocPhan["trangThai"]) => {
    switch (status) {
      case "DANG_MO":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đang mở đăng ký
          </span>
        );
      case "SAP_MO":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Sắp mở
          </span>
        );
      case "DA_DONG":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Đã đóng lớp
          </span>
        );
      default:
        return null;
    }
  };

  const filteredClasses = classList.filter((item) => {
    const matchesSearch =
      item.tenHocPhan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maLop.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.giangVien.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "ALL" || item.trangThai === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Xử lý tạo đợt mới
  const handleCreateDotMoi = (e: React.FormEvent) => {
    e.preventDefault();
    setDotDangKy({
      ...formDotMoi,
      isLocked: false,
    });
    setIsMoDotModalOpen(false);
    alert("Đã mở đợt đăng ký học phần thành công!");
  };

  // Xử lý lưu cấu hình thời gian
  const handleSaveCauHinh = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCauHinhModalOpen(false);
    alert("Đã cập nhật khung thời gian đăng ký!");
  };

  // Toggle khóa / mở đợt đăng ký
  const handleToggleLockDot = () => {
    const nextLocked = !dotDangKy.isLocked;
    setDotDangKy({ ...dotDangKy, isLocked: nextLocked });
    alert(
      nextLocked
        ? "Đã khóa đợt đăng ký! Học viên tạm thời không thể thao tác."
        : "Đã mở khóa đợt đăng ký!",
    );
  };

  const handleOpenDetail = (item: LopHocPhan) => {
    setSelectedClass(item);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Đợt Đăng Ký & Quản Lý Lớp Học Phần SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi sĩ số, thiết lập lịch đăng ký tín chỉ và phân bổ lớp học
            phần cho học viên
          </p>
        </div>
        <Button
          onClick={() => setIsMoDotModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Mở Đợt Đăng Ký Mới
        </Button>
      </div>

      {/* 2. Thông tin đợt hiện tại */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white">
              {dotDangKy.hocKy}
            </span>
            <span className="text-xs text-blue-200">
              Thời hạn: {dotDangKy.tuNgay} đến {dotDangKy.denNgay}
            </span>
            {dotDangKy.isLocked && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white flex items-center gap-1">
                <Lock className="h-3 w-3" /> Đã khóa
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold">{dotDangKy.tenDot}</h2>
          <p className="text-xs text-slate-300">
            Tổng số học viên đã tham gia đăng ký:{" "}
            <strong className="text-white">100 học viên</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCauHinhModalOpen(true)}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            Cấu hình thời gian
          </Button>
          <Button
            onClick={handleToggleLockDot}
            className={`text-xs text-white cursor-pointer ${
              dotDangKy.isLocked
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {dotDangKy.isLocked ? (
              <>
                <Unlock className="h-3.5 w-3.5 mr-1" /> Mở khóa đợt ĐK
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 mr-1" /> Khóa đợt đăng ký
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3. Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã lớp, tên học phần, giảng viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-48 h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
          >
            <option value="ALL">Tất cả trạng thái lớp</option>
            <option value="DANG_MO">Đang mở đăng ký</option>
            <option value="SAP_MO">Sắp mở</option>
            <option value="DA_DONG">Đã đóng lớp</option>
          </select>
        </div>
      </div>

      {/* 4. Bảng danh sách lớp học phần */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="w-32 px-5 py-3.5">Mã Lớp HP</th>
                <th className="w-80 px-5 py-3.5">Tên Học Phần</th>
                <th className="w-48 px-5 py-3.5">Giảng Viên Phụ Trách</th>
                <th className="w-24 px-5 py-3.5 text-center">Tín Chỉ</th>
                <th className="w-36 px-5 py-3.5 text-center">
                  Sĩ Số (ĐK / Tối đa)
                </th>
                <th className="w-36 px-5 py-3.5 text-center">Trạng Thái</th>
                <th className="w-28 px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 font-bold text-blue-600 truncate">
                      {item.maLop}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 truncate">
                      {item.tenHocPhan}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium truncate">
                      {item.giangVien}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-slate-800">
                      {item.soTinChi} TC
                    </td>
                    <td className="px-5 py-4 text-center font-medium">
                      <span
                        className={
                          item.daDangKy >= item.siSoToiDa
                            ? "text-red-600 font-bold"
                            : "text-slate-800"
                        }
                      >
                        {item.daDangKy}
                      </span>
                      <span className="text-slate-400">
                        {" "}
                        / {item.siSoToiDa}
                      </span>
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
                    colSpan={7}
                    className="px-5 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy lớp học phần nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal Mở Đợt Đăng Ký Mới */}
      <Modal
        isOpen={isMoDotModalOpen}
        onClose={() => setIsMoDotModalOpen(false)}
        title="Mở Đợt Đăng Ký Học Phần Mới"
        description="Thiết lập tên đợt và thời gian cho phép học viên SĐH đăng ký môn"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMoDotModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="dot-moi-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Kích Hoạt Đợt Đăng Ký
            </Button>
          </>
        }
      >
        <form
          id="dot-moi-form"
          onSubmit={handleCreateDotMoi}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tên Đợt Đăng Ký
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Đợt Đăng Ký Bổ Sung - Học kỳ 1 2026-2027"
              required
              value={formDotMoi.tenDot}
              onChange={(e) =>
                setFormDotMoi({ ...formDotMoi, tenDot: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Học Kỳ & Năm Học
            </label>
            <input
              type="text"
              required
              value={formDotMoi.hocKy}
              onChange={(e) =>
                setFormDotMoi({ ...formDotMoi, hocKy: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ngày Bắt Đầu
              </label>
              <input
                type="date"
                required
                value={formDotMoi.tuNgay}
                onChange={(e) =>
                  setFormDotMoi({ ...formDotMoi, tuNgay: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ngày Kết Thúc
              </label>
              <input
                type="date"
                required
                value={formDotMoi.denNgay}
                onChange={(e) =>
                  setFormDotMoi({ ...formDotMoi, denNgay: e.target.value })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* 6. Modal Cấu Hình Thời Gian */}
      <Modal
        isOpen={isCauHinhModalOpen}
        onClose={() => setIsCauHinhModalOpen(false)}
        title="Cấu Hình Thời Gian Đợt Đăng Ký Hiện Tại"
        description="Gia hạn hoặc điều chỉnh thời gian mở cổng cho học viên"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCauHinhModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="cauhinh-form"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              Cập Nhật Thời Gian
            </Button>
          </>
        }
      >
        <form
          id="cauhinh-form"
          onSubmit={handleSaveCauHinh}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Thời Gian Bắt Đầu
            </label>
            <input
              type="date"
              required
              value={dotDangKy.tuNgay}
              onChange={(e) =>
                setDotDangKy({ ...dotDangKy, tuNgay: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Thời Gian Kết Thúc
            </label>
            <input
              type="date"
              required
              value={dotDangKy.denNgay}
              onChange={(e) =>
                setDotDangKy({ ...dotDangKy, denNgay: e.target.value })
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* 7. Modal Xem Chi Tiết Lớp Học Phần */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Chi Tiết Lớp Học Phần SĐH"
        description={`Mã lớp: ${selectedClass?.maLop}`}
        size="lg"
      >
        {selectedClass && (
          <div className="space-y-4 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-base">
                {selectedClass.tenHocPhan}
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-slate-500 block">
                    Giảng viên đảm nhận:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedClass.giangVien}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Số tín chỉ:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedClass.soTinChi} TC
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Lịch học:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedClass.lichHoc}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Địa điểm:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedClass.phongHoc}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-500 block">
                  Tình trạng đăng ký sĩ số:
                </span>
                <span className="font-bold text-slate-900">
                  {selectedClass.daDangKy} / {selectedClass.siSoToiDa} học viên
                </span>
              </div>
              <div>{getStatusBadge(selectedClass.trangThai)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
