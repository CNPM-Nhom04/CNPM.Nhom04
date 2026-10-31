"use client";
import { useEffect, useState } from "react";
import { GitCompare, FileSpreadsheet } from "lucide-react";
import {
  comparisonOptions,
  comparePrograms,
  exportComparison,
  type ComparisonOption,
  type ComparisonQuery,
  type ComparisonResult,
  type ComparisonCourse,
  type Difference,
} from "@/lib/services/comparisonService";

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const button =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50";
const statuses: Record<string, string> = {
  SAME: "Giữ nguyên",
  CHANGED: "Thay đổi",
  ONLY_A: "Chỉ có ở A",
  ONLY_B: "Chỉ có ở B",
};
const programStatus: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ duyệt",
  REVIEWING: "Thẩm định",
  RETURNED: "Yêu cầu sửa",
  PUBLISHED: "Đã ban hành",
  ARCHIVED: "Lưu trữ",
  RETIRED: "Ngừng sử dụng",
};
const fields: Record<string, string> = {
  courseId: "Định danh học phần",
  code: "Mã",
  courseVersionId: "Phiên bản học phần",
  versionNumber: "Số phiên bản",
  name: "Tên",
  englishName: "Tên tiếng Anh",
  credits: "Tín chỉ",
  theoryHours: "Giờ lý thuyết",
  practiceHours: "Giờ thực hành",
  description: "Mô tả",
  groupCode: "Nhóm kiến thức",
  requirementType: "Bắt buộc/tự chọn",
  semester: "Học kỳ",
  notes: "Ghi chú",
  prerequisites: "Tiên quyết",
  ploMappings: "Ánh xạ PLO",
  parentCode: "Nhóm cha",
  minimumCredits: "TC tối thiểu",
  maximumCredits: "TC tối đa",
  status: "Trạng thái",
};
function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function overviewValue(key: string, value: unknown) {
  const text = display(value);
  if (key === "status") return programStatus[text] || text;
  if (key === "trackStatus")
    return (
      (
        { ACTIVE: "Hoạt động", INACTIVE: "Ngừng hoạt động" } as Record<
          string,
          string
        >
      )[text] || text
    );
  if (key === "studyForm")
    return (
      (
        {
          CHINH_QUY: "Chính quy",
          VUA_LAM_VUA_HOC: "Vừa làm vừa học",
        } as Record<string, string>
      )[text] || text
    );
  return text;
}
interface Selection {
  version: ComparisonOption | null;
  track: string;
}
function Selector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Selection;
  onChange: (value: Selection) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ComparisonOption[]>([]);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      comparisonOptions(search, page, controller.signal)
        .then((result) => {
          setData(result.data);
          setPages(result.meta.totalPages);
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setData([]);
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
  }, [search, page, retry]);
  const options =
    value.version && !data.some((x) => x.versionId === value.version!.versionId)
      ? [value.version, ...data]
      : data;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold">{label}</h2>
      <input
        aria-label={"Tìm phiên bản " + label}
        className={input}
        placeholder="Tìm mã CTĐT, tên hoặc phiên bản..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {error && (
        <p role="alert" className="text-red-700">
          {error}{" "}
          <button className={button} onClick={() => setRetry((x) => x + 1)}>
            Thử lại
          </button>
        </p>
      )}
      <select
        aria-label={"Phiên bản " + label}
        className={input}
        value={value.version?.versionId || ""}
        onChange={(e) =>
          onChange({
            version:
              options.find((x) => x.versionId === e.target.value) || null,
            track: "",
          })
        }
      >
        <option value="">Chọn phiên bản từ CSDL</option>
        {options.map((x) => (
          <option key={x.versionId} value={x.versionId}>
            {x.programCode} / {x.versionCode} — {x.programName} (
            {programStatus[x.status] || x.status}) — {x.unitName}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3 text-sm">
        <button
          className={button}
          disabled={loading || page <= 1}
          onClick={() => setPage((x) => x - 1)}
        >
          Trước
        </button>
        <span>
          {loading
            ? "Đang tải..."
            : pages === 0
              ? "Không có phiên bản phù hợp"
              : `Trang ${page}/${pages}`}
        </span>
        <button
          className={button}
          disabled={loading || page >= pages}
          onClick={() => setPage((x) => x + 1)}
        >
          Sau
        </button>
      </div>
      <select
        aria-label={"Hướng " + label}
        className={input}
        disabled={!value.version}
        value={value.track}
        onChange={(e) => onChange({ ...value, track: e.target.value })}
      >
        <option value="">Chọn hướng đào tạo</option>
        {value.version?.tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code} — {t.name} (
            {t.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"})
          </option>
        ))}
      </select>
      {value.version && value.version.tracks.length === 0 && (
        <p>Phiên bản này chưa có hướng đào tạo để so sánh.</p>
      )}
    </section>
  );
}
function courseField(key: string, value: unknown): string {
  if (key === "requirementType")
    return value === "REQUIRED" ? "Bắt buộc" : "Tự chọn";
  if (key === "prerequisites") {
    const rows = value as ComparisonCourse["prerequisites"];
    return rows.length
      ? rows
          .map(
            (x) =>
              x.code +
              (x.minimumGrade == null
                ? ""
                : " (điểm tối thiểu: " + x.minimumGrade + ")"),
          )
          .join("; ")
      : "Không có";
  }
  if (key === "ploMappings") {
    const rows = value as ComparisonCourse["ploMappings"];
    const levels: Record<string, string> = {
      INTRODUCE: "Giới thiệu",
      REINFORCE: "Củng cố",
      MASTER: "Thành thạo",
    };
    return rows.length
      ? rows
          .map(
            (x) =>
              x.code +
              ": " +
              x.description +
              " — " +
              (x.contributionLevel
                ? levels[x.contributionLevel] || x.contributionLevel
                : "Chưa có mức đóng góp") +
              (x.status === "INACTIVE" ? " (ngừng hoạt động)" : ""),
          )
          .join("\n")
      : "Chưa có ánh xạ";
  }
  return display(value);
}
function CourseValue({ course }: { course: ComparisonCourse | null }) {
  if (!course) return <span>—</span>;
  return (
    <div className="space-y-1">
      <p className="font-semibold">{course.name}</p>
      <p>
        Phiên bản {course.versionNumber} · {course.credits} TC ·{" "}
        {course.requirementType === "REQUIRED" ? "Bắt buộc" : "Tự chọn"}
      </p>
      <p>
        Nhóm: {course.groupCode} · Học kỳ: {display(course.semester)}
      </p>
      <details>
        <summary className="cursor-pointer text-blue-700">
          Xem đầy đủ dữ liệu
        </summary>
        <dl className="mt-2 space-y-2">
          {Object.entries(course)
            .filter(([key]) => !["courseId", "courseVersionId"].includes(key))
            .map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold">{fields[key] || key}</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {courseField(key, value)}
                </dd>
              </div>
            ))}
        </dl>
      </details>
    </div>
  );
}
function JsonRows<T extends object>({ rows }: { rows: Difference<T>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Kết quả</th>
            <th>A</th>
            <th>B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-200 align-top">
              <td className="p-3">{row.key}</td>
              <td className="p-3">
                {statuses[row.status]}
                <p>{row.changedFields.map((x) => fields[x] || x).join(", ")}</p>
              </td>
              {[row.a, row.b].map((value, i) => (
                <td key={i} className="p-3">
                  {value ? (
                    <dl>
                      {Object.entries(value).map(([key, v]) => (
                        <div className="mb-1" key={key}>
                          <strong>{fields[key] || key}: </strong>
                          {display(v)}
                        </div>
                      ))}
                    </dl>
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="p-4">
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function SoSanhCTDTPage() {
  const [a, setA] = useState<Selection>({ version: null, track: "" }),
    [b, setB] = useState<Selection>({ version: null, track: "" });
  const [result, setResult] = useState<ComparisonResult | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false),
    [exporting, setExporting] = useState(false),
    [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState("");
  const va = a.version?.versionId || "",
    vb = b.version?.versionId || "",
    ta = a.track,
    tb = b.track;
  useEffect(() => {
    const controller = new AbortController();
    if (!va || !vb || !ta || !tb) {
      return;
    }
    comparePrograms(
      { versionA: va, trackA: ta, versionB: vb, trackB: tb },
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [va, vb, ta, tb, retry]);
  function changeSelection(side: "A" | "B", value: Selection) {
    const other = side === "A" ? b : a;
    if (side === "A") setA(value);
    else setB(value);
    setResult(null);
    setError("");
    setLoading(
      Boolean(value.version && value.track && other.version && other.track),
    );
  }
  function reload() {
    setResult(null);
    setError("");
    setLoading(Boolean(va && vb && ta && tb));
    setRetry((x) => x + 1);
  }
  const ready =
    result &&
    result.a.versionId === va &&
    result.a.trackId === ta &&
    result.b.versionId === vb &&
    result.b.trackId === tb;
  async function download() {
    if (!ready) return;
    setExporting(true);
    setError("");
    const query: ComparisonQuery = {
      versionA: va,
      trackA: ta,
      versionB: vb,
      trackB: tb,
    };
    try {
      await exportComparison(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xuất báo cáo thất bại.");
    } finally {
      setExporting(false);
    }
  }
  const rows = ready
    ? result.courses.filter(
        (row) =>
          (filter === "ALL" || row.status === filter) &&
          [row.a?.code, row.a?.name, row.b?.code, row.b?.name].some((x) =>
            x?.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
          ),
      )
    : [];
  const overview: [string, string][] = [
    ["programCode", "Mã CTĐT"],
    ["programName", "Tên CTĐT"],
    ["versionCode", "Phiên bản"],
    ["status", "Trạng thái phiên bản"],
    ["unitName", "Đơn vị quản lý"],
    ["levelName", "Bậc đào tạo"],
    ["majorName", "Ngành"],
    ["cohortYear", "Năm tuyển sinh"],
    ["cohortLabel", "Khóa áp dụng"],
    ["trackName", "Hướng đào tạo"],
    ["trackStatus", "Trạng thái hướng"],
    ["requiredCredits", "Định mức TC của hướng"],
    ["versionRequiredCredits", "Định mức TC chung (nếu được nhập)"],
    ["studyForm", "Hình thức"],
    ["duration", "Thời gian đào tạo"],
    ["languageRequirement", "Chuẩn ngoại ngữ"],
    ["itRequirement", "Chuẩn tin học"],
    ["effectiveFrom", "Hiệu lực từ"],
    ["effectiveTo", "Hiệu lực đến"],
  ];
  return (
    <div className="space-y-6 pb-16 text-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <GitCompare className="text-blue-600" />
            So Sánh Cấu Trúc Chương Trình Đào Tạo
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Chọn đúng phiên bản và hướng. Dữ liệu được đọc từ CSDL trong phạm vi
            được phân quyền.
          </p>
        </div>
        <button
          className={button}
          disabled={!ready || loading || exporting}
          onClick={download}
        >
          <FileSpreadsheet className="mr-2 inline h-4 w-4" />
          {exporting ? "Đang xuất..." : "Xuất Excel (.xlsx)"}
        </button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Selector
          label="Bản A"
          value={a}
          onChange={(value) => changeSelection("A", value)}
        />
        <Selector
          label="Bản B"
          value={b}
          onChange={(value) => changeSelection("B", value)}
        />
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}{" "}
          <button className={button} onClick={reload}>
            Thử lại
          </button>
        </div>
      )}
      {loading && <p role="status">Đang đối chiếu dữ liệu...</p>}
      {!loading && !ready && !error && (
        <p>
          Chọn đủ hai phiên bản và hai hướng để xem kết quả. CTĐT chưa có phiên
          bản chưa thể so sánh cấu trúc.
        </p>
      )}
      {ready && (
        <>
          {va === vb && ta === tb && (
            <p className="rounded-xl bg-blue-50 p-4">
              Bạn đang đối chiếu cùng một phiên bản và hướng; các học phần sẽ
              giữ nguyên.
            </p>
          )}
          {result.a.levelName !== result.b.levelName && (
            <p className="rounded-xl bg-amber-50 p-4">
              Hai CTĐT khác bậc đào tạo. Kết quả là đối chiếu cấu trúc, không
              xác nhận tương đương hay chuyển đổi tín chỉ.
            </p>
          )}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="p-4 font-bold">Thông số tổng quan</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3">Tiêu chí</th>
                    <th className="p-3">A</th>
                    <th className="p-3">B</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map(([key, label]) => {
                    const av = result.a[key as keyof typeof result.a],
                      bv = result.b[key as keyof typeof result.b];
                    return (
                      <tr
                        key={key}
                        className={
                          display(av) !== display(bv)
                            ? "border-t border-slate-200 bg-amber-50"
                            : "border-t border-slate-100"
                        }
                      >
                        <td className="p-3">{label}</td>
                        <td className="p-3">{overviewValue(key, av)}</td>
                        <td className="p-3">{overviewValue(key, bv)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-200">
                    <td className="p-3">Số học phần trong hướng</td>
                    <td className="p-3">{result.a.courses.length}</td>
                    <td className="p-3">{result.b.courses.length}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="p-3">
                      Tổng TC danh sách (gồm toàn bộ tự chọn)
                    </td>
                    <td className="p-3">{result.summary.listedCreditsA}</td>
                    <td className="p-3">{result.summary.listedCreditsB}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="p-4 text-sm text-slate-600">
              Tổng TC danh sách không phải định mức phải tích lũy. “—” là chưa
              có dữ liệu; không tự suy ra chuẩn ngoại ngữ hay hình thức đào tạo.
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold">Đối chiếu học phần</h2>
            <p className="my-3 text-sm">
              Giữ nguyên: {result.summary.same} · Thay đổi:{" "}
              {result.summary.changed} · Chỉ A: {result.summary.onlyA} · Chỉ B:{" "}
              {result.summary.onlyB}
            </p>
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                aria-label="Tìm học phần so sánh"
                className={input + " max-w-sm"}
                placeholder="Tìm mã hoặc tên học phần..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Lọc thay đổi"
                className={input + " max-w-xs"}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">Tất cả kết quả</option>
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {["Mã HP", "A", "B", "Thay đổi"].map((x) => (
                      <th key={x} className="p-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-t border-slate-200 align-top"
                    >
                      <td className="p-3 font-semibold">
                        {row.a?.code || row.b?.code}
                      </td>
                      <td className="w-1/3 p-3">
                        <CourseValue course={row.a} />
                      </td>
                      <td className="w-1/3 p-3">
                        <CourseValue course={row.b} />
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            row.status === "SAME"
                              ? "text-slate-700"
                              : "font-semibold text-amber-800"
                          }
                        >
                          {statuses[row.status]}
                        </span>
                        <p className="mt-2">
                          {row.changedFields
                            .map((x) => fields[x] || x)
                            .join(", ")}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={4} className="p-4">
                        Không có học phần phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 font-bold">
              Nhóm kiến thức (đối chiếu theo mã nhóm)
            </h2>
            <JsonRows rows={result.groups} />
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-4 font-bold">
              Chuẩn đầu ra của phiên bản (đối chiếu theo mã PLO)
            </h2>
            <JsonRows rows={result.outcomes} />
          </section>
        </>
      )}
    </div>
  );
}
