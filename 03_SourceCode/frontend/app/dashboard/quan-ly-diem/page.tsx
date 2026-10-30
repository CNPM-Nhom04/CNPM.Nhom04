"use client";
import { FormEvent, useEffect, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useSessionUser } from "@/components/auth/SessionProvider";
import {
  gradeService as api,
  GradeItem,
  GradeDetail,
  GradeList,
  Page,
  Offering,
  Registration,
  PolicyResponse,
  ResultStatus,
} from "@/lib/services/gradeService";
const ctl =
  "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 disabled:bg-slate-100 disabled:text-slate-700";
const results: Record<ResultStatus, string> = {
  PASSED: "Đạt",
  FAILED: "Chưa đạt",
  INCOMPLETE: "Chưa hoàn tất",
  EXEMPTED: "Miễn học phần",
};
const states: Record<string, string> = {
  LEGACY: "Kết quả cũ",
  DRAFT: "Nháp",
  FINALIZED: "Đã chốt",
  VOIDED: "Đã hủy",
};
const historyLabels: Record<string, string> = {
  GRADE_CREATE: "Nhập nháp",
  GRADE_UPDATE: "Cập nhật nháp",
  GRADE_FINALIZE: "Chốt điểm",
  GRADE_CORRECT: "Điều chỉnh điểm đã chốt",
  GRADE_VOID: "Hủy hiệu lực",
  GRADE_REOPEN: "Mở lại nhập điểm",
  GRADE_LEGACY_CORRECT: "Điều chỉnh theo hồ sơ cũ",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Không thể thực hiện yêu cầu.";
const blankScores = () => ({
  attendanceScore: "",
  midtermScore: "",
  examScore: "",
});
const scoreNames = {
  attendanceScore: "Điểm chuyên cần",
  midtermScore: "Điểm giữa kỳ",
  examScore: "Điểm thi",
};
const blankPolicy = () => ({
  attendanceWeight: "",
  midtermWeight: "",
  examWeight: "",
  passingScore: "",
  decimalPlaces: "",
  rounding: "",
  reference: "",
});
export default function QuanLyDiemPage() {
  const user = useSessionUser();
  const [tab, setTab] = useState<"grades" | "classes">("grades");
  const [list, setList] = useState<GradeList | null>(null),
    [classes, setClasses] = useState<Page<Offering> | null>(null);
  const [search, setSearch] = useState(""),
    [resultStatus, setResultStatus] = useState("ALL"),
    [state, setState] = useState("ALL"),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<GradeDetail | null>(null),
    [detailError, setDetailError] = useState("");
  const [editor, setEditor] = useState<GradeDetail | "new" | null>(null),
    [scores, setScores] = useState(blankScores),
    [note, setNote] = useState(""),
    [reference, setReference] = useState(""),
    [formError, setFormError] = useState("");
  const [registration, setRegistration] = useState<Registration | null>(null),
    [registrationSearch, setRegistrationSearch] = useState(""),
    [registrationPage, setRegistrationPage] = useState(1),
    [registrations, setRegistrations] = useState<Page<Registration> | null>(
      null,
    ),
    [registrationLoading, setRegistrationLoading] = useState(false),
    [registrationError, setRegistrationError] = useState("");
  const [entryPolicy, setEntryPolicy] = useState<PolicyResponse | null>(null),
    [entryPolicyLoading, setEntryPolicyLoading] = useState(false),
    [entryPolicyError, setEntryPolicyError] = useState("");
  const [legacyGrade, setLegacyGrade] = useState(""),
    [legacyStatus, setLegacyStatus] = useState<ResultStatus>("INCOMPLETE"),
    [passedDate, setPassedDate] = useState("");
  const [policyModal, setPolicyModal] = useState<PolicyResponse | null>(null),
    [policyForm, setPolicyForm] = useState(blankPolicy),
    [policyError, setPolicyError] = useState("");
  const [action, setAction] = useState<"chot" | "huy" | "mo-lai" | null>(null),
    [actionNote, setActionNote] = useState(""),
    [actionReference, setActionReference] = useState(""),
    [actionError, setActionError] = useState("");
  const canManage =
    list?.permissions.canManage ?? !!user?.permissions.includes("GRADE_MANAGE");
  useEffect(() => {
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setLoading(true);
        setError("");
      }
    });
    const timer = setTimeout(() => {
      const job =
        tab === "grades"
          ? api
              .list(search, resultStatus, state, page, abort.signal)
              .then(setList)
          : api.classes(search, page, abort.signal).then(setClasses);
      job
        .catch((e) => {
          if (!abort.signal.aborted) setError(errorText(e));
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [tab, search, resultStatus, state, page, reload]);
  useEffect(() => {
    if (editor !== "new") return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setRegistrationLoading(true);
        setRegistrationError("");
      }
    });
    const timer = setTimeout(
      () =>
        api
          .registrations(registrationSearch, registrationPage, abort.signal)
          .then(setRegistrations)
          .catch((e) => {
            if (!abort.signal.aborted) setRegistrationError(errorText(e));
          })
          .finally(() => {
            if (!abort.signal.aborted) setRegistrationLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [editor, registrationSearch, registrationPage, reload]);
  const offeringId =
    editor === "new" ? registration?.offeringId : editor?.offeringId;
  useEffect(() => {
    if (
      !editor ||
      !offeringId ||
      (editor !== "new" && editor.state === "LEGACY")
    )
      return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setEntryPolicyLoading(true);
        setEntryPolicy(null);
        setEntryPolicyError("");
      }
    });
    api
      .policy(offeringId, abort.signal)
      .then(setEntryPolicy)
      .catch((e) => {
        if (!abort.signal.aborted) setEntryPolicyError(errorText(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setEntryPolicyLoading(false);
      });
    return () => abort.abort();
  }, [editor, offeringId, reload]);
  const refresh = () => setReload((n) => n + 1);
  async function view(item: GradeItem) {
    setBusy(true);
    setDetailError("");
    setError("");
    try {
      setDetail(await api.detail(item.id));
    } catch (e) {
      if (detail) setDetailError(errorText(e));
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function begin(item: GradeDetail | "new") {
    setEditor(item);
    setFormError("");
    setNotice("");
    setNote("");
    setReference("");
    setRegistration(null);
    setRegistrations(null);
    setRegistrationSearch("");
    setRegistrationPage(1);
    setRegistrationError("");
    setEntryPolicy(null);
    setEntryPolicyError("");
    setScores(
      item === "new"
        ? blankScores()
        : {
            attendanceScore:
              item.attendanceScore == null ? "" : String(item.attendanceScore),
            midtermScore:
              item.midtermScore == null ? "" : String(item.midtermScore),
            examScore: item.examScore == null ? "" : String(item.examScore),
          },
    );
    if (item !== "new") {
      setLegacyGrade(item.grade || "");
      setLegacyStatus(item.resultStatus);
      setPassedDate(item.passedDate || "");
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setFormError("");
    try {
      let saved: GradeDetail;
      if (editor !== "new" && editor.state === "LEGACY") {
        saved = await api.legacy(editor.id, {
          revision: editor.revision,
          grade: legacyGrade || null,
          resultStatus: legacyStatus,
          passedDate: ["PASSED", "EXEMPTED"].includes(legacyStatus)
            ? passedDate
            : null,
          note,
          reference,
        });
      } else {
        const values = {
          attendanceScore:
            scores.attendanceScore === ""
              ? null
              : Number(scores.attendanceScore),
          midtermScore:
            scores.midtermScore === "" ? null : Number(scores.midtermScore),
          examScore: scores.examScore === "" ? null : Number(scores.examScore),
          note,
          reference,
        };
        if (editor === "new") {
          if (!registration)
            throw new Error("Hãy chọn đăng ký học phần từ SQL.");
          saved = await api.create({
            ...values,
            registrationId: registration.id,
          });
        } else
          saved = await api.update(editor.id, {
            ...values,
            revision: editor.revision,
          });
      }
      setDetail(saved);
      setEditor(null);
      setNotice("Đã lưu điểm và lịch sử vào CSDL.");
      refresh();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function openPolicy(item: Offering) {
    setBusy(true);
    setError("");
    setPolicyError("");
    try {
      const data = await api.policy(item.id);
      setPolicyModal(data);
      const p = data.policy;
      setPolicyForm(
        p
          ? {
              attendanceWeight: String(p.attendanceWeight),
              midtermWeight: String(p.midtermWeight),
              examWeight: String(p.examWeight),
              passingScore: String(p.passingScore),
              decimalPlaces: String(p.decimalPlaces),
              rounding: p.rounding,
              reference: p.reference,
            }
          : {
              ...blankPolicy(),
              passingScore:
                data.configuredPassingScore == null
                  ? ""
                  : String(data.configuredPassingScore),
            },
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function savePolicy(e: FormEvent) {
    e.preventDefault();
    if (!policyModal || busy) return;
    setBusy(true);
    setPolicyError("");
    try {
      await api.savePolicy(policyModal.offering.id, {
        attendanceWeight: Number(policyForm.attendanceWeight),
        midtermWeight: Number(policyForm.midtermWeight),
        examWeight: Number(policyForm.examWeight),
        passingScore: Number(policyForm.passingScore),
        decimalPlaces: Number(policyForm.decimalPlaces),
        rounding: policyForm.rounding as "HALF_UP" | "TRUNCATE",
        reference: policyForm.reference,
        revision: policyModal.policy?.revision ?? 0,
      });
      setPolicyModal(null);
      setNotice("Đã lưu quy tắc chấm điểm lớp học phần vào SQL.");
      refresh();
    } catch (e) {
      setPolicyError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function beginAction(value: "chot" | "huy" | "mo-lai") {
    setAction(value);
    setActionNote("");
    setActionReference("");
    setActionError("");
  }
  async function submitAction(e: FormEvent) {
    e.preventDefault();
    if (!detail || !action || busy) return;
    setBusy(true);
    setActionError("");
    try {
      setDetail(
        await api.action(detail.id, action, {
          revision: detail.revision,
          note: actionNote,
          reference: actionReference,
        }),
      );
      setAction(null);
      setNotice("Đã cập nhật kết quả và lịch sử SQL.");
      refresh();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function pager(
    meta: Page<unknown>["meta"] | undefined,
    current: number,
    change: (v: number) => void,
  ) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
        <span>
          Tổng {meta?.total ?? 0} · Trang {current}/
          {Math.max(1, meta?.totalPages ?? 1)}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || current <= 1}
            onClick={() => change(current - 1)}
          >
            Trang trước
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !meta || current >= meta.totalPages}
            onClick={() => change(current + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>
    );
  }
  const legacy = editor && editor !== "new" && editor.state === "LEGACY";
  const policyDisabled =
    busy || !policyModal?.permissions.canManage || !!policyModal?.frozen;
  return (
    <div className="space-y-5 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="text-blue-600" />
            Quản Lý Điểm Số & Đánh Giá Học Phần
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kết quả học tập từ SQL; điểm thành phần theo quy tắc lớp đã lưu.
          </p>
        </div>
        {canManage && (
          <Button disabled={busy} onClick={() => begin("new")}>
            <Plus className="mr-1 h-4 w-4" />
            Nhập bảng điểm mới
          </Button>
        )}
      </header>
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "grades" ? "primary" : "outline"}
          onClick={() => {
            setTab("grades");
            setSearch("");
            setPage(1);
          }}
        >
          Kết quả học tập
        </Button>
        <Button
          variant={tab === "classes" ? "primary" : "outline"}
          onClick={() => {
            setTab("classes");
            setSearch("");
            setPage(1);
          }}
        >
          Lớp & quy tắc chấm điểm
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          aria-label="Tìm kiếm"
          className={ctl + " flex-1"}
          placeholder={
            tab === "grades"
              ? "Tìm học viên, mã/tên học phần hoặc lớp..."
              : "Tìm mã lớp hoặc học phần..."
          }
          value={search}
          maxLength={255}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {tab === "grades" && (
          <>
            <select
              aria-label="Lọc kết quả"
              className={ctl + " md:w-48"}
              value={resultStatus}
              onChange={(e) => {
                setResultStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả kết quả</option>
              {Object.entries(results).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc trạng thái"
              className={ctl + " md:w-44"}
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(states).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </>
        )}
        <Button variant="outline" disabled={loading} onClick={refresh}>
          Tải lại
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-800">
          {error}{" "}
          <Button variant="outline" onClick={refresh}>
            Thử lại
          </Button>
        </p>
      ) : loading ? (
        <p role="status">Đang tải dữ liệu SQL...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {tab === "grades" ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {[
                    "Học viên",
                    "Học phần / lớp",
                    "Chuyên cần",
                    "Giữa kỳ",
                    "Thi",
                    "Tổng kết / điểm gốc",
                    "Kết quả",
                    "Trạng thái",
                    "Thao tác",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list?.data.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3">
                      <strong>{item.studentCode}</strong>
                      <p>{item.studentName}</p>
                    </td>
                    <td className="p-3">
                      <strong>
                        {item.courseCode} — {item.courseName}
                      </strong>
                      <p className="text-xs text-slate-600">
                        v{item.courseVersionNo} ·{" "}
                        {item.classCode || "Chưa liên kết lớp"}
                        <br />
                        {item.unitName}
                      </p>
                    </td>
                    <td className="p-3">{item.attendanceScore ?? "—"}</td>
                    <td className="p-3">{item.midtermScore ?? "—"}</td>
                    <td className="p-3">{item.examScore ?? "—"}</td>
                    <td className="p-3 font-semibold">
                      {item.state === "VOIDED"
                        ? "Đã hủy"
                        : (item.totalScore ?? item.grade ?? "—")}
                    </td>
                    <td className="p-3">{results[item.resultStatus]}</td>
                    <td className="p-3">{states[item.state]}</td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => view(item)}
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
                {!list?.data.length && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-600">
                      Không có kết quả phù hợp trong phạm vi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {[
                    "Lớp học phần",
                    "Học phần / phiên bản",
                    "Đơn vị",
                    "Học kỳ",
                    "Trạng thái lớp",
                    "Thao tác",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes?.data.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-semibold">{item.classCode}</td>
                    <td className="p-3">
                      {item.courseCode} — {item.courseName} · v
                      {item.courseVersionNo}
                    </td>
                    <td className="p-3">{item.unitName}</td>
                    <td className="p-3">
                      {item.academicYear} · {item.semester}
                    </td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => openPolicy(item)}
                      >
                        Quy tắc chấm điểm
                      </Button>
                    </td>
                  </tr>
                ))}
                {!classes?.data.length && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-600">
                      Chưa có lớp phù hợp trong SQL.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!loading &&
        !error &&
        pager(tab === "grades" ? list?.meta : classes?.meta, page, setPage)}
      <Modal
        isOpen={!!detail && !editor && !action}
        onClose={() => {
          if (!busy) setDetail(null);
        }}
        title="Chi tiết kết quả học tập"
        size="2xl"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <h2 className="text-lg font-semibold">
              {detail.studentCode} — {detail.studentName}
            </h2>
            <p>
              {detail.courseCode} — {detail.courseName} · v
              {detail.courseVersionNo}
              <br />
              {detail.classCode || "Kết quả cũ chưa liên kết lớp"} ·{" "}
              {detail.unitName}
            </p>
            <p>
              <strong>
                {results[detail.resultStatus]} · {states[detail.state]}
              </strong>{" "}
              · Lần cập nhật {detail.revision}
              <br />
              Điểm tổng kết / điểm gốc:{" "}
              {detail.state === "VOIDED"
                ? "Đã hủy, không dùng tính đạt"
                : (detail.totalScore ?? detail.grade ?? "Chưa có")}
              <br />
              Ngày đạt/miễn: {detail.passedDate || "—"}
            </p>
            {detail.state === "LEGACY" ? (
              <p className="rounded bg-slate-50 p-3 text-slate-700">
                SQL cũ không lưu điểm thành phần, trọng số hoặc ngưỡng đã áp
                dụng. Hệ thống giữ nguyên điểm/ký hiệu và trạng thái gốc. Điều
                chỉnh cần căn cứ hồ sơ chính thức, không tự tính lại theo quy
                tắc hiện tại.
              </p>
            ) : (
              <p>
                Chuyên cần: {detail.attendanceScore ?? "Chưa nhập"} · Giữa kỳ:{" "}
                {detail.midtermScore ?? "Chưa nhập"} · Thi:{" "}
                {detail.examScore ?? "Chưa nhập"}
                <br />
                Trọng số SQL: {detail.attendanceWeight}% /{" "}
                {detail.midtermWeight}% / {detail.examWeight}% · Điểm đạt:{" "}
                {detail.passingScore}
                <br />
                Làm tròn: {detail.decimalPlaces} chữ số · {detail.rounding} · Hồ
                sơ: {detail.policyReference}
              </p>
            )}
            {detailError && (
              <p role="alert" className="text-red-700">
                {detailError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {detail.permissions.canManage && detail.state !== "VOIDED" && (
                <Button disabled={busy} onClick={() => begin(detail)}>
                  {detail.state === "LEGACY"
                    ? "Điều chỉnh theo hồ sơ"
                    : "Cập nhật điểm"}
                </Button>
              )}
              {detail.permissions.canManage && detail.state === "DRAFT" && (
                <Button
                  disabled={
                    busy ||
                    detail.classStatus !== "COMPLETED" ||
                    detail.totalScore === null
                  }
                  onClick={() => beginAction("chot")}
                >
                  Chốt điểm
                </Button>
              )}
              {detail.permissions.canManage &&
                ["DRAFT", "FINALIZED"].includes(detail.state) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => beginAction("huy")}
                  >
                    Hủy hiệu lực điểm
                  </Button>
                )}
              {detail.permissions.canManage && detail.state === "VOIDED" && (
                <Button disabled={busy} onClick={() => beginAction("mo-lai")}>
                  Mở lại nhập điểm
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => view(detail)}
              >
                Tải lại chi tiết
              </Button>
            </div>
            {detail.state === "DRAFT" && (
              <p className="text-slate-600">
                Nháp chưa tính đạt học phần. Chỉ chốt khi lớp COMPLETED và đủ
                thành phần có trọng số.
              </p>
            )}
            <h3 className="font-semibold">Lịch sử điều chỉnh</h3>
            {!detail.history.length && (
              <p>
                Chưa có điều chỉnh qua module này; dữ liệu gốc được giữ nguyên.
              </p>
            )}
            {detail.history.map((h) => (
              <article
                key={h.revision}
                className="space-y-1 border-t border-slate-200 py-3"
              >
                <p>
                  {new Date(h.createdAt).toLocaleString("vi-VN")} ·{" "}
                  {h.actorName} · {historyLabels[h.action] || h.action} · Lần
                  cập nhật {h.revision}
                </p>
                <p>
                  {h.note}
                  <br />
                  Hồ sơ: {h.reference}
                </p>
                <details>
                  <summary className="cursor-pointer text-blue-700">
                    Dữ liệu trước / sau
                  </summary>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">
                    {JSON.stringify(
                      { before: h.oldValue, after: h.newValue },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!editor}
        onClose={() => {
          if (!busy) setEditor(null);
        }}
        title={
          legacy
            ? "Điều chỉnh kết quả cũ theo hồ sơ"
            : editor === "new"
              ? "Nhập bảng điểm mới"
              : "Cập nhật điểm học phần"
        }
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              form="grade-form"
              disabled={
                busy ||
                (!legacy &&
                  (entryPolicyLoading ||
                    !entryPolicy?.policy ||
                    !!entryPolicyError))
              }
            >
              {editor === "new" ? "Lưu nháp" : "Lưu điều chỉnh"}
            </Button>
          </>
        }
      >
        <form id="grade-form" onSubmit={save} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
              {formError}
            </p>
          )}
          {editor === "new" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Tìm đăng ký học phần
                <input
                  aria-label="Tìm đăng ký học phần"
                  className={ctl}
                  value={registrationSearch}
                  maxLength={255}
                  onChange={(e) => {
                    setRegistrationSearch(e.target.value);
                    setRegistrationPage(1);
                  }}
                />
              </label>
              {registrationError && (
                <p role="alert" className="text-red-700">
                  {registrationError}
                </p>
              )}
              <label className="block text-sm font-medium">
                Học viên / lớp đã đăng ký
                <select
                  aria-label="Học viên / lớp đã đăng ký"
                  className={ctl}
                  required
                  disabled={busy || registrationLoading || !!registrationError}
                  value={registration?.id || ""}
                  onChange={(e) =>
                    setRegistration(
                      registrations?.data.find(
                        (r) => r.id === e.target.value,
                      ) || null,
                    )
                  }
                >
                  <option value="">
                    {registrationLoading
                      ? "Đang tải..."
                      : "Chọn đăng ký thực tế từ SQL"}
                  </option>
                  {registration &&
                    !registrations?.data.some(
                      (r) => r.id === registration.id,
                    ) && (
                      <option value={registration.id}>
                        {registration.studentCode} — {registration.classCode}
                      </option>
                    )}
                  {registrations?.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.studentCode} — {r.studentName} — {r.classCode} —{" "}
                      {r.courseCode}
                    </option>
                  ))}
                </select>
              </label>
              {!registrationLoading &&
                !registrations?.data.length &&
                !registrationError && (
                  <p className="text-sm text-slate-600">
                    Không có đăng ký phù hợp chưa nhập điểm. Đăng ký hủy/rút
                    hoặc lớp đã hủy không được chọn.
                  </p>
                )}
              {pager(
                registrations?.meta,
                registrationPage,
                setRegistrationPage,
              )}
              {registration && (
                <p className="rounded bg-slate-50 p-3 text-sm">
                  {registration.studentCode} — {registration.studentName}
                  <br />
                  {registration.courseCode} — {registration.courseName} · v
                  {registration.courseVersionNo}
                  <br />
                  {registration.classCode} · {registration.unitName}
                </p>
              )}
            </div>
          )}
          {editor && editor !== "new" && (
            <p className="text-sm">
              {editor.studentCode} — {editor.studentName}
              <br />
              {editor.courseCode} — {editor.courseName} ·{" "}
              {editor.classCode || "Kết quả cũ"}
              <br />
              Không thay đổi học viên, lớp hoặc phiên bản học phần khi sửa điểm.
            </p>
          )}
          {legacy ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Kết quả theo hồ sơ
                <select
                  aria-label="Kết quả theo hồ sơ"
                  className={ctl}
                  value={legacyStatus}
                  disabled={busy}
                  onChange={(e) => {
                    const status = e.target.value as ResultStatus;
                    setLegacyStatus(status);
                    if (status === "INCOMPLETE") setLegacyGrade("");
                    if (!["PASSED", "EXEMPTED"].includes(status))
                      setPassedDate("");
                  }}
                >
                  {Object.entries(results).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Điểm / ký hiệu chính thức
                <input
                  aria-label="Điểm / ký hiệu chính thức"
                  className={ctl}
                  maxLength={20}
                  value={legacyGrade}
                  disabled={busy || legacyStatus === "INCOMPLETE"}
                  required={["PASSED", "FAILED"].includes(legacyStatus)}
                  onChange={(e) => setLegacyGrade(e.target.value)}
                />
              </label>
              {["PASSED", "EXEMPTED"].includes(legacyStatus) && (
                <label className="block text-sm font-medium">
                  Ngày đạt / miễn theo hồ sơ
                  <input
                    aria-label="Ngày đạt / miễn theo hồ sơ"
                    className={ctl}
                    type="date"
                    required
                    value={passedDate}
                    disabled={busy}
                    onChange={(e) => setPassedDate(e.target.value)}
                  />
                </label>
              )}
              <p className="text-sm text-slate-600">
                Không suy kết quả cũ từ ngưỡng hiện tại. Người nhập chịu trách
                nhiệm đối chiếu kết quả, điểm và ngày đạt theo hồ sơ.
              </p>
            </div>
          ) : (
            <>
              {entryPolicyLoading && <p>Đang tải quy tắc SQL...</p>}
              {entryPolicyError && (
                <p role="alert" className="text-red-700">
                  {entryPolicyError}
                </p>
              )}
              {registration &&
                !entryPolicyLoading &&
                entryPolicy &&
                !entryPolicy.policy && (
                  <p
                    role="alert"
                    className="rounded bg-amber-50 p-3 text-amber-900"
                  >
                    Lớp chưa có quy tắc. Đóng form, mở tab “Lớp & quy tắc chấm
                    điểm” và lưu trọng số/ngưỡng theo hồ sơ trước.
                  </p>
                )}
              {entryPolicy?.policy && (
                <p className="rounded bg-slate-50 p-3 text-sm">
                  Trọng số SQL: {entryPolicy.policy.attendanceWeight}% /{" "}
                  {entryPolicy.policy.midtermWeight}% /{" "}
                  {entryPolicy.policy.examWeight}% · Điểm đạt{" "}
                  {entryPolicy.policy.passingScore}
                  <br />
                  Làm tròn {entryPolicy.policy.decimalPlaces} chữ số ·{" "}
                  {entryPolicy.policy.rounding}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  ["attendanceScore", "midtermScore", "examScore"] as const
                ).map((key) => (
                  <label key={key} className="block text-sm font-medium">
                    {scoreNames[key]}
                    <input
                      aria-label={scoreNames[key]}
                      type="number"
                      min={0}
                      max={10}
                      step="0.01"
                      className={ctl}
                      value={scores[key]}
                      disabled={busy}
                      onChange={(e) =>
                        setScores({ ...scores, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="text-sm text-slate-600">
                Chưa có điểm thì để trống; 0 là điểm thật. Backend tính tổng
                theo SQL. Thành phần trọng số 0 không bắt buộc nhập.
              </p>
            </>
          )}
          <label className="block text-sm font-medium">
            Số hồ sơ đối chiếu
            <input
              aria-label="Số hồ sơ đối chiếu"
              className={ctl}
              required
              maxLength={255}
              value={reference}
              disabled={busy}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Nội dung / lý do ghi điểm
            <textarea
              aria-label="Nội dung / lý do ghi điểm"
              className={ctl}
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </form>
      </Modal>
      <Modal
        isOpen={!!policyModal}
        onClose={() => {
          if (!busy) setPolicyModal(null);
        }}
        title="Quy tắc chấm điểm lớp học phần"
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPolicyModal(null)}
            >
              Đóng
            </Button>
            {policyModal?.permissions.canManage && !policyModal.frozen && (
              <Button type="submit" form="policy-form" disabled={busy}>
                Lưu quy tắc SQL
              </Button>
            )}
          </>
        }
      >
        {policyModal && (
          <form id="policy-form" onSubmit={savePolicy} className="space-y-4">
            <p className="font-medium">
              {policyModal.offering.classCode} —{" "}
              {policyModal.offering.courseName}
              <br />
              {policyModal.offering.unitName}
            </p>
            {policyError && (
              <p role="alert" className="text-red-700">
                {policyError}
              </p>
            )}
            {policyModal.frozen && (
              <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
                Lớp đã có bảng điểm. Quy tắc được giữ cố định để bảo toàn kết
                quả đã ghi.
              </p>
            )}
            <p className="text-sm text-slate-600">
              Tham số điểm đạt hiện có trong SQL hệ thống:{" "}
              {policyModal.configuredPassingScore ?? "Chưa cấu hình"}. Nhập quy
              tắc áp dụng thực tế cho lớp và hồ sơ làm căn cứ; không có trọng số
              mặc định.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {(
                ["attendanceWeight", "midtermWeight", "examWeight"] as const
              ).map((key) => (
                <label key={key} className="block text-sm font-medium">
                  {
                    {
                      attendanceWeight: "Trọng số chuyên cần (%)",
                      midtermWeight: "Trọng số giữa kỳ (%)",
                      examWeight: "Trọng số thi (%)",
                    }[key]
                  }
                  <input
                    aria-label={key}
                    type="number"
                    required
                    min={0}
                    max={100}
                    step="0.01"
                    className={ctl}
                    value={policyForm[key]}
                    disabled={policyDisabled}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Tổng trọng số phải bằng 100%.
            </p>
            <label className="block text-sm font-medium">
              Điểm đạt của lớp
              <input
                aria-label="Điểm đạt của lớp"
                type="number"
                required
                min={0.01}
                max={10}
                step="0.01"
                className={ctl}
                value={policyForm.passingScore}
                disabled={policyDisabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, passingScore: e.target.value })
                }
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Số chữ số thập phân
                <select
                  aria-label="Số chữ số thập phân"
                  className={ctl}
                  required
                  value={policyForm.decimalPlaces}
                  disabled={policyDisabled}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      decimalPlaces: e.target.value,
                    })
                  }
                >
                  <option value="">Chọn theo quy định</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Cách làm tròn
                <select
                  aria-label="Cách làm tròn"
                  className={ctl}
                  required
                  value={policyForm.rounding}
                  disabled={policyDisabled}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, rounding: e.target.value })
                  }
                >
                  <option value="">Chọn theo quy định</option>
                  <option value="HALF_UP">Từ 5 làm tròn lên</option>
                  <option value="TRUNCATE">Cắt phần dư</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Số hồ sơ / quy định áp dụng
              <input
                aria-label="Số hồ sơ / quy định áp dụng"
                className={ctl}
                required
                maxLength={255}
                value={policyForm.reference}
                disabled={policyDisabled}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, reference: e.target.value })
                }
              />
            </label>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={!!action}
        onClose={() => {
          if (!busy) setAction(null);
        }}
        title={
          action === "chot"
            ? "Chốt kết quả học phần"
            : action === "huy"
              ? "Hủy hiệu lực điểm"
              : "Mở lại nhập điểm"
        }
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Đóng
            </Button>
            <Button form="grade-action" type="submit" disabled={busy}>
              Xác nhận
            </Button>
          </>
        }
      >
        <form id="grade-action" onSubmit={submitAction} className="space-y-4">
          <p>
            {detail?.studentCode} — {detail?.courseName}
          </p>
          {actionError && (
            <p role="alert" className="text-red-700">
              {actionError}
            </p>
          )}
          <p className="text-sm text-slate-600">
            {action === "chot"
              ? "Chỉ điểm đã chốt mới cập nhật kết quả đạt/chưa đạt và điều kiện tiên quyết."
              : action === "huy"
                ? "Kết quả sẽ chuyển chưa hoàn tất và ngừng tính đạt. Toàn bộ lịch sử được giữ."
                : "Bảng điểm trở lại nháp, các ô điểm được để trống để nhập lại; lịch sử cũ vẫn được giữ."}
          </p>
          <label className="block text-sm font-medium">
            Số hồ sơ
            <input
              aria-label="Số hồ sơ"
              className={ctl}
              required
              maxLength={255}
              value={actionReference}
              disabled={busy}
              onChange={(e) => setActionReference(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Lý do / nội dung xác nhận
            <textarea
              aria-label="Lý do / nội dung xác nhận"
              className={ctl}
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              value={actionNote}
              disabled={busy}
              onChange={(e) => setActionNote(e.target.value)}
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
