"use client";
import { ProgramExcelImport } from "@/components/programs/ProgramExcelImport";
import { fillGroupCredits, selectCourses } from "@/lib/programs/selection";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Save, Send, CheckCircle2 } from "lucide-react";
import { downloadExcel } from "@/lib/services/excelDownload";
import { Button, Input, Badge } from "@/components/ui";
import {
  ProgramSqlDetails,
  ProgramCourseDetails,
} from "@/components/programs/ProgramSqlDetails";
import { ProgramFeedback } from "@/components/programs/ProgramFeedback";
import {
  programRequest,
  programService,
  type ProgramRecord,
  type ProgramTrack,
} from "@/lib/services/programService";
export default function ProgramBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<ProgramRecord | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [message, setMessage] = useState("");
  const [version, setVersion] = useState(0),
    [activeTrackId, setActiveTrackId] = useState(""),
    [dirty, setDirty] = useState(false);
  const [detailTab, setDetailTab] = useState<"courses" | "excel" | "info">(
    "courses",
  );
  const [courseSearch, setCourseSearch] = useState("");
  const [courseGroup, setCourseGroup] = useState("");
  const [check, setCheck] = useState<{
    valid: boolean;
    issues: string[];
  } | null>(null);
  const editable =
    !program?.sourceReadOnly &&
    !!program?.permissions.canEdit &&
    ["DRAFT", "RETURNED"].includes(program.status);
  const track =
    program?.tracks.find((item) => item.id === activeTrackId) ||
    program?.tracks[0];
  const visibleCourses =
    track?.courses.filter(
      (course) =>
        (!courseGroup || course.groupId === courseGroup) &&
        `${course.code} ${course.name}`
          .toLocaleLowerCase("vi")
          .includes(courseSearch.trim().toLocaleLowerCase("vi")),
    ) || [];
  const editableTrack = editable && track?.status !== "INACTIVE";
  useEffect(() => {
    const controller = new AbortController();
    programService
      .detail(id, controller.signal)
      .then((item) => {
        if (!controller.signal.aborted) {
          setProgram(item);
          setError(null);
          setDirty(false);
          setCheck(null);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason : new Error("Không thể tải CTĐT."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, version]);
  function updateTrack(change: (track: ProgramTrack) => ProgramTrack) {
    if (!track || !editableTrack || busy) return;
    setProgram((current) =>
      current
        ? {
            ...current,
            tracks: current.tracks.map((item) =>
              item.id === track.id ? change(item) : item,
            ),
          }
        : null,
    );
    setDirty(true);
    setCheck(null);
    setMessage("");
  }
  async function autoSelect() {
    if (!program || !track || busy || !editableTrack) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const ids = await programRequest<string[]>(
        `/${program.id}/hoc-phan-phu-hop`,
      );
      const selected = selectCourses(track, new Set(ids));
      const required = selected.courses
        .filter((c) => c.requirementType === "REQUIRED")
        .reduce((sum, c) => sum + c.credits, 0);
      const ratio =
        selected.requiredCredits > 0
          ? ((selected.requiredCredits - required) * 100) /
            selected.requiredCredits
          : 0;
      if (
        (program.rules.minElective != null &&
          ratio < program.rules.minElective - 0.0001) ||
        (program.rules.maxElective != null &&
          ratio > program.rules.maxElective + 0.0001)
      )
        throw new Error(
          "Tổ hợp môn không đáp ứng tỷ lệ tín chỉ tự chọn. Hãy điều chỉnh tính chất môn hoặc định mức nhóm.",
        );
      updateTrack(() => selected);
      setMessage(
        `Đã chọn ${selected.courses.length} môn phù hợp ngành ${program.majorName}, đủ ${selected.requiredCredits} TC. Lưu cấu trúc để kiểm tra CTĐT.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Không chọn được môn."));
    } finally {
      setBusy(false);
    }
  }
  async function action(type: "save" | "validate" | "submit") {
    if (!program || busy) return;
    if (
      type === "submit" &&
      !confirm(
        "Gửi hồ sơ xét duyệt? Cấu trúc sẽ được khóa trong thời gian chờ.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      if (type === "validate")
        setCheck(await programService.validate(program.id));
      else {
        const item =
          type === "save"
            ? await programService.structure(program)
            : await programService.submit(program);
        setProgram(item);
        setDirty(false);
        setCheck(null);
        setMessage(
          type === "save" ? "Đã lưu cấu trúc CTĐT." : "Đã gửi hồ sơ xét duyệt.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason
          : new Error("Không thể thực hiện yêu cầu."),
      );
    } finally {
      setBusy(false);
    }
  }
  function reload() {
    if (dirty && !confirm("Tải lại sẽ bỏ các chỉnh sửa chưa lưu. Tiếp tục?"))
      return;
    setLoading(true);
    setVersion((value) => value + 1);
  }
  return (
    <div className="space-y-4 pb-16">
      <ProgramFeedback error={error} message={message} retry={reload} />
      <div className="bg-white p-5 rounded-xl border flex flex-wrap justify-between items-center gap-4">
        <div>
          <Link
            href="/dashboard/chuong-trinh-dao-tao"
            className="text-sm text-blue-600"
          >
            ← Danh sách CTĐT
          </Link>
          <h1 className="text-lg font-bold mt-1">
            {program?.tenCTDT || "Xây dựng cấu trúc đào tạo"}
          </h1>
          {program && (
            <p className="text-xs text-slate-500">
              {program.maCTDT} · {program.maPhienBan} · {program.levelName} ·{" "}
              {program.khoaTuyenSinh}
            </p>
          )}
        </div>
        {program && (
          <Badge
            variant={
              program.status === "PUBLISHED"
                ? "approved"
                : editable
                  ? "draft"
                  : "pending"
            }
          >
            {program.sourceUrl ? "Công bố trên AGU" : program.statusLabel}
          </Badge>
        )}
      </div>
      {loading && <p role="status">Đang tải cấu trúc...</p>}
      {!loading && program && (
        <>
          <div className="flex flex-wrap gap-3">
            {program.permissions.canExport && (
              <Button
                variant="outline"
                disabled={busy || dirty || !track}
                onClick={async () => {
                  if (!track) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await downloadExcel(
                      `/api/chuong-trinh-dao-tao/${program.id}/xuat-excel?` +
                        new URLSearchParams({ trackId: track.id }),
                      `Khung_CTDT_${program.maPhienBan}_${track.code}.xlsx`,
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e
                        : new Error("Không thể xuất Excel."),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Xuất Excel
              </Button>
            )}
            {dirty && (
              <span className="self-center text-sm text-amber-800">
                Lưu thay đổi trước khi xuất Excel.
              </span>
            )}

            {editable && (
              <Link
                href={`/dashboard/chuong-trinh-dao-tao/tao-moi?edit=${program.id}`}
              >
                <Button variant="outline" disabled={busy || dirty}>
                  Thông tin chung
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              disabled={busy || dirty}
              onClick={() => action("validate")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Kiểm tra CTĐT
            </Button>
            {editable && (
              <Button disabled={busy || !dirty} onClick={() => action("save")}>
                <Save className="h-4 w-4 mr-1" />
                Lưu cấu trúc
              </Button>
            )}
            {editable && program.permissions.canSubmit && (
              <Button disabled={busy || dirty} onClick={() => action("submit")}>
                <Send className="h-4 w-4 mr-1" />
                Gửi xét duyệt
              </Button>
            )}
            {program.permissions.canApprove &&
              ["SUBMITTED", "REVIEWING"].includes(program.status) && (
                <Link
                  href={`/dashboard/chuong-trinh-dao-tao/${program.id}/xet-duyet`}
                >
                  <Button>Thẩm định hồ sơ</Button>
                </Link>
              )}
          </div>
          {dirty && (
            <p className="text-sm text-amber-700">
              Có chỉnh sửa chưa lưu. Lưu cấu trúc trước khi kiểm tra hoặc gửi
              duyệt.
            </p>
          )}
          {check && (
            <div
              role="status"
              className={`rounded-lg border p-4 text-sm ${check.valid ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
            >
              {check.valid ? (
                "CTĐT đáp ứng các kiểm tra tín chỉ."
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {check.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {program.sourceUrl && (
            <section className="rounded-xl border bg-white p-5 space-y-3">
              <h2 className="font-bold">Chương trình công bố trên AGU</h2>
              <p className="text-sm">
                {program.sourceInstitution} · Mã ngành {program.sourceMajorCode}{" "}
                · {program.khoaTuyenSinh || "Chưa công bố niên khóa"}
              </p>
              <div className="flex gap-4 text-sm text-blue-700 underline">
                <a href={program.sourceUrl} target="_blank" rel="noreferrer">
                  Xem trang gốc AGU
                </a>
                {program.sourceDocumentUrl && (
                  <a
                    href={program.sourceDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở tài liệu CTĐT
                  </a>
                )}
              </div>
              {program.sourceTotalCredits != null && (
                <p className="text-sm">
                  Số tín chỉ theo nguồn:{" "}
                  <strong>{program.sourceTotalCredits} TC</strong>.
                </p>
              )}
              {program.sourceContent && (
                <details open={!program.tracks.length}>
                  <summary className="cursor-pointer font-medium text-sm">
                    Bản trích nội dung chương trình từ AGU
                  </summary>
                  <pre className="mt-3 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">
                    {program.sourceContent}
                  </pre>
                </details>
              )}
              {!program.tracks.length && (
                <p className="text-sm text-slate-600">
                  Học phần và kế hoạch đào tạo xem trong nội dung / tài liệu
                  gốc. Chưa chuyển thành cấu trúc nhóm A–D trong hệ thống.
                </p>
              )}
            </section>
          )}
          <div className="flex gap-2 flex-wrap">
            {program.tracks.map((item) => (
              <Button
                key={item.id}
                variant={track?.id === item.id ? "primary" : "outline"}
                disabled={busy}
                onClick={() => {
                  setActiveTrackId(item.id);
                  setCourseGroup("");
                }}
              >
                {item.name}
                {item.status === "INACTIVE" ? " (ngừng hoạt động)" : ""}
              </Button>
            ))}
          </div>
          <nav
            aria-label="Nội dung chi tiết CTĐT"
            className="flex gap-1 border-b overflow-x-auto"
          >
            {(
              [
                { id: "courses", label: "Học phần & tín chỉ" },
                ...(editableTrack
                  ? [{ id: "excel", label: "Nhập Excel" }]
                  : []),
                { id: "info", label: "Thông tin & lịch sử" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={detailTab === tab.id ? "page" : undefined}
                onClick={() => setDetailTab(tab.id as typeof detailTab)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm border-b-2 ${detailTab === tab.id ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {detailTab === "info" && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border p-5 text-sm space-y-2">
                <p>
                  Định mức mỗi hướng:{" "}
                  <strong>
                    {program.sourceUrl
                      ? program.sourceTotalCredits == null
                        ? "Xem tài liệu AGU"
                        : `${program.sourceTotalCredits} TC`
                      : `${program.tongTinChiYeuCau} TC`}
                  </strong>
                  . Quy định bậc: {program.rules.minCredits ?? "—"}–
                  {program.rules.maxCredits ?? "—"} TC; tự chọn{" "}
                  {program.rules.minElective ?? "—"}–
                  {program.rules.maxElective ?? "—"}%.
                </p>
                <p className="text-slate-500">
                  Mỗi hướng là một cấu trúc độc lập. Tổng định mức tối thiểu các
                  nhóm phải bằng định mức hướng; phần vượt tín chỉ bắt buộc được
                  chọn từ các học phần tự chọn.
                </p>
              </div>
              <div className="rounded-xl border bg-white p-4 space-y-4">
                <nav
                  aria-label="Các phần chi tiết CTĐT"
                  className="flex flex-wrap gap-4 text-sm text-blue-700"
                >
                  <a className="underline" href="#program-details">
                    Thông tin chung / nguồn dữ liệu
                  </a>
                  <a className="underline" href="#program-plos">
                    Chuẩn đầu ra PLO
                  </a>
                  <a className="underline" href="#program-history">
                    Lịch sử xét duyệt
                  </a>
                </nav>
                <ProgramSqlDetails program={program} />
                <section className="bg-white border rounded-xl p-5 space-y-3">
                  <h2 className="font-bold">
                    Biên bản gần nhất & tài liệu đính kèm
                  </h2>
                  {program.review ? (
                    <div className="text-sm space-y-1">
                      <p>
                        {program.review.hoiDongThamDinh} ·{" "}
                        {program.review.ngayHop}
                      </p>
                      <p>
                        Chủ tịch: {program.review.chuTichHoidong}; Thư ký:{" "}
                        {program.review.thuKhao}
                      </p>
                      <p>Kết luận: {program.review.ketLuan}</p>
                      <p className="whitespace-pre-line">
                        {program.review.yKienDongGop}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Chưa có biên bản thẩm định cho lần gửi gần nhất.
                    </p>
                  )}
                  {program.documents.map((document) => (
                    <a
                      key={document.id}
                      className="block text-sm text-blue-600 underline"
                      href={`/api/chuong-trinh-dao-tao/${program.id}/tai-lieu/${document.id}`}
                    >
                      {document.name}
                    </a>
                  ))}
                </section>
              </div>
            </div>
          )}
          {track && editableTrack && detailTab === "excel" && (
            <ProgramExcelImport
              key={`${program.id}-${track.id}`}
              programId={program.id}
              track={track}
              revision={program.revision}
              disabled={busy}
              onApply={updateTrack}
            />
          )}
          {track && detailTab === "courses" && (
            <fieldset disabled={busy || !editableTrack} className="space-y-3">
              <section className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <h2 className="font-bold">Nhóm kiến thức — {track.name}</h2>
                  {editableTrack && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={autoSelect}
                      >
                        Tự chọn môn theo ngành
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateTrack(fillGroupCredits)}
                      >
                        Tính tín chỉ nhóm từ môn đã chọn
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Ngành {program.majorName} · Định mức {track.requiredCredits}{" "}
                  TC. Tự chọn chỉ dùng môn được đối chiếu từ CTĐT đã ban hành
                  cùng ngành và bậc; giữ môn bắt buộc và tiên quyết.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {track.groups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-lg border bg-slate-50 p-3 space-y-2"
                    >
                      <label
                        htmlFor={"group-" + group.id}
                        className="text-xs font-semibold"
                      >
                        <span className="text-blue-700">{group.code}</span> ·{" "}
                        {group.name}
                      </label>
                      <p className="text-lg font-bold">
                        {group.minimumCredits}{" "}
                        <span className="text-xs font-normal">TC</span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-white rounded-xl border overflow-x-auto">
                <div className="px-4 py-3 border-b text-sm font-semibold">
                  Học phần đã chọn · {track.courses.length} môn ·{" "}
                  {track.courses.reduce((sum, c) => sum + c.credits, 0)} TC /
                  định mức {track.requiredCredits} TC
                </div>
                <div className="flex flex-wrap gap-2 p-3 border-b">
                  <Input
                    aria-label="Tìm trong môn đã chọn"
                    placeholder="Tìm mã hoặc tên môn…"
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value)}
                    className="max-w-xs"
                  />
                  <select
                    aria-label="Lọc nhóm môn đã chọn"
                    value={courseGroup}
                    onChange={(event) => setCourseGroup(event.target.value)}
                    className="border rounded-lg px-3 text-sm bg-white"
                  >
                    <option value="">Tất cả nhóm</option>
                    {track.groups.map((g) => (
                      <option value={g.id} key={g.id}>
                        {g.code} — {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <table className="w-full min-w-[850px] text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase">
                      {[
                        "Mã / tên học phần",
                        "TC",
                        "Nhóm kiến thức",
                        "Tính chất",
                        "Học kỳ",
                        "",
                      ].map((label, index) => (
                        <th key={index} className="px-3 py-2">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleCourses.map((course) => (
                      <tr key={course.id}>
                        <td className="px-3 py-2">
                          <strong>{course.code}</strong>
                          <p className="text-xs text-slate-500">
                            {course.name}
                          </p>
                          <ProgramCourseDetails course={course} compact />
                        </td>
                        <td className="px-3 py-2">{course.credits}</td>
                        <td className="px-3 py-2">
                          <span>
                            {track.groups.find((g) => g.id === course.groupId)
                              ?.code || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span>
                            {course.requirementType === "REQUIRED"
                              ? "Bắt buộc"
                              : "Tự chọn"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span>{course.semester ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    ))}
                    {!visibleCourses.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          Chưa có học phần hoặc không có môn khớp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
