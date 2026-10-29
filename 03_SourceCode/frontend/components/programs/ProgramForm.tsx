"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, BookOpen, Award, Clock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ProgramFeedback } from "./ProgramFeedback";
import {
  programRequest,
  programService,
  type ProgramInput,
  type ProgramOptions,
  type ProgramRecord,
} from "@/lib/services/programService";
const empty: ProgramInput = {
  maCTDT: "",
  maPhienBan: "v1",
  tenCTDT: "",
  tenTiengAnh: "",
  educationLevelId: "",
  managingUnitId: "",
  majorId: "",
  hinhThucDaoTao: "CHINH_QUY",
  thoiGianDaoTao: "",
  khoaTuyenSinh: "",
  tongTinChiYeuCau: 0,
  chuanDauRaTiengAnh: "",
  chuanDauRaTinHoc: "",
  soQuyetDinhBanHanh: "",
  ngayBanHanh: undefined,
  moTa: "",
};
const fieldClass =
  "w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white";
export function ProgramForm() {
  const router = useRouter(),
    searchParams = useSearchParams(),
    editId = searchParams.get("edit"),
    baseId = searchParams.get("programId");
  const [form, setForm] = useState<ProgramInput>({ ...empty }),
    [options, setOptions] = useState<ProgramOptions | null>(null),
    [record, setRecord] = useState<ProgramRecord | null>(null);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [version, setVersion] = useState(0);
  const editable =
    (!editId && (!!baseId || !!options?.canCreateProgram)) ||
    (!!record?.permissions.canEdit &&
      ["DRAFT", "RETURNED"].includes(record.status));
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      programRequest<ProgramOptions>("/options", { signal: controller.signal }),
      editId
        ? programService.detail(editId, controller.signal)
        : baseId
          ? programRequest<ProgramInput>("/danh-muc/" + baseId, {
              signal: controller.signal,
            })
          : Promise.resolve(null),
    ])
      .then(([data, item]) => {
        if (controller.signal.aborted) return;
        setOptions(data);
        setRecord(item && "status" in item ? (item as ProgramRecord) : null);
        setError(null);
        if (item)
          setForm({
            ...empty,
            ...item,
            ngayBanHanh: item.ngayBanHanh || undefined,
          });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason
              : new Error("Không thể tải thông tin."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [editId, baseId, version]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !editable) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, ngayBanHanh: form.ngayBanHanh || undefined };
      const item = editId
        ? await programService.update(editId, payload)
        : baseId
          ? await programRequest<ProgramRecord>(
              "/danh-muc/" + baseId + "/phien-ban",
              { method: "POST", body: JSON.stringify(payload) },
            )
          : await programService.create(payload);
      router.push(`/dashboard/chuong-trinh-dao-tao/${item.id}/build`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason : new Error("Không thể lưu CTĐT."),
      );
    } finally {
      setSaving(false);
    }
  }
  function text(
    key: keyof ProgramInput,
    label: string,
    max = 255,
    type = "text",
    required = false,
  ) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={key} className="text-xs font-bold text-slate-700">
          {label}
          {required && " *"}
        </label>
        <Input
          id={key}
          type={type}
          maxLength={max}
          required={required}
          value={form[key] ?? ""}
          onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        />
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="bg-white p-5 rounded-xl border flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Button>
        <div>
          <h1 className="text-lg font-bold">
            {editId
              ? "Cập nhật thông tin CTĐT"
              : "Thêm mới Chương trình Đào tạo"}
          </h1>
          <p className="text-xs text-slate-500">
            Thông tin tổng quan, chuẩn đầu ra và căn cứ pháp lý
          </p>
        </div>
      </div>
      <ProgramFeedback
        error={error}
        retry={
          !options
            ? () => {
                setLoading(true);
                setVersion((value) => value + 1);
              }
            : undefined
        }
      />
      {loading && <p role="status">Đang tải danh mục...</p>}
      {!editable && !loading && (
        <p className="text-sm text-amber-700">
          Phiên bản này không được phép chỉnh sửa.
        </p>
      )}
      <form onSubmit={save}>
        <fieldset
          disabled={loading || saving || !options || !editable}
          className="space-y-6"
        >
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="bg-slate-50 p-4 font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              1. Thông tin tổng quan & Quản lý
            </h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="maCTDT" className="text-xs font-bold">
                  Mã chương trình *
                </label>
                <Input
                  id="maCTDT"
                  required
                  maxLength={50}
                  pattern="[A-Za-z0-9_-]+"
                  disabled={!!editId || !!baseId}
                  value={form.maCTDT}
                  onChange={(event) =>
                    setForm({ ...form, maCTDT: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="degree" className="text-xs font-bold">
                  Bậc đào tạo *
                </label>
                <select
                  id="degree"
                  required
                  disabled={!!editId || !!baseId}
                  className={fieldClass}
                  value={form.educationLevelId}
                  onChange={(event) => {
                    const degree = options?.levels.find(
                      (level) => level.id === event.target.value,
                    );
                    setForm({
                      ...form,
                      educationLevelId: event.target.value,
                      tongTinChiYeuCau: degree?.minCredits
                        ? Number(degree.minCredits)
                        : form.tongTinChiYeuCau,
                    });
                  }}
                >
                  <option value="">Chọn bậc đào tạo</option>
                  {options?.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="version-code" className="text-xs font-bold">
                  Mã phiên bản *
                </label>
                <Input
                  id="version-code"
                  required
                  maxLength={50}
                  disabled={!!editId}
                  value={form.maPhienBan || ""}
                  onChange={(event) =>
                    setForm({ ...form, maPhienBan: event.target.value })
                  }
                />
              </div>
              {text(
                "tenCTDT",
                "Tên chương trình (Tiếng Việt)",
                255,
                "text",
                true,
              )}
              {text("tenTiengAnh", "Tên chương trình (Tiếng Anh)")}
              <div className="space-y-1.5">
                <label htmlFor="unit" className="text-xs font-bold">
                  Khoa / đơn vị quản lý *
                </label>
                <select
                  id="unit"
                  required
                  disabled={!!editId || !!baseId}
                  className={fieldClass}
                  value={form.managingUnitId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      managingUnitId: event.target.value,
                      majorId: "",
                    })
                  }
                >
                  <option value="">Chọn đơn vị</option>
                  {options?.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="major" className="text-xs font-bold">
                  Ngành đào tạo *
                </label>
                <select
                  id="major"
                  required
                  disabled={!!editId || !!baseId}
                  className={fieldClass}
                  value={form.majorId}
                  onChange={(event) =>
                    setForm({ ...form, majorId: event.target.value })
                  }
                >
                  <option value="">Chọn ngành</option>
                  {options?.majors
                    .filter((major) =>
                      major.unitIds.includes(form.managingUnitId),
                    )
                    .map((major) => (
                      <option key={major.id} value={major.id}>
                        {major.name}
                      </option>
                    ))}
                </select>
              </div>
              {text(
                "khoaTuyenSinh",
                "Khóa / niên khóa (VD: 2026 - 2028)",
                50,
                "text",
                true,
              )}
              <div className="space-y-1.5">
                <label htmlFor="credits" className="text-xs font-bold">
                  Định mức tín chỉ mỗi hướng *
                </label>
                <Input
                  id="credits"
                  type="number"
                  min="1"
                  max="9999"
                  step="0.01"
                  required
                  value={form.tongTinChiYeuCau}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      tongTinChiYeuCau: Number(event.target.value),
                    })
                  }
                />
              </div>
            </div>
          </section>
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="bg-slate-50 p-4 font-semibold flex gap-2 items-center">
              <Clock className="h-4 w-4" />
              2. Hình thức & Thời gian đào tạo
            </h2>
            <div className="p-6 grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="mode" className="text-xs font-bold">
                  Hình thức đào tạo
                </label>
                <select
                  id="mode"
                  required
                  className={fieldClass}
                  value={form.hinhThucDaoTao}
                  onChange={(event) =>
                    setForm({ ...form, hinhThucDaoTao: event.target.value })
                  }
                >
                  <option value="">Chưa khai báo — chọn hình thức</option>
                  <option value="CHINH_QUY">Chính quy</option>
                  <option value="VUA_LAM_VUA_HOC">Vừa làm vừa học</option>
                  <option value="LIEN_KET">Liên kết đào tạo</option>
                </select>
              </div>
              {text("thoiGianDaoTao", "Thời gian đào tạo chuẩn", 150)}
            </div>
          </section>
          <section className="bg-white rounded-xl border overflow-hidden">
            <h2 className="bg-slate-50 p-4 font-semibold flex gap-2 items-center">
              <Award className="h-4 w-4" />
              3. Chuẩn đầu ra & Pháp lý ban hành
            </h2>
            <div className="p-6 grid md:grid-cols-2 gap-5">
              {text("chuanDauRaTiengAnh", "Chuẩn yêu cầu ngoại ngữ", 500)}
              {text("chuanDauRaTinHoc", "Chuẩn kỹ năng CNTT", 500)}
              {text("soQuyetDinhBanHanh", "Số quyết định ban hành", 150)}
              {text("ngayBanHanh", "Ngày ban hành / hiệu lực", 10, "date")}
              <p className="md:col-span-2 text-xs text-slate-500">
                Bổ sung số và ngày quyết định trước khi gửi hồ sơ để có thể ban
                hành.
              </p>
              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="description" className="text-xs font-bold">
                  Mô tả mục tiêu & đối tượng đào tạo
                </label>
                <textarea
                  id="description"
                  rows={3}
                  maxLength={10000}
                  className="w-full border rounded-lg p-3 text-sm"
                  value={form.moTa}
                  onChange={(event) =>
                    setForm({ ...form, moTa: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Hủy bỏ
              </Button>
              <Button type="submit" isLoading={saving}>
                <Save className="h-4 w-4 mr-1" />
                Lưu & Chuyển Sang Xây Dựng Cấu Trúc
              </Button>
            </div>
          </section>
        </fieldset>
      </form>
    </div>
  );
}
