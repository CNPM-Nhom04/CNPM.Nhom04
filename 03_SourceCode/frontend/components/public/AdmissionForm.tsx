"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  portalRequest,
  type PublicOptions,
} from "@/lib/services/portalService";
const input =
  "w-full rounded border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";
const initial = {
  familyName: "",
  givenName: "",
  email: "",
  phone: "",
  levelId: "",
  majorId: "",
  gender: "",
  previousMajor: "",
  graduationYear: "",
  message: "",
  website: "",
  consent: false,
};
export function AdmissionForm() {
  const [options, setOptions] = useState<PublicOptions | null>(null),
    [form, setForm] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    portalRequest<PublicOptions>("options", { signal: abort.signal })
      .then(setOptions)
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Chưa tải được bậc đào tạo và ngành quan tâm. Vui lòng thử lại.",
          );
      });
    return () => abort.abort();
  }, [reload]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !options) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await portalRequest<{ message: string }>(
        "dang-ky-thong-tin",
        {
          method: "POST",
          body: JSON.stringify({
            familyName: form.familyName,
            givenName: form.givenName,
            email: form.email,
            phone: form.phone,
            levelId: form.levelId,
            ...(form.majorId ? { majorId: form.majorId } : {}),
            ...(form.gender ? { gender: form.gender } : {}),
            ...(form.previousMajor
              ? { previousMajor: form.previousMajor }
              : {}),
            ...(form.graduationYear
              ? { graduationYear: Number(form.graduationYear) }
              : {}),
            ...(form.message ? { message: form.message } : {}),
            website: form.website,
            consent: form.consent,
          }),
        },
      );
      setSuccess(result.message);
      setForm(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi đăng ký.");
    } finally {
      setBusy(false);
    }
  }
  const field = (
    name:
      | "familyName"
      | "givenName"
      | "email"
      | "phone"
      | "previousMajor"
      | "graduationYear",
    label: string,
    required = false,
    type = "text",
    maxLength = 255,
  ) => (
    <label className="block space-y-2 text-sm font-medium text-slate-700">
      {label}
      {required && <span className="ml-1 text-red-600">*</span>}
      <input
        aria-label={label}
        className={input}
        value={form[name]}
        type={type}
        required={required}
        maxLength={maxLength}
        {...(name === "graduationYear"
          ? { min: 1900, max: new Date().getFullYear() }
          : {})}
        autoComplete={
          name === "email"
            ? "email"
            : name === "phone"
              ? "tel"
              : name === "familyName"
                ? "family-name"
                : name === "givenName"
                  ? "given-name"
                  : undefined
        }
        disabled={busy}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      aria-label="Đăng ký nhận thông tin tuyển sinh"
    >
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Thông tin tuyển sinh cần nhận <span className="text-red-600">*</span>
        <select
          aria-label="Thông tin tuyển sinh cần nhận"
          className={input}
          required
          disabled={busy || !options}
          value={form.levelId}
          onChange={(e) => setForm({ ...form, levelId: e.target.value })}
        >
          <option value="">Chọn bậc đào tạo bạn quan tâm</option>
          {options?.levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-5 md:grid-cols-2">
        {field("familyName", "Họ lót", true, "text", 150)}
        {field("givenName", "Tên", true, "text", 100)}
        {field("email", "Email", true, "email")}
        {field("phone", "Số điện thoại", true, "tel", 30)}
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Giới tính
          <select
            aria-label="Giới tính"
            className={input}
            value={form.gender}
            disabled={busy}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="">Không cung cấp</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium text-slate-700">
          Ngành quan tâm
          <select
            aria-label="Ngành quan tâm"
            className={input}
            value={form.majorId}
            disabled={busy || !options}
            onChange={(e) => setForm({ ...form, majorId: e.target.value })}
          >
            <option value="">Chưa chọn ngành</option>
            {options?.majors.map((major) => (
              <option key={major.id} value={major.id}>
                {major.name} — {major.unitName}
              </option>
            ))}
          </select>
        </label>
        {field("previousMajor", "Ngành đã tốt nghiệp")}
        {field("graduationYear", "Năm tốt nghiệp", false, "number")}
      </div>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Thông tin bổ sung / nội dung cần tư vấn
        <textarea
          aria-label="Nội dung cần tư vấn"
          className={input + " min-h-28"}
          maxLength={2000}
          value={form.message}
          disabled={busy}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </label>
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </label>
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
        <input
          type="checkbox"
          required
          disabled={busy}
          checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
        />
        Tôi đồng ý cung cấp thông tin trên để được liên hệ, tư vấn và nhận thông
        tin tuyển sinh. Đây không phải hồ sơ đăng ký dự tuyển hoặc đăng ký tài
        khoản.
      </label>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
          {!options && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setError("");
                setReload((n) => n + 1);
              }}
            >
              Thử lại
            </button>
          )}
        </div>
      )}
      {success && (
        <p
          role="status"
          className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
        >
          <CheckCircle2 size={20} className="shrink-0" />
          {success}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <p className="text-xs text-slate-500">
          Thông tin có dấu <span className="text-red-600">*</span> là bắt buộc.
        </p>
        <button
          type="submit"
          disabled={busy || !options}
          className="inline-flex items-center gap-4 rounded bg-[#087b62] px-7 py-3.5 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {busy ? "Đang gửi..." : "Đăng ký nhận thông tin"}
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
}
