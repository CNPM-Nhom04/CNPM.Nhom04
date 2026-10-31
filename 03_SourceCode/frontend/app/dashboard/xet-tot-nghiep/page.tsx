"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Award, ShieldCheck, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  graduationService,
  type GraduationOptions,
  type GraduationPage,
} from "@/lib/services/graduationService";
import {
  GraduationDetail,
  criterionLabels,
  statusLabels,
  when,
} from "@/components/graduation/GraduationDetail";
import {
  GraduationPolicyForm,
  control,
  button,
} from "@/components/graduation/GraduationPolicyForm";
export default function GraduationPage() {
  const [tab, setTab] = useState("students"),
    [options, setOptions] = useState<GraduationOptions | null>(null),
    [optionsError, setOptionsError] = useState(""),
    [optionsRetry, setOptionsRetry] = useState(0);
  const [search, setSearch] = useState(""),
    [level, setLevel] = useState(""),
    [status, setStatus] = useState("ALL"),
    [assignment, setAssignment] = useState("ACTIVE"),
    [page, setPage] = useState(1);
  const [result, setResult] = useState<GraduationPage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null),
    [track, setTrack] = useState(""),
    [showAuto, setShowAuto] = useState(false),
    [autoLevel, setAutoLevel] = useState("");
  const [processing, setProcessing] = useState(false),
    [processed, setProcessed] = useState(0);
  const stop = useRef(false);
  useEffect(() => {
    let active = true;
    graduationService
      .options()
      .then((data) => {
        if (active) {
          setOptions(data);
          setOptionsError("");
        }
      })
      .catch((e) => {
        if (active) setOptionsError(e.message);
      });
    return () => {
      active = false;
    };
  }, [optionsRetry]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      graduationService
        .list(
          {
            searchTerm: search,
            status,
            assignmentStatus: assignment,
            page: String(page),
            limit: "20",
            ...(level ? { educationLevelId: level } : {}),
          },
          controller.signal,
        )
        .then((data) => {
          if (!controller.signal.aborted) {
            setResult(data);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setResult(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, assignment, level, page, retry]);
  function refresh() {
    setLoading(true);
    setRetry((x) => x + 1);
  }
  function filter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
    setLoading(true);
  }
  async function run(event: FormEvent) {
    event.preventDefault();
    if (!autoLevel || processing) return;
    setProcessing(true);
    setProcessed(0);
    setError("");
    setMessage("");
    stop.current = false;
    let count = 0,
      afterId: string | undefined;
    try {
      while (!stop.current) {
        const response = await graduationService.batch({
          educationLevelId: autoLevel,
          afterId,
          limit: 25,
        });
        count += response.checked;
        setProcessed(count);
        if (!response.hasMore) break;
        if (
          !response.nextAfterId ||
          response.nextAfterId === afterId ||
          response.checked === 0
        )
          throw new Error(
            "Không thể tiếp tục lô kiểm tra. Các kết quả đã lưu vẫn được giữ.",
          );
        afterId = response.nextAfterId;
      }
      setMessage(
        (stop.current ? "Đã dừng sau lô hiện tại. " : "Đã hoàn tất. ") +
          "Đã lưu " +
          count +
          " hồ sơ trong phạm vi và bậc đã chọn.",
      );
      setShowAuto(false);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Không thể kiểm tra.") +
          " Đã lưu " +
          count +
          " hồ sơ trước đó.",
      );
    } finally {
      setProcessing(false);
      refresh();
    }
  }
  const permissions = options?.permissions || result?.permissions;
  return (
    <div className="space-y-6 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Award className="text-blue-600" />
            Xét Điều Kiện Tốt Nghiệp
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Đối chiếu tín chỉ, hồ sơ chuẩn đầu ra và bảo vệ từ CSDL theo đúng
            phiên bản/hướng được phân công.
          </p>
        </div>
        {permissions?.canCheck && (
          <button
            className={button}
            disabled={processing || !options?.levels.length}
            onClick={() => {
              setShowAuto(true);
              setProcessed(0);
            }}
          >
            <ShieldCheck className="mr-2 inline h-4 w-4" />
            Chạy kiểm tra theo bậc
          </button>
        )}
      </header>
      <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
        Kết quả là đối chiếu điều kiện hiện tại, chưa phải quyết định công nhận
        tốt nghiệp/cấp bằng. Thiếu quy định hoặc minh chứng sẽ được ghi rõ;
        không tự điền ĐTB 7,0, IELTS 6,0 hay định mức 60/90 TC.
      </p>
      {optionsError && (
        <p role="alert" className="text-red-800">
          {optionsError}{" "}
          <button
            className={button}
            onClick={() => setOptionsRetry((x) => x + 1)}
          >
            Tải lại danh mục
          </button>
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="whitespace-pre-line rounded-xl bg-red-50 p-4 text-red-800"
        >
          {error}{" "}
          <button className={button} onClick={refresh}>
            Thử lại
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">
          {message}
        </p>
      )}
      <nav className="flex flex-wrap gap-3">
        <button
          className={
            button +
            (tab === "students" ? " border-blue-600 text-blue-800" : "")
          }
          onClick={() => setTab("students")}
        >
          Học viên & kiểm tra
        </button>
        <button
          className={
            button + (tab === "policy" ? " border-blue-600 text-blue-800" : "")
          }
          onClick={() => setTab("policy")}
        >
          Quy định xét tốt nghiệp
        </button>
      </nav>
      {tab === "policy" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Chọn đúng phiên bản và hướng để xem/nhập căn cứ quy định thực tế.
            Chỉ tài khoản được cấp GRADUATION_POLICY mới được lưu.
          </p>
          <select
            aria-label="Hướng áp dụng quy định tốt nghiệp"
            className={control}
            value={track}
            onChange={(e) => setTrack(e.target.value)}
          >
            <option value="">Chọn hướng từ CSDL</option>
            {options?.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.programCode} / {t.versionCode} / {t.code} — {t.name} —{" "}
                {t.unitName}
              </option>
            ))}
          </select>
          {track && (
            <GraduationPolicyForm key={track} id={track} onChanged={refresh} />
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(statusLabels).map(([key, label]) => (
              <section
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-sm text-slate-600">{label}</p>
                <strong className="mt-2 block text-2xl">
                  {loading
                    ? "—"
                    : (result?.summary[key as keyof typeof result.summary] ??
                      "—")}
                </strong>
              </section>
            ))}
          </div>
          <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <input
              className={control + " min-w-64 flex-1"}
              aria-label="Tìm hồ sơ tốt nghiệp"
              maxLength={255}
              placeholder="Mã học viên, họ tên, mã/tên chương trình..."
              value={search}
              onChange={(e) => filter(setSearch, e.target.value)}
            />
            <select
              className={control + " md:w-auto"}
              aria-label="Bậc đào tạo xét tốt nghiệp"
              value={level}
              onChange={(e) => filter(setLevel, e.target.value)}
            >
              <option value="">Tất cả bậc trong phạm vi</option>
              {options?.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className={control + " md:w-auto"}
              aria-label="Trạng thái xét tốt nghiệp"
              value={status}
              onChange={(e) => filter(setStatus, e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái xét</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className={control + " md:w-auto"}
              aria-label="Trạng thái phân công CTĐT"
              value={assignment}
              onChange={(e) => filter(setAssignment, e.target.value)}
            >
              <option value="ACTIVE">Phân công đang hoạt động</option>
              <option value="ENDED">Phân công đã kết thúc</option>
              <option value="ALL">Tất cả lần phân công</option>
            </select>
          </section>
          <p className="text-sm text-slate-600">
            Mỗi dòng là một lần phân công CTĐT. Thống kê theo phạm vi/từ
            khóa/bậc/phân công, trước bộ lọc trạng thái xét.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {[
                    "Học viên / CTĐT",
                    "Phiên bản / Hướng",
                    "Tín chỉ / Định mức",
                    "ĐTB chính thức",
                    "Ngoại ngữ / Bảo vệ",
                    "Kết quả đối chiếu",
                    "Thao tác",
                  ].map((x) => (
                    <th key={x} className="p-4">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody aria-busy={loading}>
                {!loading &&
                  !error &&
                  result?.data.map((r) => (
                    <tr
                      key={r.assignmentId}
                      className="border-t border-slate-200 align-top"
                    >
                      <td className="p-4">
                        <strong>
                          {r.studentCode} — {r.studentName}
                        </strong>
                        <p className="mt-1">{r.programName}</p>
                        <p className="text-slate-600">
                          {r.unitName} · {r.levelName}
                        </p>
                      </td>
                      <td className="p-4">
                        {r.versionCode}
                        <p>{r.trackName}</p>
                      </td>
                      <td className="p-4 font-semibold">
                        {r.earnedCredits} / {r.requiredCredits} TC
                      </td>
                      <td className="p-4">{r.officialGpa ?? "—"}</td>
                      <td className="p-4">
                        <p>
                          Ngoại ngữ:{" "}
                          {criterionLabels[r.languageState] ||
                            "Thiếu thông tin"}
                        </p>
                        <p>
                          Bảo vệ:{" "}
                          {criterionLabels[r.defenseState] || "Thiếu thông tin"}
                        </p>
                      </td>
                      <td className="p-4">
                        <strong
                          className={
                            r.status === "DU_DIEN_KIEN"
                              ? "text-green-800"
                              : r.status === "THIEU_THONG_TIN"
                                ? "text-amber-900"
                                : "text-red-800"
                          }
                        >
                          {statusLabels[r.status]}
                        </strong>
                        <p className="mt-1 text-xs text-slate-600">
                          {when(r.checkedAt)}
                        </p>
                        {r.changedSinceCheck && (
                          <p className="mt-1 text-xs text-amber-900">
                            Nguồn đã thay đổi sau lần lưu
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          className={button}
                          onClick={() => setSelected(r.assignmentId)}
                        >
                          <Eye className="mr-1 inline h-4 w-4" />
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                {(loading || error || !result?.data.length) && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center" role="status">
                      {loading
                        ? "Đang đối chiếu SQL..."
                        : error
                          ? "Không thể tải dữ liệu."
                          : "Không có hồ sơ phân công phù hợp trong phạm vi tài khoản."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>Tổng {result?.meta.total ?? 0} hồ sơ phân công</span>
            <div className="flex items-center gap-3">
              <button
                className={button}
                disabled={loading || !!error || page <= 1}
                onClick={() => {
                  setPage((x) => x - 1);
                  setLoading(true);
                }}
              >
                Trang trước
              </button>
              <span>
                Trang {result?.meta.totalPages ? page : 0}/
                {result?.meta.totalPages ?? 0}
              </span>
              <button
                className={button}
                disabled={
                  loading || !!error || page >= (result?.meta.totalPages ?? 0)
                }
                onClick={() => {
                  setPage((x) => x + 1);
                  setLoading(true);
                }}
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      )}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Chi tiết đối chiếu điều kiện tốt nghiệp"
        size="2xl"
      >
        {selected && (
          <GraduationDetail key={selected} id={selected} onChanged={refresh} />
        )}
      </Modal>
      <Modal
        isOpen={showAuto}
        onClose={() => {
          if (!processing) setShowAuto(false);
        }}
        title="Kiểm tra điều kiện tốt nghiệp theo bậc"
        size="md"
      >
        <form onSubmit={run} className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold">
            Bậc đào tạo từ CSDL
            <select
              aria-label="Bậc cần kiểm tra"
              className={control}
              required
              disabled={processing}
              value={autoLevel}
              onChange={(e) => setAutoLevel(e.target.value)}
            >
              <option value="">Chọn bậc trong phạm vi</option>
              {options?.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-600">
            Đọc SQL theo từng lô các phân công ACTIVE trong phạm vi tài khoản,
            lưu tiêu chí và nguồn vào lịch sử. Không thay đổi điểm, trạng thái
            học viên hoặc cấp bằng.
          </p>
          {processing && (
            <p role="status">Đang kiểm tra... Đã lưu {processed} hồ sơ.</p>
          )}
          <div className="flex gap-3">
            <button
              className={button}
              type="submit"
              disabled={processing || !autoLevel}
            >
              Thực hiện kiểm tra
            </button>
            {processing ? (
              <button
                className={button}
                type="button"
                onClick={() => {
                  stop.current = true;
                }}
              >
                Dừng sau lô hiện tại
              </button>
            ) : (
              <button
                className={button}
                type="button"
                onClick={() => setShowAuto(false)}
              >
                Đóng
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
