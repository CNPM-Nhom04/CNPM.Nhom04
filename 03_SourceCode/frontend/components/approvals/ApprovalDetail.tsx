"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  approvalService,
  type ApprovalDetail as Detail,
} from "@/lib/services/approvalService";
import type { ReviewInput } from "@/lib/services/programService";
import {
  requestLabels,
  formatDate,
  inputClass,
  buttonClass,
} from "./ApprovalList";
const actionLabels: Record<string, string> = {
  SUBMIT: "Gửi xét duyệt",
  START_REVIEW: "Bắt đầu thẩm định",
  APPROVE: "Phê duyệt",
  RETURN: "Trả về",
  CANCEL: "Thu hồi",
};
const conclusions: Record<string, string> = {
  DAT_DIEU_KIEN: "Đạt điều kiện — phê duyệt và ban hành",
  YEU_CAU_SUA_DOI: "Yêu cầu chỉnh sửa, bổ sung",
  KHONG_DAT: "Không đạt — trả hồ sơ",
};
type ReviewForm = Omit<ReviewInput, "ketLuan"> & {
  ketLuan: ReviewInput["ketLuan"] | "";
};
const blank: ReviewForm = {
  hoiDongThamDinh: "",
  chuTichHoidong: "",
  thuKhao: "",
  ngayHop: "",
  ketLuan: "",
  yKienDongGop: "",
  soBienBan: "",
};
const localDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function ApprovalDetail({ id }: { id: string }) {
  const [item, setItem] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState("");
  const [form, setForm] = useState<ReviewForm>({ ...blank }),
    [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    approvalService
      .detail(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setItem(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setItem(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  function refresh() {
    setLoading(true);
    setMessage("");
    setRetry((x) => x + 1);
  }
  async function start() {
    if (!item || busy || !item.permissions.canStart) return;
    setBusy("start");
    setError("");
    setMessage("");
    try {
      setItem(await approvalService.start(item));
      setMessage("Đã ghi nhận bắt đầu thẩm định.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể bắt đầu thẩm định.");
    } finally {
      setBusy("");
    }
  }
  function choose(candidate: File | undefined) {
    setError("");
    if (!candidate) {
      setFile(null);
      return;
    }
    if (
      candidate.size === 0 ||
      candidate.size > 25 * 1024 * 1024 ||
      !/\.(pdf|docx)$/i.test(candidate.name)
    ) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError("Chỉ nhận PDF/DOCX có nội dung, tối đa 25MB.");
      return;
    }
    setFile(candidate);
  }
  async function upload() {
    if (!item || !file || busy || !item.permissions.canUpload) return;
    setBusy("upload");
    setError("");
    setMessage("");
    try {
      await approvalService.upload(item.id, file);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setItem(await approvalService.detail(id));
      setMessage("Đã lưu tài liệu gắn đúng lượt duyệt.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải tài liệu.");
    } finally {
      setBusy("");
    }
  }
  async function decide(event: FormEvent) {
    event.preventDefault();
    if (!item || busy || !item.permissions.canDecide || !form.ketLuan) return;
    if (file) {
      setError("Hãy tải tệp đã chọn lên hoặc bỏ chọn trước khi lưu kết luận.");
      return;
    }
    if (
      !window.confirm(
        form.ketLuan === "DAT_DIEU_KIEN"
          ? "Phê duyệt và ban hành phiên bản này? Phiên bản sẽ được khóa chỉnh sửa."
          : "Xác nhận trả hồ sơ kèm kết luận và lý do?",
      )
    )
      return;
    setBusy("decision");
    setError("");
    setMessage("");
    try {
      setItem(
        await approvalService.decide(item, { ...form, ketLuan: form.ketLuan }),
      );
      setForm({ ...blank });
      setMessage("Đã lưu kết luận, biên bản và lịch sử xét duyệt.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu kết luận.");
    } finally {
      setBusy("");
    }
  }
  const textFields: {
    key:
      | "hoiDongThamDinh"
      | "chuTichHoidong"
      | "thuKhao"
      | "soBienBan"
      | "ngayHop";
    label: string;
    required: boolean;
    max: number;
    type?: string;
  }[] = [
    {
      key: "hoiDongThamDinh",
      label: "Tên hội đồng / ban thẩm định",
      required: true,
      max: 255,
    },
    {
      key: "chuTichHoidong",
      label: "Chủ tịch hội đồng",
      required: true,
      max: 255,
    },
    { key: "thuKhao", label: "Thư ký khoa học", required: true, max: 255 },
    { key: "soBienBan", label: "Số biên bản", required: false, max: 150 },
    {
      key: "ngayHop",
      label: "Ngày họp thẩm định",
      required: true,
      max: 10,
      type: "date",
    },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <Link
            className="text-sm text-blue-700 underline"
            href="/dashboard/xet-duyet"
          >
            ← Danh sách hồ sơ
          </Link>
          <h1 className="mt-2 text-xl font-bold">Xét Duyệt & Thẩm Định CTĐT</h1>
          <p className="mt-1">{item?.requestNo}</p>
        </div>
        <button
          className={buttonClass}
          disabled={!!busy || loading}
          onClick={refresh}
        >
          Tải lại hồ sơ
        </button>
      </header>
      {loading && <p role="status">Đang tải hồ sơ...</p>}
      {error && (
        <p
          role="alert"
          className="whitespace-pre-line rounded-xl bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {message}
        </p>
      )}
      {!loading && item && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">
              {item.programCode} — {item.programName}
            </h2>
            <p className="mt-2">
              {item.versionCode} · {item.unitName} · {item.levelName}
            </p>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <div>
                <dt className="font-semibold">Trạng thái lượt duyệt</dt>
                <dd>{requestLabels[item.status] || item.status}</dd>
              </div>
              <div>
                <dt className="font-semibold">Người gửi</dt>
                <dd>
                  {item.requesterName} · {formatDate(item.requestedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Bắt đầu thẩm định</dt>
                <dd>
                  {formatDate(item.reviewStartedAt)} ·{" "}
                  {item.reviewerName || "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Hoàn tất</dt>
                <dd>{formatDate(item.completedAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold">
                  Nhắc duyệt đã ghi nhận trong SQL
                </dt>
                <dd>
                  {item.reminderCount} lần · lần gần nhất{" "}
                  {formatDate(item.lastRemindedAt)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Lịch nhắc tiếp theo trong SQL</dt>
                <dd>{formatDate(item.nextReminderAt)}</dd>
              </div>
            </dl>
            {item.latestComment && (
              <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">
                {item.latestComment}
              </p>
            )}
            {item.permissions.canStart && (
              <button
                className={buttonClass + " mt-4 text-blue-700"}
                disabled={!!busy}
                onClick={start}
              >
                {busy === "start" ? "Đang lưu..." : "Bắt đầu thẩm định"}
              </button>
            )}
            {item.status === "PENDING" && !item.permissions.canDecide && (
              <p className="mt-3 text-amber-800">
                Bạn không thể xử lý hồ sơ này. Người gửi không được tự thẩm
                định; phiên bản cũng phải còn ở trạng thái được xét duyệt.
              </p>
            )}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">
              Thông tin và cấu trúc phiên bản hiện tại
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Lịch sử từng lượt duyệt giữ biên bản và hành động. Cấu trúc dưới
              đây là dữ liệu hiện tại của phiên bản trong SQL.
            </p>
            <p className="mt-3 text-sm">
              Quyết định: {item.program.soQuyetDinhBanHanh || "—"} · Ngày quyết
              định: {item.program.ngayBanHanh || "—"}
            </p>
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2">Hướng</th>
                    <th className="p-2">Định mức TC</th>
                    <th className="p-2">Số HP</th>
                  </tr>
                </thead>
                <tbody>
                  {item.program.tracks.map((t) => (
                    <tr key={t.id} className="border-t border-slate-200">
                      <td className="p-2">
                        {t.code} — {t.name}
                      </td>
                      <td className="p-2">{t.requiredCredits}</td>
                      <td className="p-2">{t.courses.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link
              className="text-sm text-blue-700 underline"
              href={
                "/dashboard/chuong-trinh-dao-tao/" + item.versionId + "/build"
              }
            >
              Xem đầy đủ thông tin, học phần, tiên quyết và chuẩn đầu ra
            </Link>
          </section>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">Tài liệu của lượt duyệt</h2>
            {!item.documents.length && (
              <p className="text-sm text-slate-600">
                Chưa có tài liệu được lưu.
              </p>
            )}
            {item.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-slate-200 p-3 text-sm"
              >
                <a
                  className="text-blue-700 underline"
                  href={"/api/xet-duyet/" + item.id + "/tai-lieu/" + doc.id}
                >
                  {doc.name}
                </a>
                <p>
                  {(doc.size / 1024).toFixed(1)} KB · {doc.uploaderName} ·{" "}
                  {formatDate(doc.uploadedAt)}
                </p>
                {!doc.requestId && (
                  <p className="text-amber-800">
                    Tài liệu cũ của phiên bản, SQL chưa xác định thuộc lượt
                    duyệt nào.
                  </p>
                )}
              </div>
            ))}
            {item.permissions.canUpload && (
              <fieldset
                disabled={!!busy}
                className="space-y-3 rounded-lg bg-slate-50 p-4"
              >
                <label
                  className="block text-sm font-semibold"
                  htmlFor="approval-file"
                >
                  Đính kèm biên bản / tài liệu thẩm định
                </label>
                <input
                  id="approval-file"
                  className="block max-w-full text-sm text-slate-950"
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                <p className="text-sm text-slate-600">
                  PDF hoặc DOCX có nội dung, tối đa 25MB. Tải lên trước khi lưu
                  kết luận.
                </p>
                {file && (
                  <div className="flex flex-wrap gap-3">
                    <span className="text-sm">{file.name}</span>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => choose(undefined)}
                    >
                      Bỏ chọn tệp
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={upload}
                    >
                      {busy === "upload" ? "Đang tải..." : "Tải lên hồ sơ"}
                    </button>
                  </div>
                )}
              </fieldset>
            )}
          </section>
          {item.minutes && (
            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Biên bản đã lưu của lượt duyệt này</h2>
              {textFields.map((f) => (
                <p key={f.key}>
                  <strong>{f.label}: </strong>
                  {item.minutes?.[f.key] || "—"}
                </p>
              ))}
              <p>
                <strong>Kết luận: </strong>
                {conclusions[item.minutes.ketLuan] || item.minutes.ketLuan}
              </p>
              <p className="whitespace-pre-wrap">
                <strong>Ý kiến: </strong>
                {item.minutes.yKienDongGop || "—"}
              </p>
              <p className="text-sm text-slate-600">
                Ghi nhận lúc {formatDate(item.minutes.recordedAt)}
              </p>
            </section>
          )}
          {item.status !== "PENDING" && !item.minutes && (
            <p className="rounded-xl bg-slate-100 p-4">
              CSDL chưa có biên bản chi tiết cho lượt duyệt này. Kết quả và lịch
              sử vẫn được hiển thị đúng dữ liệu đã lưu.
            </p>
          )}
          {item.permissions.canDecide && (
            <form
              onSubmit={decide}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h2 className="mb-4 font-bold">Lưu kết luận thẩm định</h2>
              <fieldset disabled={!!busy} className="grid gap-4 md:grid-cols-2">
                {textFields.map((f) => (
                  <label
                    key={f.key}
                    className="space-y-2 text-sm font-semibold"
                  >
                    {f.label}
                    {f.required ? " *" : ""}
                    <input
                      className={inputClass + " block w-full font-normal"}
                      required={f.required}
                      maxLength={f.max}
                      type={f.type || "text"}
                      value={form[f.key]}
                      min={
                        f.type === "date"
                          ? localDay(new Date(item.requestedAt))
                          : undefined
                      }
                      max={f.type === "date" ? localDay(new Date()) : undefined}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="space-y-2 text-sm font-semibold">
                  Kết luận *
                  <select
                    aria-label="Kết luận thẩm định"
                    className={inputClass + " block w-full font-normal"}
                    required
                    value={form.ketLuan}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ketLuan: e.target.value as ReviewForm["ketLuan"],
                      })
                    }
                  >
                    <option value="">Chọn kết luận</option>
                    {Object.entries(conclusions).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold md:col-span-2">
                  Ý kiến / lý do
                  {form.ketLuan && form.ketLuan !== "DAT_DIEU_KIEN" ? " *" : ""}
                  <textarea
                    className={inputClass + " block w-full font-normal"}
                    rows={4}
                    maxLength={10000}
                    required={
                      !!form.ketLuan && form.ketLuan !== "DAT_DIEU_KIEN"
                    }
                    value={form.yKienDongGop}
                    onChange={(e) =>
                      setForm({ ...form, yKienDongGop: e.target.value })
                    }
                  />
                </label>
                <p className="text-sm font-normal text-slate-600 md:col-span-2">
                  Đạt điều kiện sẽ ban hành và khóa phiên bản; hai kết luận còn
                  lại trả về để cán bộ chỉnh sửa và gửi lại thành lượt mới.
                </p>
                <button
                  type="submit"
                  className={
                    buttonClass + " bg-blue-600! text-white! md:col-span-2"
                  }
                  disabled={!form.ketLuan || !!file}
                >
                  {busy === "decision"
                    ? "Đang lưu..."
                    : "Lưu kết luận thẩm định"}
                </button>
              </fieldset>
            </form>
          )}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 font-bold">Lịch sử hành động của lượt duyệt</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Thời gian",
                      "Người thực hiện",
                      "Hành động",
                      "Nội dung",
                    ].map((x) => (
                      <th key={x} className="p-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.actions.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200">
                      <td className="p-3">{formatDate(a.createdAt)}</td>
                      <td className="p-3">{a.actorName}</td>
                      <td className="p-3">
                        {actionLabels[a.action] || a.action}
                      </td>
                      <td className="whitespace-pre-wrap p-3">
                        {a.comment || "—"}
                      </td>
                    </tr>
                  ))}
                  {!item.actions.length && (
                    <tr>
                      <td colSpan={4} className="p-3">
                        CSDL chưa ghi nhận hành động.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
