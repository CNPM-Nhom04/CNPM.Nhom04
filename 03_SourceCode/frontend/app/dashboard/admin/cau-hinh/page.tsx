"use client";

import { useState } from "react";
import {
  Sliders,
  Save,
  RefreshCw,
  Shield,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { Button, Input } from "@/components/ui";

export default function CauHinhPage() {
  const [config, setConfig] = useState({
    maxTinChiHocKy: "18",
    minTinChiTotNghiepThacSi: "60",
    minTinChiTotNghiepTienSi: "90",
    diemDatHocPhan: "5.5",
    thoiHanDangKyToiDa: "14",
    ngoaiNguBatBuocThacSi: "VSTEP B2 / IELTS 6.0",
    ngoaiNguBatBuocTienSi: "IELTS 6.5",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Cấu hình tham số hệ thống:", config);
    alert("Đã lưu cấu hình tham số hệ thống thành công!");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header tiêu đề */}
      <div className="bg-white px-6 py-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Sliders className="h-6 w-6 text-blue-600" />
            Cấu Hình Tham Số Hệ Thống Đào Tạo SĐH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Thiết lập các quy tắc kiểm tra định mức tín chỉ, chuẩn đầu ra và
            giới hạn đăng ký toàn hệ thống
          </p>
        </div>
      </div>

      {/* 2. Form cấu hình */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Khối 1: Quy định tín chỉ & Điểm số */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              1. Quy Định Tín Chỉ & Ngưỡng Đánh Giá
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Số Tín Chỉ Tối Đa Mỗi Học Kỳ (Học viên)
              </label>
              <Input
                name="maxTinChiHocKy"
                value={config.maxTinChiHocKy}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Điểm Đạt Tối Thiểu Học Phần SĐH (Thang 10)
              </label>
              <Input
                name="diemDatHocPhan"
                value={config.diemDatHocPhan}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Định Mức Tín Chỉ Thạc Sĩ (Mặc định)
              </label>
              <Input
                name="minTinChiTotNghiepThacSi"
                value={config.minTinChiTotNghiepThacSi}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Định Mức Tín Chỉ Tiến Sĩ (Mặc định)
              </label>
              <Input
                name="minTinChiTotNghiepTienSi"
                value={config.minTinChiTotNghiepTienSi}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Chuẩn đầu ra & Thời hạn */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              2. Chuẩn Đầu Ra & Vận Hành Đăng Ký
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Chuẩn Ngoại Ngữ Bắt Buộc (Bậc Thạc Sĩ)
              </label>
              <Input
                name="ngoaiNguBatBuocThacSi"
                value={config.ngoaiNguBatBuocThacSi}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Chuẩn Ngoại Ngữ Bắt Buộc (Bậc Tiến Sĩ)
              </label>
              <Input
                name="ngoaiNguBatBuocTienSi"
                value={config.ngoaiNguBatBuocTienSi}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Thời Hạn Mở Đăng Ký Tín Chỉ Tối Đa (Ngày)
              </label>
              <Input
                name="thoiHanDangKyToiDa"
                value={config.thoiHanDangKyToiDa}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <Button variant="outline" type="button">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Đặt lại mặc định
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Lưu Cấu Hình Tham Số
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
