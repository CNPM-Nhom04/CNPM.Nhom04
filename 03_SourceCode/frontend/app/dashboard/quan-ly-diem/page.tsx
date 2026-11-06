"use client";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { ExcelOnlyForm } from "@/components/excel/ExcelOnlyForm";
import {
  gradeService,
  type GradeDetail,
  type PolicyResponse,
  type GradeList,
} from "@/lib/services/gradeService";
import { downloadExcel } from "@/lib/services/excelDownload";
type Option = {
  unitId: string;
  unitName: string;
  classId: string;
  classCode: string;
  className: string;
  termId: string;
  academicYear: string;
  semester: string;
};
type Course = {
  courseVersionId: string;
  courseCode: string;
  courseName: string;
  versionNo: number;
};
type Row = {
  courseVersionId: string;
  classStatus: string;
  registrationId: string;
  studentCode: string;
  studentName: string;
  offeringId: string;
  offeringCode: string;
  courseCode: string;
  courseName: string;
  resultId: string | null;
  state: string;
  attendanceScore: number | null;
  midtermScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  grade: string | null;
  resultStatus: string | null;
  policyId: string | null;
};
type Preview = {
  changed: number;
  unchanged: number;
  applied: boolean;
  changes: {
    registrationId: string;
    studentCode: string;
    courseCode: string;
    fields: { key: string; before: number | null; after: number | null }[];
  }[];
};
const names: Record<string, string> = {
  attendanceScore: "Chuyên cần",
  midtermScore: "Giữa kỳ",
  examScore: "Thi",
};
const gradeStates: Record<string, string> = {
  DRAFT: "Điểm nháp",
  FINALIZED: "Đã chốt",
  VOIDED: "Đã hủy hiệu lực",
  LEGACY: "Kết quả lịch sử",
};
const classStates: Record<string, string> = {
  PLANNED: "Dự kiến",
  OPEN: "Đang mở",
  CLOSED: "Đã đóng",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};
