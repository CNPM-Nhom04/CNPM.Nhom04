"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  graduationService,
  type PolicyResponse,
} from "@/lib/services/graduationService";
export const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:text-slate-600";
export const button =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 disabled:opacity-50";
export function GraduationPolicyForm({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<PolicyResponse | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({
    requireGpa: "",
    minimumGpa: "",
    requireLanguage: "",
    languageRule: "",
    requireDefense: "",
    otherRequirements: "",
    reference: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    graduationService
      .policy(id, controller.signal)
      .then((r) => {
        if (controller.signal.aborted) return;
        setData(r);
        setError("");
        if (r.policy) {
          const p = r.policy;
          setForm({
            requireGpa: p.requireGpa ? "yes" : "no",
            minimumGpa: p.minimumGpa == null ? "" : String(p.minimumGpa),
            requireLanguage: p.requireLanguage ? "yes" : "no",
            languageRule: p.languageRule || "",
            requireDefense: p.requireDefense ? "yes" : "no",
            otherRequirements: p.otherRequirements || "",
            reference: p.reference,
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, retry]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!data?.permissions.canPolicy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await graduationService.savePolicy(id, {
        revision: data.policy?.revision || 0,
        requireGpa: form.requireGpa === "yes",
        minimumGpa:
          form.requireGpa === "yes" && form.minimumGpa !== ""
            ? Number(form.minimumGpa)
            : null,
        requireLanguage: form.requireLanguage === "yes",
        languageRule: form.requireLanguage === "yes" ? form.languageRule : null,
        requireDefense: form.requireDefense === "yes",
        otherRequirements: form.otherRequirements || null,
        reference: form.reference,
      });
      setData(updated);
      setMessage(
        "Đã lưu quy định vào SQL. Hồ sơ xác minh theo quy định cũ cần được đối chiếu lại.",
      );
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {error && (
        <p role="alert" className="text-red-800">
          {error}{" "}
          <button className={button} onClick={() => setRetry((x) => x + 1)}>
            Tải lại quy định
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="text-green-800">
          {message}
        </p>
      )}
      {!data && !error && <p>Đang đọc quy định...</p>}
      {data && (
        <>
          <h2 className="font-bold">
            {data.track.programCode} / {data.track.versionCode} /{" "}
            {data.track.code}
          </h2>
          {!data.policy && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              CSDL chưa có quy định cho hướng này. Không tự đặt ngưỡng ĐTB,
              ngoại ngữ hoặc yêu cầu bảo vệ.
            </p>
          )}
          <form onSubmit={save}>
            <fieldset
              disabled={busy || !data.permissions.canPolicy}
              className="grid gap-4 md:grid-cols-2"
            >
              {(
                ["requireGpa", "requireLanguage", "requireDefense"] as const
              ).map((key) => (
                <label key={key} className="space-y-2 text-sm font-semibold">
                  {key === "requireGpa"
                    ? "Có yêu cầu ĐTB chính thức?"
                    : key === "requireLanguage"
                      ? "Có yêu cầu chuẩn ngoại ngữ?"
                      : "Có yêu cầu bảo vệ đạt?"}
                  <select
                    aria-label={
                      key === "requireGpa"
                        ? "Yêu cầu ĐTB"
                        : key === "requireLanguage"
                          ? "Yêu cầu ngoại ngữ"
                          : "Yêu cầu bảo vệ"
                    }
                    className={control}
                    required
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  >
                    <option value="">Chọn theo quy định thực tế</option>
                    <option value="yes">Có yêu cầu</option>
                    <option value="no">Không yêu cầu</option>
                  </select>
                </label>
              ))}
              <label className="space-y-2 text-sm font-semibold">
                ĐTB tối thiểu (thang 10)
                <input
                  aria-label="ĐTB tối thiểu"
                  className={control}
                  type="number"
                  min="0.01"
                  max="10"
                  step="0.01"
                  required={form.requireGpa === "yes"}
                  disabled={form.requireGpa !== "yes"}
                  value={form.requireGpa === "yes" ? form.minimumGpa : ""}
                  onChange={(e) =>
                    setForm({ ...form, minimumGpa: e.target.value })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2">
                Chuẩn ngoại ngữ theo văn bản
                <textarea
                  aria-label="Chuẩn ngoại ngữ theo văn bản"
                  className={control}
                  maxLength={2000}
                  required={form.requireLanguage === "yes"}
                  disabled={form.requireLanguage !== "yes"}
                  value={
                    form.requireLanguage === "yes" ? form.languageRule : ""
                  }
                  onChange={(e) =>
                    setForm({ ...form, languageRule: e.target.value })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2">
                Tiêu chí khác cần xác minh (nếu có)
                <textarea
                  aria-label="Tiêu chí khác"
                  className={control}
                  maxLength={2000}
                  value={form.otherRequirements}
                  onChange={(e) =>
                    setForm({ ...form, otherRequirements: e.target.value })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2">
                Căn cứ quy định *
                <input
                  aria-label="Căn cứ quy định"
                  className={control}
                  required
                  maxLength={255}
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                />
              </label>
              {data.permissions.canPolicy && (
                <button className={button + " md:col-span-2"} type="submit">
                  {busy ? "Đang lưu..." : "Lưu quy định"}
                </button>
              )}
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
