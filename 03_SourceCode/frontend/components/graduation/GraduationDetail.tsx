"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  graduationService,
  type GraduationDetail as Detail,
  type GraduationHistory,
} from "@/lib/services/graduationService";
import { control, button } from "./GraduationPolicyForm";
export const statusLabels: Record<string, string> = {
  DU_DIEN_KIEN: "Đủ điều kiện theo dữ liệu đã đối chiếu",
  CHUA_DU_DIEN_KIEN: "Chưa đủ điều kiện",
  THIEU_THONG_TIN: "Thiếu thông tin",
};
export const criterionLabels: Record<string, string> = {
  MET: "Đạt",
  NOT_MET: "Chưa đạt",
  UNKNOWN: "Thiếu thông tin",
  NOT_REQUIRED: "Không yêu cầu",
};
export const when = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })
    : "Chưa lưu lần kiểm tra";
function EvidenceForm({
  data,
  onSaved,
}: {
  data: Detail;
  onSaved: (value: Detail) => void;
}) {
  const e = data.input.evidence,
    p = data.input.policy;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({
    gpa: e?.gpa == null ? "" : String(e.gpa),
    gpaReference: e?.gpaReference || "",
    languageState: e?.languageState || "UNKNOWN",
    languageReference: e?.languageReference || "",
    languageValidUntil: e?.languageValidUntil || "",
    languageNoExpiry: e?.languageNoExpiry || false,
    otherState: e?.otherState || "UNKNOWN",
    otherReference: e?.otherReference || "",
  });
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!p || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      onSaved(
        await graduationService.evidence(data.input.assignmentId, {
          ...form,
          revision: e?.revision || 0,
          policyRevision: p.revision,
          gpa: form.gpa === "" ? null : Number(form.gpa),
          gpaReference: form.gpaReference || null,
          languageReference: form.languageReference || null,
          languageValidUntil: form.languageNoExpiry
            ? null
            : form.languageValidUntil || null,
          otherReference: form.otherReference || null,
        }),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu hồ sơ.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-xl border border-slate-200 p-4"
    >
      <h3 className="font-bold">Xác minh ĐTB và hồ sơ chuẩn đầu ra</h3>
      {!p && (
        <p className="text-amber-900">
          Cần người có quyền lưu quy định cho hướng này trước khi xác minh hồ
          sơ.
        </p>
      )}
      {e && p && e.policyRevision !== p.revision && (
        <p className="text-amber-900">
          Quy định đã đổi; cần đối chiếu và xác minh lại. Dữ liệu cũ không tự
          được xác nhận theo quy định mới.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      <fieldset disabled={busy || !p} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          ĐTB chính thức (thang 10, để trống nếu chưa có)
          <input
            aria-label="ĐTB chính thức"
            className={control}
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={form.gpa}
            onChange={(event) => setForm({ ...form, gpa: event.target.value })}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Căn cứ ĐTB (bảng điểm/hồ sơ đã đối chiếu)
          <input
            aria-label="Căn cứ ĐTB"
            className={control}
            maxLength={255}
            required={form.gpa !== ""}
            value={form.gpaReference}
            onChange={(event) =>
              setForm({ ...form, gpaReference: event.target.value })
            }
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Kết quả xác minh ngoại ngữ
          <select
            aria-label="Kết quả xác minh ngoại ngữ"
            className={control}
            value={form.languageState}
            onChange={(event) =>
              setForm({
                ...form,
                languageState: event.target.value as typeof form.languageState,
              })
            }
          >
            <option value="UNKNOWN">Chưa xác minh</option>
            <option value="MET">Đạt theo hồ sơ thực tế</option>
            <option value="NOT_MET">Chưa đạt</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Căn cứ ngoại ngữ
          <input
            aria-label="Căn cứ ngoại ngữ"
            className={control}
            maxLength={255}
            required={form.languageState !== "UNKNOWN"}
            value={form.languageReference}
            onChange={(event) =>
              setForm({ ...form, languageReference: event.target.value })
            }
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Ngoại ngữ có hiệu lực đến ngày
          <input
            aria-label="Ngoại ngữ có hiệu lực đến"
            className={control}
            type="date"
            disabled={form.languageNoExpiry}
            required={form.languageState === "MET" && !form.languageNoExpiry}
            value={form.languageNoExpiry ? "" : form.languageValidUntil}
            onChange={(event) =>
              setForm({ ...form, languageValidUntil: event.target.value })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.languageNoExpiry}
            onChange={(event) =>
              setForm({ ...form, languageNoExpiry: event.target.checked })
            }
          />
          Hồ sơ xác định không quy định ngày hết hạn ngoại ngữ
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Tiêu chí khác theo quy định
          <select
            aria-label="Kết quả tiêu chí khác"
            className={control}
            value={form.otherState}
            onChange={(event) =>
              setForm({
                ...form,
                otherState: event.target.value as typeof form.otherState,
              })
            }
          >
            <option value="UNKNOWN">Chưa xác minh</option>
            <option value="MET">Đã đáp ứng</option>
            <option value="NOT_MET">Chưa đáp ứng</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Căn cứ tiêu chí khác
          <input
            aria-label="Căn cứ tiêu chí khác"
            className={control}
            maxLength={255}
            required={form.otherState !== "UNKNOWN"}
            value={form.otherReference}
            onChange={(event) =>
              setForm({ ...form, otherReference: event.target.value })
            }
          />
        </label>
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input
            aria-label="Xác nhận đã đối chiếu hồ sơ"
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Tôi đã đối chiếu dữ liệu nhập với hồ sơ thực tế và quy định hiện tại;
          không suy ra ĐTB từ các điểm rời rạc chưa có quy tắc quy đổi.
        </label>
        <button
          className={button + " md:col-span-2"}
          type="submit"
          disabled={!confirmed}
        >
          {busy ? "Đang lưu..." : "Lưu xác minh vào SQL"}
        </button>
      </fieldset>
    </form>
  );
}
function describeHistory(value: unknown) {
  const data = value as {
    evaluation?: {
      status: string;
      earnedCredits: number;
      requiredCredits: number;
    };
    after?: { reference?: string; gpa?: number | null; languageState?: string };
  };
  if (data?.evaluation)
    return (
      (statusLabels[data.evaluation.status] || data.evaluation.status) +
      " — " +
      data.evaluation.earnedCredits +
      "/" +
      data.evaluation.requiredCredits +
      " TC"
    );
  if (data?.after?.reference) return "Căn cứ: " + data.after.reference;
  if (data?.after)
    return (
      "ĐTB chính thức: " +
      (data.after.gpa ?? "—") +
      "; ngoại ngữ: " +
      (criterionLabels[data.after.languageState || "UNKNOWN"] ||
        "Chưa xác minh")
    );
  return "Dữ liệu đã được lưu theo hồ sơ.";
}
export function GraduationDetail({
  id,
  onChanged,
}: {
  id: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<GraduationHistory | null>(null),
    [historyBusy, setHistoryBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    graduationService
      .detail(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  async function check() {
    setBusy(true);
    setError("");
    try {
      setData(await graduationService.check(id));
      onChanged();
      setHistory(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kiểm tra.");
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory(page: number) {
    setHistoryBusy(true);
    setError("");
    try {
      setHistory(await graduationService.history(id, page));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải lịch sử.");
    } finally {
      setHistoryBusy(false);
    }
  }
  return (
    <div className="space-y-5 text-slate-950">
      {error && (
        <p role="alert" className="whitespace-pre-line text-red-800">
          {error}{" "}
          <button
            className={button}
            onClick={() => {
              setLoading(true);
              setRetry((x) => x + 1);
            }}
          >
            Tải lại hồ sơ
          </button>
        </p>
      )}
      {loading && <p role="status">Đang đối chiếu SQL...</p>}
      {data && !loading && (
        <>
          <section className="space-y-2 rounded-xl bg-slate-50 p-4">
            <h3 className="font-bold">
              {data.input.studentCode} — {data.input.studentName}
            </h3>
            <p className="text-sm">
              {data.input.programName} / {data.input.versionCode} /{" "}
              {data.input.trackName}
            </p>
            <p className="text-sm">
              {data.input.unitName} · {data.input.levelName}
            </p>
            <p className="font-semibold">
              {statusLabels[data.evaluation.status]}
            </p>
            <p className="text-sm">
              Lần lưu kiểm tra gần nhất: {when(data.checkedAt)}
              {data.changedSinceCheck
                ? " · Dữ liệu/quy định đã thay đổi sau lần kiểm tra đó."
                : ""}
            </p>
            <p className="text-sm text-slate-600">
              Kết quả hiển thị được đối chiếu lại từ SQL hiện tại; đây chưa phải
              quyết định công nhận tốt nghiệp hay cấp bằng.
            </p>
            {data.permissions.canCheck && (
              <button className={button} disabled={busy} onClick={check}>
                {busy ? "Đang lưu..." : "Kiểm tra và lưu kết quả"}
              </button>
            )}
          </section>
          <section className="space-y-3">
            <h3 className="font-bold">Các tiêu chí được đối chiếu</h3>
            {data.evaluation.criteria.map((c) => (
              <div
                key={c.code}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex justify-between gap-3">
                  <strong className="text-sm">{c.label}</strong>
                  <span
                    className={
                      c.state === "MET"
                        ? "text-green-800"
                        : c.state === "NOT_MET"
                          ? "text-red-800"
                          : "text-amber-900"
                    }
                  >
                    {criterionLabels[c.state]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {c.message}
                </p>
              </div>
            ))}
          </section>
          <section className="space-y-2 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold">Hồ sơ xác minh đang lưu</h3>
            <p className="text-sm">
              ĐTB chính thức: {data.input.evidence?.gpa ?? "—"} · Căn cứ:{" "}
              {data.input.evidence?.gpaReference || "—"}
            </p>
            <p className="text-sm">
              Căn cứ ngoại ngữ: {data.input.evidence?.languageReference || "—"}
            </p>
            <p className="text-sm">
              Căn cứ tiêu chí khác: {data.input.evidence?.otherReference || "—"}
            </p>
            <p className="text-sm">
              Xác minh lúc:{" "}
              {data.input.evidence
                ? when(data.input.evidence.verifiedAt)
                : "Chưa có hồ sơ"}
            </p>
          </section>
          <section className="space-y-2 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold">
              Kết quả bảo vệ đang lưu cho lần phân công này
            </h3>
            {!data.input.defenses.length ? (
              <p className="text-sm">
                SQL chưa có lịch/kết quả bảo vệ cho hồ sơ này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Ngày bảo vệ</th>
                      <th className="p-2">Kết quả</th>
                      <th className="p-2">Điểm hội đồng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.input.defenses.map((d) => (
                      <tr key={d.id} className="border-t border-slate-200">
                        <td className="p-2">{d.date}</td>
                        <td className="p-2">
                          {(
                            {
                              CHO_BAO_VE: "Chờ bảo vệ",
                              DA_DAT: "Đạt",
                              CHUA_DAT: "Chưa đạt",
                              DA_HUY: "Đã hủy",
                            } as Record<string, string>
                          )[d.status] || d.status}
                        </td>
                        <td className="p-2">{d.score ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {data.permissions.canEvidence && (
            <EvidenceForm
              key={
                (data.input.evidence?.revision || 0) +
                ":" +
                (data.input.policy?.revision || 0)
              }
              data={data}
              onSaved={(value) => {
                setData(value);
                setHistory(null);
                onChanged();
              }}
            />
          )}
          <section className="overflow-x-auto">
            <h3 className="mb-2 font-bold">Tín chỉ theo nhóm kiến thức</h3>
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead>
                <tr>
                  {["Nhóm", "Đã đạt (sau trần)", "Tối thiểu", "Tối đa"].map(
                    (x) => (
                      <th key={x} className="p-2">
                        {x}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.evaluation.groups.map((g) => (
                  <tr key={g.id} className="border-t border-slate-200">
                    <td className="p-2">
                      {g.code} — {g.name}
                    </td>
                    <td className="p-2">{g.earned}</td>
                    <td className="p-2">{g.minimum}</td>
                    <td className="p-2">{g.maximum ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="overflow-x-auto">
            <h3 className="mb-2 font-bold">
              Học phần trong hướng được phân công
            </h3>
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Mã HP",
                    "Học phần",
                    "TC",
                    "Tính chất",
                    "Kết quả đối chiếu",
                  ].map((x) => (
                    <th key={x} className="p-2">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.evaluation.courses.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200">
                    <td className="p-2">{c.code}</td>
                    <td className="p-2">{c.name}</td>
                    <td className="p-2">{c.credits}</td>
                    <td className="p-2">
                      {c.required ? "Bắt buộc" : "Tự chọn"}
                    </td>
                    <td className="p-2">
                      {c.passed
                        ? "Đã đạt/miễn đúng phiên bản"
                        : c.otherVersionPassed
                          ? "Đạt phiên bản khác; chưa có căn cứ công nhận tương đương"
                          : "Chưa có kết quả đạt/miễn đúng phiên bản"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-slate-600">
              Tín chỉ chỉ lấy trong cấu trúc này. Điểm 0, kết quả miễn và dữ
              liệu chưa có được giữ riêng; không tự chuyển điểm chữ sang điểm
              số.
            </p>
          </section>
          <section className="space-y-3">
            <h3 className="font-bold">Lịch sử kiểm tra và xác minh</h3>
            <button
              className={button}
              disabled={historyBusy}
              onClick={() => loadHistory(1)}
            >
              {historyBusy ? "Đang tải..." : "Xem lịch sử đã lưu"}
            </button>
            {history && (
              <>
                <ul className="space-y-2">
                  {history.data.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <strong>
                        {e.eventType === "CHECK"
                          ? "Kiểm tra"
                          : e.eventType === "POLICY"
                            ? "Cập nhật quy định"
                            : "Xác minh hồ sơ"}
                      </strong>{" "}
                      · {e.actorName} · {when(e.createdAt)}
                      <p className="mt-1">{describeHistory(e.data)}</p>
                    </li>
                  ))}
                </ul>
                {!history.data.length && <p>Chưa có lịch sử.</p>}
                <div className="flex items-center gap-3">
                  <button
                    className={button}
                    disabled={historyBusy || history.meta.page <= 1}
                    onClick={() => loadHistory(history.meta.page - 1)}
                  >
                    Trước
                  </button>
                  <span>
                    Trang {history.meta.totalPages ? history.meta.page : 0}/
                    {history.meta.totalPages}
                  </span>
                  <button
                    className={button}
                    disabled={
                      historyBusy ||
                      history.meta.page >= history.meta.totalPages
                    }
                    onClick={() => loadHistory(history.meta.page + 1)}
                  >
                    Sau
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
