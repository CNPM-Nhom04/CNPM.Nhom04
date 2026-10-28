"use client";
import { useEffect, useState } from "react";
import { Sliders, Save, RefreshCw, Shield, Settings } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { AdminFeedback } from "@/components/admin/AdminFeedback";
import { adminRequest, type AdminSettings } from "@/lib/services/adminService";

export default function CauHinhPage() {
  const [config, setConfig] = useState<AdminSettings>({
    maxTinChiHocKy: "",
    minTinChiTotNghiepThacSi: "",
    minTinChiTotNghiepTienSi: "",
    diemDatHocPhan: "",
    thoiHanDangKyToiDa: "",
    ngoaiNguBatBuocThacSi: "",
    ngoaiNguBatBuocTienSi: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    adminRequest<AdminSettings>("cau-hinh", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setConfig(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason
              : new Error("Không thể tải cấu hình."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [version]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setConfig((previous) => ({ ...previous, [name]: value }));
  };
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || saving) return;
    setSaving(true);
    setError(null);
    setMessage("");
    try {
      const result = await adminRequest<AdminSettings>("cau-hinh", {
        method: "PUT",
        body: JSON.stringify(config),
      });
      setConfig(result);
      setMessage("Đã lưu cấu hình tham số.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Không thể lưu cấu hình."),
      );
    } finally {
      setSaving(false);
    }
  };
  const handleReset = async () => {
    if (!confirm("Khôi phục và lưu toàn bộ tham số đào tạo về mặc định?"))
      return;
    setSaving(true);
    setError(null);
    setMessage("");
    try {
      const result = await adminRequest<AdminSettings>("cau-hinh/mac-dinh", {
        method: "POST",
        body: "{}",
      });
      setConfig(result);
      setMessage("Đã khôi phục cấu hình mặc định.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Không thể đặt lại cấu hình."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <AdminFeedback
        error={error}
        message={message}
        retry={() => {
          setLoading(true);
          setVersion((value) => value + 1);
        }}
      />
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Đang tải cấu hình...
        </p>
      )}
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
        <fieldset
          disabled={loading || saving || !config.maxTinChiHocKy}
          className="space-y-6"
        >
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
              <Button
                variant="outline"
                type="button"
                onClick={handleReset}
                disabled={saving}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Đặt lại mặc định
              </Button>
              <Button
                type="submit"
                isLoading={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Lưu Cấu Hình Tham Số
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