const historyLabels: Record<string, string> = {
  GRADE_CREATE: "Tạo điểm nháp",
  GRADE_UPDATE: "Cập nhật điểm nháp",
  GRADE_CORRECT: "Điều chỉnh điểm đã chốt",
  GRADE_FINALIZE: "Chốt điểm",
  GRADE_VOID: "Hủy hiệu lực điểm",
  GRADE_REOPEN: "Mở lại điểm nháp",
  GRADE_LEGACY_CORRECT: "Điều chỉnh kết quả lịch sử",
};
const commandInfo = {
  chot: {
    label: "Chốt điểm",
    heading: "Hồ sơ chốt điểm",
    description:
      "Điền lý do chốt và số hồ sơ thực tế trong Excel, tải lên để kiểm tra rồi xác nhận chốt. Thao tác xác nhận kết quả chính thức của học viên.",
  },
  huy: {
    label: "Hủy hiệu lực",
    heading: "Hồ sơ hủy hiệu lực điểm",
    description:
      "Điền lý do hủy và số hồ sơ thực tế trong Excel. Khi xác nhận, kết quả ngừng được tính đạt; dữ liệu và lịch sử vẫn được lưu.",
  },
  "mo-lai": {
    label: "Mở lại điểm nháp",
    heading: "Hồ sơ mở lại điểm",
    description:
      "Điền lý do mở lại và số hồ sơ thực tế trong Excel. Khi xác nhận, điểm trở về nháp với các ô điểm thành phần trống để nhập lại.",
  },
} as const;
async function request<T>(path: string, options: RequestInit = {}) {
  const r = await fetch("/api/quan-ly-diem" + path, {
    ...options,
    cache: "no-store",
  });
  if (!r.ok) {
    const b = await r.json().catch(() => null);
    throw new Error(
      Array.isArray(b?.message)
        ? b.message.join("\n")
        : b?.message || "Không thực hiện được yêu cầu.",
    );
  }
  return r.json() as Promise<T>;
}
function PolicyEditor({
  data,
  onSaved,
}: {
  data: PolicyResponse;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    attendanceWeight: String(data.policy?.attendanceWeight ?? ""),
    midtermWeight: String(data.policy?.midtermWeight ?? ""),
    examWeight: String(data.policy?.examWeight ?? ""),
    passingScore: String(
      data.policy?.passingScore ?? data.configuredPassingScore ?? "",
    ),
    decimalPlaces: String(data.policy?.decimalPlaces ?? ""),
    rounding: data.policy?.rounding || "",
    reference: data.policy?.reference || "",
  });
  const [error, setError] = useState("");
  return (
    <>
      <p className="text-sm mb-3">
        {data.offering.classCode} · {data.offering.courseName}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <p className="mb-3 text-sm text-slate-600">
        Quy tắc áp dụng riêng cho lớp học phần này và dùng chung để tính tổng
        điểm của các học viên.
      </p>
      {data.policy && (
        <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm space-y-1">
          <p>
            Trọng số: chuyên cần {data.policy.attendanceWeight}% · giữa kỳ{" "}
            {data.policy.midtermWeight}% · thi {data.policy.examWeight}%.
          </p>
          <p>
            Điểm đạt: {data.policy.passingScore} · {data.policy.decimalPlaces}{" "}
            số lẻ ·{" "}
            {data.policy.rounding === "HALF_UP" ? "Làm tròn" : "Cắt phần dư"}.
          </p>
          <p>Hồ sơ quy tắc: {data.policy.reference}</p>
        </div>
      )}
      {data.frozen ? (
        <p>Quy tắc đã được sử dụng và được giữ cố định để bảo toàn điểm.</p>
      ) : (
        <ExcelOnlyForm
          recordLabel={`${data.offering.classCode} — ${data.offering.courseName}`}
          recordKey={data.offering.id}
          heading="Cấu hình quy tắc tính điểm bằng Excel"
          description="Điền trọng số chuyên cần, giữa kỳ, thi (tổng 100%), điểm đạt, cách làm tròn và số hồ sơ của quy tắc. Xem tab Ví dụ điền đúng ở cuối file."
          templateLabel="Tải mẫu quy tắc tính điểm"
          submitLabel="Xác nhận lưu quy tắc"
          showDependentStep={false}
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await gradeService.savePolicy(data.offering.id, {
                revision: data.policy?.revision || 0,
                attendanceWeight: Number(form.attendanceWeight),
                midtermWeight: Number(form.midtermWeight),
                examWeight: Number(form.examWeight),
                passingScore: Number(form.passingScore),
                decimalPlaces: Number(form.decimalPlaces),
                rounding: form.rounding as "HALF_UP" | "TRUNCATE",
                reference: form.reference,
              });
              onSaved();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Không lưu được quy tắc.",
              );
            }
          }}
        >
          {(
            [
              "attendanceWeight",
              "midtermWeight",
              "examWeight",
              "passingScore",
              "decimalPlaces",
            ] as const
          ).map((key) => (
            <Input
              key={key}
              name={key}
              label={
                {
                  attendanceWeight: "Trọng số chuyên cần (%)",
                  midtermWeight: "Trọng số giữa kỳ (%)",
                  examWeight: "Trọng số thi (%)",
                  passingScore: "Điểm đạt",
                  decimalPlaces: "Số chữ số thập phân",
                }[key]
              }
              type="number"
              min={key === "passingScore" ? 0.01 : 0}
              max={
                key === "passingScore" ? 10 : key === "decimalPlaces" ? 2 : 100
              }
              step={key === "decimalPlaces" ? 1 : 0.01}
              required
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          ))}
          <label>
            Cách làm tròn
            <select
              name="rounding"
              required
              value={form.rounding}
              onChange={(e) => setForm({ ...form, rounding: e.target.value })}
            >
              <option value="">Chọn</option>
              <option value="HALF_UP">Làm tròn</option>
              <option value="TRUNCATE">Cắt phần dư</option>
            </select>
          </label>
          <Input
            name="reference"
            label="Số hồ sơ quy tắc"
            required
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </ExcelOnlyForm>
      )}
    </>
  );
}
function GradeAction({
  detail,
  action,
  onSaved,
}: {
  detail: GradeDetail;
  action: "chot" | "huy" | "mo-lai";
  onSaved: () => void;
}) {
  const [note, setNote] = useState(""),
    [reference, setReference] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const info = commandInfo[action];
  return (
    <fieldset disabled={pending} className="space-y-3">
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {pending && (
        <p role="status">
          Đang thực hiện {info.label.toLocaleLowerCase("vi")}…
        </p>
      )}
      <ExcelOnlyForm
        recordLabel={`${detail.studentCode} — ${detail.studentName} · ${detail.courseCode}`}
        recordKey={detail.id + ":" + action}
        heading={info.heading}
        description={
          info.description +
          " File chỉ cần lý do và số hồ sơ; xem tab Ví dụ điền đúng để đối chiếu."
        }
        templateLabel={`Tải mẫu ${info.heading.toLocaleLowerCase("vi")}`}
        submitLabel={`Xác nhận ${info.label.toLocaleLowerCase("vi")}`}
        downloadFilename={`Ho_so_${action}_${detail.studentCode}_${detail.courseCode}.xlsx`}
        showDependentStep={false}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError("");
          try {
            await gradeService.action(detail.id, action, {
              revision: detail.revision,
              note,
              reference,
            });
            onSaved();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Không thực hiện được thao tác.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <Input
          name="note"
          label={`Lý do ${info.label.toLocaleLowerCase("vi")}`}
          required
          minLength={10}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Input
          name="reference"
          label="Số hồ sơ thực tế"
          required
          maxLength={255}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </ExcelOnlyForm>
    </fieldset>
  );
}
function LegacyEditor({
  detail,
  onSaved,
}: {
  detail: GradeDetail;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    grade: detail.grade || "",
    resultStatus: detail.resultStatus,
    passedDate: detail.passedDate || "",
    note: "",
    reference: "",
  });
  const [error, setError] = useState("");
  return (
    <>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <ExcelOnlyForm
        recordLabel={`${detail.studentCode} — ${detail.studentName} · ${detail.courseCode}`}
        recordKey={detail.id}
        heading="Hồ sơ điều chỉnh kết quả lịch sử"
        description="Điền điểm hoặc ký hiệu chính thức, kết quả, ngày đạt/miễn và căn cứ điều chỉnh theo hồ sơ thực tế. Xem tab Ví dụ điền đúng trước khi nhập."
        templateLabel="Tải mẫu điều chỉnh kết quả lịch sử"
        submitLabel="Xác nhận điều chỉnh kết quả"
        showDependentStep={false}
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await gradeService.legacy(detail.id, {
              ...form,
              grade: form.grade || null,
              passedDate: form.passedDate || null,
              revision: detail.revision,
            });
            onSaved();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Không điều chỉnh được điểm lịch sử.",
            );
          }
        }}
      >
        <Input
          name="grade"
          label="Điểm hoặc ký hiệu chính thức"
          value={form.grade}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
        />
        <label>
          Kết quả
          <select
            name="resultStatus"
            value={form.resultStatus}
            onChange={(e) =>
              setForm({
                ...form,
                resultStatus: e.target.value as typeof form.resultStatus,
              })
            }
          >
            {["PASSED", "FAILED", "INCOMPLETE", "EXEMPTED"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Input
          name="passedDate"
          type="date"
          label="Ngày đạt / miễn theo hồ sơ"
          value={form.passedDate}
          onChange={(e) => setForm({ ...form, passedDate: e.target.value })}
        />
        <Input
          name="note"
          label="Lý do điều chỉnh"
          required
          minLength={10}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <Input
          name="reference"
          label="Số hồ sơ"
          required
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
      </ExcelOnlyForm>
    </>
  );
}
function CompleteCourse({
  classId,
  termId,
  courseVersionId,
  label,
  onSaved,
}: {
  classId: string;
  termId: string;
  courseVersionId: string;
  label: string;
  onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="rounded-xl border bg-white p-4 print:hidden">
      <summary className="cursor-pointer font-semibold">
        Xác nhận môn đã giảng dạy xong
      </summary>
      <p className="my-2 text-sm text-slate-600">
        Thực hiện khi kết thúc giảng dạy, trước khi chốt điểm. Hồ sơ này không
        tự chốt điểm của học viên.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <ExcelOnlyForm
        recordLabel={label}
        recordKey={`${classId}:${termId}:${courseVersionId}`}
        heading="Hồ sơ xác nhận hoàn tất giảng dạy"
        templateLabel="Tải mẫu xác nhận hoàn tất môn"
        submitLabel="Xác nhận hoàn tất môn"
        showDependentStep={false}
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await request("/excel/hoan-tat-mon", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                classId,
                termId,
                courseVersionId,
                note,
                reference,
              }),
            });
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Không xác nhận được.");
          }
        }}
      >
        <Input
          name="note"
          label="Lý do xác nhận"
          required
          minLength={10}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Input
          name="reference"
          label="Số hồ sơ"
          required
          maxLength={255}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </ExcelOnlyForm>
    </details>
  );
}
export default function GradesPage() {
  const [legacy, setLegacy] = useState<GradeList | null>(null),
    [legacyPage, setLegacyPage] = useState(1),
    [printTarget, setPrintTarget] = useState("grade-print");
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [options, setOptions] = useState<Option[]>([]),
    [canManage, setCanManage] = useState(false);
  const [unitId, setUnitId] = useState(""),
    [classId, setClassId] = useState(""),
    [termId, setTermId] = useState(""),
    [courseVersionId, setCourseVersionId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [detail, setDetail] = useState<GradeDetail | null>(null),
    [policy, setPolicy] = useState<PolicyResponse | null>(null),
    [command, setCommand] = useState<"chot" | "huy" | "mo-lai" | null>(null);
  useEffect(() => {
    const c = new AbortController();
    request<{ data: Option[]; permissions: { canManage: boolean } }>(
      "/excel/options",
      { signal: c.signal },
    )
      .then((d) => {
        setOptions(d.data);
        setOptionsLoaded(true);
        setCanManage(d.permissions.canManage);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!classId || !termId || !courseVersionId) return;
    const c = new AbortController();
    request<Row[]>(
      "/excel/rows?" +
        new URLSearchParams({ classId, termId, courseVersionId }),
      {
        signal: c.signal,
      },
    )
      .then((data) => {
        if (!c.signal.aborted)
          setRows(
            data.filter((row) => row.courseVersionId === courseVersionId),
          );
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [classId, termId, courseVersionId, version]);
  useEffect(() => {
    const controller = new AbortController();
    gradeService
      .list("", "ALL", "LEGACY", legacyPage, controller.signal)
      .then(setLegacy)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [legacyPage, version]);
  useEffect(() => {
    if (!classId || !termId) return;
    const controller = new AbortController();
    request<Course[]>(
      "/excel/mon-hoc?" + new URLSearchParams({ classId, termId }),
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setCourses(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [classId, termId, version]);
  const units = [...new Map(options.map((o) => [o.unitId, o])).values()];
  const classes = [
    ...new Map(
      options.filter((o) => o.unitId === unitId).map((o) => [o.classId, o]),
    ).values(),
  ];
  const terms = [
    ...new Map(
      options
        .filter((o) => o.unitId === unitId && o.classId === classId)
        .map((o) => [o.termId, o]),
    ).values(),
  ];
  const selected = options.find(
    (o) => o.classId === classId && o.termId === termId,
  );
  function refreshRows() {
    setLoading(Boolean(classId && termId && courseVersionId));
    setRows([]);
    setError("");
    setVersion((v) => v + 1);
  }
  function reset() {
    setLoading(false);
    setFile(null);
    setPreview(null);
    setRows([]);
    setMessage("");
    setError("");
  }
  async function upload(selectedFile: File, apply = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const d = await request<Preview>(
        "/excel/" +
          (apply ? "luu" : "kiem-tra") +
          "?" +
          new URLSearchParams({ classId, termId, courseVersionId }),
        { method: "POST", body },
      );
      if (apply) {
        setMessage(
          `Đã cập nhật ${d.changed} dòng; giữ nguyên ${d.unchanged} dòng không đổi.`,
        );
        setPreview(null);
        setFile(null);
        refreshRows();
      } else {
        setFile(selectedFile);
        setPreview(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không nhập được Excel.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 pb-10">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-xl font-bold">Bảng điểm</h1>
          <p className="text-sm text-slate-500">
            {canManage
              ? "Nhập và điều chỉnh bằng Excel; chỉ cập nhật phần khác biệt."
              : "Xem và in bảng điểm trong phạm vi được cấp."}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!rows.length || loading}
          onClick={() => {
            setPrintTarget("grade-print");
            setTimeout(() => window.print(), 50);
          }}
        >
          In bảng điểm
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 whitespace-pre-line"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-green-800 text-sm"
        >
          {message}
        </p>
      )}
      {optionsLoaded && !options.length && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          Chưa có lớp hoặc học kỳ trong phạm vi tài khoản. Cần cấu hình lớp và
          học kỳ trước; bảng điểm tự lấy học viên đã được xếp lớp và phân công
          CTĐT.
        </p>
      )}
      <section className="grid md:grid-cols-4 gap-3 rounded-xl border bg-white p-4 print:hidden">
        <label className="text-sm space-y-1">
          1. Đơn vị / Khoa
          <select
            aria-label="Chọn đơn vị / khoa"
            className="block w-full border rounded-lg p-2"
            value={unitId}
            disabled={busy}
            onChange={(e) => {
              setUnitId(e.target.value);
              setClassId("");
              setTermId("");
              setCourseVersionId("");
              setCourses([]);
              reset();
            }}
          >
            <option value="">Chọn đơn vị / khoa</option>
            {units.map((o) => (
              <option key={o.unitId} value={o.unitId}>
                {o.unitName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          2. Lớp
          <select
            aria-label="Chọn lớp"
            className="block w-full border rounded-lg p-2"
            value={classId}
            disabled={!unitId || busy}
            onChange={(e) => {
              setClassId(e.target.value);
              setTermId("");
              setCourseVersionId("");
              setCourses([]);
              reset();
            }}
          >
            <option value="">Chọn lớp</option>
            {classes.map((o) => (
              <option key={o.classId} value={o.classId}>
                {o.classCode} — {o.className}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          3. Học kỳ
          <select
            aria-label="Chọn học kỳ"
            className="block w-full border rounded-lg p-2"
            value={termId}
            disabled={!classId || busy}
            onChange={(e) => {
              setTermId(e.target.value);
              setCourseVersionId("");
              setCourses([]);
              reset();
            }}
          >
            <option value="">Chọn học kỳ</option>
            {terms.map((o) => (
              <option key={o.termId} value={o.termId}>
                {o.academicYear} · HK{" "}
                {String(o.semester).replace(/^HK\s*/i, "")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          4. Môn học
          <select
            aria-label="Chọn môn học"
            className="block w-full border rounded-lg p-2"
            value={courseVersionId}
            disabled={!termId || busy}
            onChange={(e) => {
              setCourseVersionId(e.target.value);
              reset();
              setLoading(Boolean(e.target.value));
            }}
          >
            <option value="">Chọn môn trong CTĐT của lớp</option>
            {courses.map((course) => (
              <option
                key={course.courseVersionId}
                value={course.courseVersionId}
              >
                {course.courseCode} — {course.courseName} · v{course.versionNo}
              </option>
            ))}
          </select>
        </label>
      </section>
      {canManage && courseVersionId && !loading && rows.length > 0 && (
        <div className="rounded-xl border bg-white p-4 print:hidden">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                setPolicy(await gradeService.policy(rows[0].offeringId));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Không tải được quy tắc điểm.",
                );
              }
            }}
          >
            Quy tắc tính điểm môn đã chọn
          </Button>
          <p className="mt-2 text-sm text-slate-500">
            {rows[0].policyId
              ? "Đã có quy tắc tính điểm."
              : "Chưa có quy tắc. Cấu hình theo hồ sơ môn trước khi nhập điểm."}
          </p>
        </div>
      )}
      {canManage &&
        courseVersionId &&
        !loading &&
        rows.length > 0 &&
        rows[0].classStatus !== "COMPLETED" && (
          <CompleteCourse
            key={`${classId}:${termId}:${courseVersionId}`}
            classId={classId}
            termId={termId}
            courseVersionId={courseVersionId}
            label={`${selected?.classCode} · ${courses.find((c) => c.courseVersionId === courseVersionId)?.courseCode}`}
            onSaved={() => {
              refreshRows();
              setMessage(
                "Đã xác nhận hoàn tất giảng dạy. Có thể chốt từng kết quả khi đủ điểm.",
              );
            }}
          />
        )}
      {canManage && classId && termId && courseVersionId && (
        <section className="rounded-xl border bg-blue-50/40 p-4 space-y-3 print:hidden text-sm">
          <p>
            Mẫu tự lấy học viên của lớp và điểm hiện có của môn đã chọn. Sửa các
            ô cần đổi, điền lý do và số hồ sơ tại dòng thay đổi; không xóa dữ
            liệu ngoài file.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Button
              variant="outline"
              disabled={busy || loading}
              onClick={async () => {
                setBusy(true);
                try {
                  const opened = await request<{ offeringId: string }>(
                    "/excel/mo-bang-diem",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        classId,
                        termId,
                        courseVersionId,
                      }),
                    },
                  );
                  refreshRows();
                  const rule = await gradeService.policy(opened.offeringId);
                  if (!rule.policy) {
                    setPolicy(rule);
                    setMessage(
                      "Môn chưa có quy tắc tính điểm. Lưu quy tắc bằng Excel, sau đó bấm tải mẫu điểm.",
                    );
                    return;
                  }
                  await downloadExcel(
                    "/api/quan-ly-diem/excel/mau?" +
                      new URLSearchParams({ classId, termId, courseVersionId }),
                    "Bang_diem_" + selected?.classCode + ".xlsx",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Không tải được mẫu.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Tải Excel học viên và điểm hiện có
            </Button>
            <input
              aria-label="Nhập bảng điểm Excel"
              type="file"
              accept=".xlsx"
              disabled={busy || loading || !rows.length}
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          {preview && (
            <div className="space-y-3">
              <p>
                {preview.changed} dòng thay đổi · {preview.unchanged} dòng giữ
                nguyên
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th>Học viên</th>
                      <th>Môn</th>
                      <th>Ô thay đổi</th>
                      <th>Trước</th>
                      <th>Sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changes.flatMap((r) =>
                      r.fields.map((f) => (
                        <tr key={r.registrationId + f.key} className="border-t">
                          <td className="p-2">{r.studentCode}</td>
                          <td>{r.courseCode}</td>
                          <td>{names[f.key]}</td>
                          <td>{f.before ?? "—"}</td>
                          <td>{f.after ?? "—"}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <Button
                disabled={busy || !preview.changed}
                onClick={() => file && void upload(file, true)}
              >
                Lưu {preview.changed} dòng thay đổi
              </Button>
            </div>
          )}
        </section>
      )}
      {loading && <p role="status">Đang tải bảng điểm…</p>}
      {busy && (
        <p role="status" className="print:hidden">
          Đang xử lý…
        </p>
      )}
      <section
        id="grade-print"
        className="bg-white border rounded-xl overflow-auto"
      >
        <div className="p-4 border-b">
          <h2 className="font-bold">
            {selected
              ? `Bảng điểm lớp ${selected.classCode}`
              : "Chọn đơn vị, lớp, học kỳ và môn để xem điểm"}
          </h2>
          {selected && (
            <p className="text-sm">
              {selected.unitName} · {selected.academicYear} · Học kỳ{" "}
              {selected.semester} ·{" "}
              {
                courses.find((c) => c.courseVersionId === courseVersionId)
                  ?.courseName
              }
            </p>
          )}
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Mã HV",
                "Học viên",
                "Môn / lớp học phần",
                "Chuyên cần",
                "Giữa kỳ",
                "Thi",
                "Tổng / kết quả",
                "Trạng thái",
                "",
              ].map((h, i) => (
                <th className="p-3" key={i}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-t" key={r.registrationId}>
                <td className="p-3">{r.studentCode}</td>
                <td className="p-3">{r.studentName}</td>
                <td className="p-3">
                  {r.courseCode} — {r.courseName}
                  <p className="text-xs text-slate-500">{r.offeringCode}</p>
                </td>
                <td className="p-3">{r.attendanceScore ?? "—"}</td>
                <td className="p-3">{r.midtermScore ?? "—"}</td>
                <td className="p-3">{r.examScore ?? "—"}</td>
                <td className="p-3">
                  {r.totalScore ?? r.grade ?? "—"}
                  <p className="text-xs">{r.resultStatus}</p>
                </td>
                <td className="p-3 text-xs">
                  {{
                    NEW: "Chưa nhập",
                    DRAFT: "Nháp",
                    FINALIZED: "Đã chốt",
                    VOIDED: "Đã hủy",
                    LEGACY: "Lịch sử",
                  }[r.state] || r.state}
                </td>
                <td className="p-3 print:hidden">
                  {r.resultId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          setDetail(await gradeService.detail(r.resultId!));
                          setCommand(null);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Không đọc được lịch sử.",
                          );
                        }
                      }}
                    >
                      Chi tiết
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-center text-slate-500 text-sm">
            Chưa có dữ liệu trong lựa chọn này.
          </p>
        )}
      </section>
      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer font-semibold text-sm">
          Kết quả lịch sử chưa gắn lớp / học kỳ ({legacy?.meta.total || 0})
        </summary>
        <div id="legacy-print" className="mt-3 space-y-3">
          <h2 className="font-bold">Bảng điểm lịch sử — trang {legacyPage}</h2>
          <p className="text-xs text-slate-500">
            Giữ nguyên dữ liệu cũ, không suy đoán điểm thành phần hoặc tự gán
            lớp/học kỳ.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Mã HV",
                  "Học viên",
                  "Môn",
                  "Điểm/ký hiệu",
                  "Kết quả",
                  "",
                ].map((h, i) => (
                  <th className="p-2" key={i}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {legacy?.data.map((r) => (
                <tr className="border-t" key={r.id}>
                  <td className="p-2">{r.studentCode}</td>
                  <td>{r.studentName}</td>
                  <td>
                    {r.courseCode} — {r.courseName}
                  </td>
                  <td>{r.grade ?? "—"}</td>
                  <td>{r.resultStatus}</td>
                  <td className="print:hidden">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          setDetail(await gradeService.detail(r.id));
                          setCommand(null);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Không đọc được chi tiết.",
                          );
                        }
                      }}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 mt-3 items-center">
          <Button
            size="sm"
            variant="outline"
            disabled={legacyPage <= 1}
            onClick={() => setLegacyPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span className="text-xs">
            {legacyPage} / {legacy?.meta.totalPages || 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={legacyPage >= (legacy?.meta.totalPages || 1)}
            onClick={() => setLegacyPage((p) => p + 1)}
          >
            Sau
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!legacy?.data.length}
            onClick={() => {
              setPrintTarget("legacy-print");
              setTimeout(() => window.print(), 50);
            }}
          >
            In trang điểm lịch sử
          </Button>
        </div>
      </details>
      <Modal
        isOpen={!!policy}
        onClose={() => setPolicy(null)}
        title="Quy tắc chấm điểm qua Excel"
      >
        {policy && (
          <PolicyEditor
            data={policy}
            onSaved={() => {
              setPolicy(null);
              refreshRows();
              setFile(null);
              setPreview(null);
              setMessage(
                "Đã lưu quy tắc tính điểm. Bấm tải Excel học viên và điểm hiện có để lấy mẫu mới nhất.",
              );
            }}
          />
        )}
      </Modal>
      <Modal
        isOpen={!!detail}
        onClose={() => {
          setDetail(null);
          setCommand(null);
        }}
        title="Chi tiết và lịch sử điểm"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 space-y-2">
              <p className="font-semibold">
                {detail.studentCode} — {detail.studentName}
              </p>
              <p>
                {detail.courseCode} — {detail.courseName}
              </p>
              <p>
                Trạng thái điểm:{" "}
                <strong>{gradeStates[detail.state] || detail.state}</strong>
                {detail.classCode && (
                  <>
                    {" "}
                    · Lớp học phần {detail.classCode}:{" "}
                    <strong>
                      {classStates[detail.classStatus || ""] || "Chưa xác định"}
                    </strong>
                  </>
                )}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {[
                  ["Chuyên cần", detail.attendanceScore],
                  ["Giữa kỳ", detail.midtermScore],
                  ["Thi", detail.examScore],
                  ["Tổng điểm", detail.totalScore ?? detail.grade],
                ].map(([label, value]) => (
                  <p key={String(label)}>
                    {label}: <strong>{value ?? "Chưa có"}</strong>
                  </p>
                ))}
              </div>
            </div>
            {canManage && detail.permissions.canManage && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    ...(detail.state === "DRAFT" ? ["chot" as const] : []),
                    ...(["DRAFT", "FINALIZED"].includes(detail.state)
                      ? ["huy" as const]
                      : []),
                    ...(detail.state === "VOIDED" ? ["mo-lai" as const] : []),
                  ].map((action) => (
                    <Button
                      key={action}
                      variant={command === action ? "primary" : "outline"}
                      disabled={!detail.availableActions?.[action].allowed}
                      title={
                        detail.availableActions?.[action].reason || undefined
                      }
                      onClick={() =>
                        setCommand(command === action ? null : action)
                      }
                    >
                      {commandInfo[action].label}
                    </Button>
                  ))}
                </div>
                {detail.state === "DRAFT" &&
                  !detail.availableActions?.chot.allowed && (
                    <p
                      role="status"
                      className="rounded-lg bg-amber-50 p-3 text-amber-900"
                    >
                      {detail.availableActions?.chot.reason ||
                        "Tải lại dữ liệu để kiểm tra điều kiện chốt điểm."}{" "}
                      Bạn vẫn có thể lưu và sửa điểm nháp bằng Excel ở Bước 3.
                    </p>
                  )}
                {detail.state === "VOIDED" &&
                  !detail.availableActions?.["mo-lai"].allowed && (
                    <p role="status" className="text-amber-800">
                      {detail.availableActions?.["mo-lai"].reason ||
                        "Tải lại dữ liệu để kiểm tra điều kiện mở lại."}
                    </p>
                  )}
              </div>
            )}
            {canManage &&
              detail.permissions.canManage &&
              detail.state === "LEGACY" && (
                <LegacyEditor
                  detail={detail}
                  onSaved={() => {
                    setDetail(null);
                    refreshRows();
                  }}
                />
              )}
            {command &&
              detail.permissions.canManage &&
              detail.availableActions?.[command].allowed && (
                <GradeAction
                  key={command}
                  detail={detail}
                  action={command}
                  onSaved={() => {
                    setDetail(null);
                    setCommand(null);
                    refreshRows();
                  }}
                />
              )}
            <h3 className="font-semibold">Lịch sử xử lý</h3>
            {detail.history.length === 0 && (
              <p className="text-slate-500">Chưa có lịch sử xử lý.</p>
            )}
            {detail.history.map((h, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p>
                  {historyLabels[h.action] || h.action} · {h.actorName} ·{" "}
                  {new Date(h.createdAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Bangkok",
                  })}
                </p>
                <p>
                  {h.note} · {h.reference}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #${printTarget},#${printTarget} * {
            visibility: visible;
          }
          #${printTarget} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: 0;
          }
          #${printTarget} button {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
