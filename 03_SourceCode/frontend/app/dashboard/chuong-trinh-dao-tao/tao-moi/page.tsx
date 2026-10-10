"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  BookOpen,
  GraduationCap,
  FileText,
  Award,
  Clock,
} from "lucide-react";
import { Button, Input } from "@/components/ui";

export default function TaoMoiCTDTPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    maCTDT: "MS-KHMT-2026",
    tenCTDT: "Thạc sĩ Khoa học Máy tính",
    tenTiengAnh: "Master of Computer Science",
    bacDaoTao: "ThacSi",
    hinhThucDaoTao: "CHINH_QUY",
    thoiGianDaoTao: "2 năm (4 học kỳ)",
    khoaQuanLy: "Khoa Công nghệ Thông tin",
    khoaTuyenSinh: "2026 - 2028",
    tongTinChiYeuCau: 60,
    // Bổ sung các chuẩn đầu ra & pháp lý
    chuanDauRaTiengAnh: "VSTEP Level 4 (B2) / IELTS 6.0",
    chuanDauRaTinHoc: "Đạt chuẩn kỹ năng CNTT nâng cao",
    soQuyetDinhBanHanh: "QĐ-123/QĐ-ĐHAG-2026",
    ngayBanHanh: "2026-08-15",
    moTa: "Chương trình đào tạo trình độ thạc sĩ cung cấp kiến thức chuyên sâu về trí tuệ nhân tạo, khoa học dữ liệu và phần mềm ứng dụng.",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Dữ liệu khai báo CTĐT:", formData);
    // Điều hướng sang màn hình Xây dựng cấu trúc học phần sau khi lưu thông tin chung
    router.push("/dashboard/chuong-trinh-dao-tao/ctdt-moi/build");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* 1. Header tác vụ */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Thêm mới Chương trình Đào tạo
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Khai báo thông tin tổng quan, chuẩn đầu ra và căn cứ pháp lý trước
              khi thiết lập cấu trúc
            </p>
          </div>
        </div>
      </div>

      {/* 2. Form nhập liệu */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Khối 1: Thông tin định danh & Quản lý */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              1. Thông tin tổng quan & Quản lý
            </h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Mã CTĐT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Mã Chương Trình <span className="text-red-500">*</span>
                </label>
                <Input
                  name="maCTDT"
                  value={formData.maCTDT}
                  onChange={handleChange}
                  placeholder="VD: MS-KHMT-2026"
                  required
                />
              </div>

              {/* Bậc đào tạo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bậc Đào Tạo <span className="text-red-500">*</span>
                </label>
                <select
                  name="bacDaoTao"
                  value={formData.bacDaoTao}
                  onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ThacSi">Thạc sĩ</option>
                  <option value="TienSi">Tiến sĩ</option>
                  <option value="DaiHoc">Đại học chính quy</option>
                </select>
              </div>
            </div>

            {/* Tên CTĐT tiếng Việt & tiếng Anh */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tên Chương Trình (Tiếng Việt){" "}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  name="tenCTDT"
                  value={formData.tenCTDT}
                  onChange={handleChange}
                  placeholder="VD: Thạc sĩ Khoa học Máy tính"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tên Chương Trình (Tiếng Anh)
                </label>
                <Input
                  name="tenTiengAnh"
                  value={formData.tenTiengAnh}
                  onChange={handleChange}
                  placeholder="VD: Master of Computer Science"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Đơn vị quản lý */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Khoa / Đơn vị quản lý
                </label>
                <Input
                  name="khoaQuanLy"
                  value={formData.khoaQuanLy}
                  onChange={handleChange}
                />
              </div>

              {/* Khóa tuyển sinh */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Khóa / Niên Khóa
                </label>
                <Input
                  name="khoaTuyenSinh"
                  value={formData.khoaTuyenSinh}
                  onChange={handleChange}
                  placeholder="VD: 2026 - 2028"
                />
              </div>

              {/* Định mức tín chỉ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Định Mức Tín Chỉ <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  name="tongTinChiYeuCau"
                  value={formData.tongTinChiYeuCau}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Khối 2: Hình thức & Thời gian đào tạo */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              2. Hình thức & Thời gian đào tạo
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Hình thức đào tạo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Hình Thức Đào Tạo <span className="text-red-500">*</span>
              </label>
              <select
                name="hinhThucDaoTao"
                value={formData.hinhThucDaoTao}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CHINH_QUY">Chính quy</option>
                <option value="VUA_LAM_VUA_HOC">Vừa làm vừa học</option>
                <option value="LIEN_KET">Liên kết đào tạo</option>
              </select>
            </div>

            {/* Thời gian đào tạo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Thời Gian Đào Tạo Chuẩn
              </label>
              <Input
                name="thoiGianDaoTao"
                value={formData.thoiGianDaoTao}
                onChange={handleChange}
                placeholder="VD: 2 năm (4 học kỳ)"
              />
            </div>
          </div>
        </div>

        {/* Khối 3: Chuẩn đầu ra (PLO) & Căn cứ pháp lý */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <Award className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              3. Yêu cầu chuẩn đầu ra & Pháp lý ban hành
            </h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Chuẩn Ngoại ngữ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chuẩn Yêu Cầu Ngoại Ngữ
                </label>
                <Input
                  name="chuanDauRaTiengAnh"
                  value={formData.chuanDauRaTiengAnh}
                  onChange={handleChange}
                  placeholder="VD: VSTEP B2 / IELTS 6.0"
                />
              </div>

              {/* Chuẩn CNTT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Chuẩn Kỹ Năng Bổ Trợ / CNTT
                </label>
                <Input
                  name="chuanDauRaTinHoc"
                  value={formData.chuanDauRaTinHoc}
                  onChange={handleChange}
                  placeholder="VD: Đạt chuẩn CNTT nâng cao"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Số Quyết định */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Số Quyết Định Ban Hành
                </label>
                <Input
                  name="soQuyetDinhBanHanh"
                  value={formData.soQuyetDinhBanHanh}
                  onChange={handleChange}
                  placeholder="VD: QĐ-123/QĐ-ĐHAG-2026"
                />
              </div>

              {/* Ngày ban hành */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ngày Ban Hành / Hiệu Lực
                </label>
                <Input
                  type="date"
                  name="ngayBanHanh"
                  value={formData.ngayBanHanh}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Mô tả chi tiết */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mô Tả Mục Tiêu & Đối Tượng Đào Tạo
              </label>
              <textarea
                name="moTa"
                rows={3}
                value={formData.moTa}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập thông tin mục tiêu đào tạo tổng quát..."
              />
            </div>
          </div>

          {/* Footer nút hành động */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Lưu & Chuyển Sang Xây Dựng Cấu Trúc
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
