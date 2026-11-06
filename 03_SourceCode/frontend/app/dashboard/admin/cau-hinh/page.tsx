"use client";
import { ExcelOnlyForm } from "@/components/excel/ExcelOnlyForm";
import { useEffect, useState } from "react";
import { Sliders, Save, RefreshCw, Shield, Settings } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { AdminFeedback } from "@/components/admin/AdminFeedback";
import {
  adminRequest,
  type AdminSettings,
  type AdminSettingsOptions,
} from "@/lib/services/adminService";

export default function CauHinhPage() {
  const [config, setConfig] = useState<AdminSettings>({
    diemDatHocPhan: "",
    ngoaiNguBatBuocThacSi: "",
    ngoaiNguBatBuocTienSi: "",
  });
  const [languageRequirements, setLanguageRequirements] = useState<string[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      adminRequest<AdminSettings>("cau-hinh", { signal: controller.signal }),
      adminRequest<AdminSettingsOptions>("cau-hinh/options", {
        signal: controller.signal,
      }),
    ])
      .then(([result, options]) => {
        if (!controller.signal.aborted) {
          setConfig(result);
          setLanguageRequirements(options.languageRequirements);
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

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
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
            Thiết lập điểm đạt học phần và danh sách chuẩn ngoại ngữ. Định mức
            tín chỉ được quản lý theo từng CTĐT và hướng đào tạo.
          </p>
        </div>
      </div>

      {/* 2. Form cấu hình */}
      {!loading && config.diemDatHocPhan && (
        <dl className="grid gap-3 md:grid-cols-2 text-sm">
          <div className="rounded-xl border bg-white p-4">
            <dt className="text-slate-500">Chuẩn ngoại ngữ Thạc sĩ</dt>
            <dd className="mt-1 font-semibold">
              {config.ngoaiNguBatBuocThacSi}
            </dd>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <dt className="text-slate-500">Chuẩn ngoại ngữ Tiến sĩ</dt>
            <dd className="mt-1 font-semibold">
              {config.ngoaiNguBatBuocTienSi}
            </dd>
          </div>
        </dl>
      )}
      {!loading && !error && (
        <ExcelOnlyForm
          onSubmit={handleSave}
          className="space-y-6"
          heading="Thêm / sửa cấu hình đào tạo bằng Excel"
          recordLabel="Tham số đào tạo sau đại học"
          downloadFilename="Cau_hinh_dao_tao.xlsx"
          showDependentStep={false}
          description="Mẫu có sẵn cấu hình hiện tại. Chỉ sửa dòng 2; hai cột chuẩn ngoại ngữ chọn từ danh sách thả xuống. Xem trước thay đổi trước khi lưu."
        >
          <fieldset
            disabled={loading || saving || !config.diemDatHocPhan}
            className="space-y-6"
          >
            {/* Khối 1: Quy định tín chỉ & Điểm số */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-blue-600" />
                <h2 className="font-bold text-slate-800 text-sm">
                  1. Điểm đạt học phần
                </h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Điểm Đạt Tối Thiểu Học Phần SĐH (Thang 10)
                  </label>
                  <Input
                    id="diemDatHocPhan"
                    aria-label="Điểm đạt tối thiểu học phần (thang 10)"
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.01"
                    name="diemDatHocPhan"
                    value={config.diemDatHocPhan}
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
                  2. Chuẩn ngoại ngữ
                </h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Chuẩn Ngoại Ngữ Bắt Buộc (Bậc Thạc Sĩ)
                  </label>
                  <Select
                    id="ngoaiNguBatBuocThacSi"
                    aria-label="Chuẩn ngoại ngữ bắt buộc — Thạc sĩ"
                    options={languageRequirements.map((value) => ({
                      value,
                      label: value,
                    }))}
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
                  <Select
                    id="ngoaiNguBatBuocTienSi"
                    aria-label="Chuẩn ngoại ngữ bắt buộc — Tiến sĩ"
                    options={languageRequirements.map((value) => ({
                      value,
                      label: value,
                    }))}
                    name="ngoaiNguBatBuocTienSi"
                    value={config.ngoaiNguBatBuocTienSi}
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
        </ExcelOnlyForm>
      )}
    </div>
  );
}
