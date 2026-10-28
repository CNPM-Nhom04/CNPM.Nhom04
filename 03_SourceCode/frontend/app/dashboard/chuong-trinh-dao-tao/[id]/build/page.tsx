"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Save, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
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
  type PageResult,
  type CatalogCourse,
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
  const [catalogSearch, setCatalogSearch] = useState(""),
    [catalogPage, setCatalogPage] = useState(1),
    [catalog, setCatalog] = useState<PageResult<CatalogCourse> | null>(null),
    [catalogLoading, setCatalogLoading] = useState(true),
    [catalogError, setCatalogError] = useState<Error | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [check, setCheck] = useState<{
    valid: boolean;
    issues: string[];
  } | null>(null);
  const editable =
    !!program?.permissions.canEdit &&
    ["DRAFT", "RETURNED"].includes(program.status);
  const track =
    program?.tracks.find((item) => item.id === activeTrackId) ||
    program?.tracks[0];
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
  useEffect(() => {
    if (!editable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      programRequest<PageResult<CatalogCourse>>(
        "/hoc-phan?" +
          new URLSearchParams({
            searchTerm: catalogSearch.trim(),
            page: String(catalogPage),
            limit: "10",
          }),
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            setCatalog(result);
            setCatalogError(null);
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setCatalogError(
              reason instanceof Error
                ? reason
                : new Error("Không thể tải ngân hàng học phần."),
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setCatalogLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editable, catalogSearch, catalogPage, version, catalogVersion]);
  function updateTrack(change: (track: ProgramTrack) => ProgramTrack) {
    if (!track || !editable) return;
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
    <div className="space-y-6 pb-16">
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
            {program.statusLabel}
          </Badge>
        )}
      </div>
      {loading && <p role="status">Đang tải cấu trúc...</p>}
      {!loading && program && (
        <>
          <div className="flex flex-wrap gap-3">
            {editable && (
              <Link
                href={`/dashboard/chuong-trinh-dao-tao/tao-moi?edit=${program.id}`}
              >
                <Button variant="outline" disabled={busy || dirty}>
                  Sửa thông tin chung / định mức
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
          <div className="bg-white rounded-xl border p-5 text-sm space-y-2">
            <p>
              Định mức mỗi hướng: <strong>{program.tongTinChiYeuCau} TC</strong>
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
          <div className="flex gap-2 flex-wrap">
            {program.tracks.map((item) => (
              <Button
                key={item.id}
                variant={track?.id === item.id ? "primary" : "outline"}
                disabled={busy}
                onClick={() => setActiveTrackId(item.id)}
              >
                {item.name}
                {item.status === "INACTIVE" ? " (ngừng hoạt động)" : ""}
              </Button>
            ))}
          </div>
          {track && (
            <fieldset disabled={busy || !editableTrack} className="space-y-5">
              <section className="bg-white rounded-xl border p-5 space-y-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <h2 className="font-bold">Nhóm kiến thức — {track.name}</h2>
                  {editableTrack && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateTrack((current) => ({
                          ...current,
                          groups: current.groups.map((group) => ({
                            ...group,
                            minimumCredits: current.groups.some(
                              (child) => child.parentId === group.id,
                            )
                              ? 0
                              : current.courses
                                  .filter(
                                    (course) => course.groupId === group.id,
                                  )
                                  .reduce(
                                    (sum, course) => sum + course.credits,
                                    0,
                                  ),
                          })),
                        }))
                      }
                    >
                      Điền tối thiểu theo học phần đã chọn
                    </Button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {track.groups.map((group) => (
                    <div key={group.id} className="space-y-1">
                      <label
                        htmlFor={"group-" + group.id}
                        className="text-xs font-semibold"
                      >
                        {group.code} — {group.name} · Tối đa:{" "}
                        {group.maximumCredits ?? "không giới hạn"} TC
                        {group.parentId ? " (nhóm con)" : ""}
                      </label>
                      <Input
                        id={"group-" + group.id}
                        type="number"
                        min="0"
                        max="9999"
                        step="0.01"
                        disabled={!editableTrack}
                        value={group.minimumCredits}
                        onChange={(event) =>
                          updateTrack((current) => ({
                            ...current,
                            groups: current.groups.map((item) =>
                              item.id === group.id
                                ? {
                                    ...item,
                                    minimumCredits: Number(event.target.value),
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-white rounded-xl border overflow-x-auto">
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
                        <th key={index} className="p-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {track.courses.map((course) => (
                      <tr key={course.id}>
                        <td className="p-3">
                          <strong>{course.code}</strong>
                          <p className="text-xs text-slate-500">
                            {course.name}
                          </p>
                          <ProgramCourseDetails course={course} />
                        </td>
                        <td className="p-3">{course.credits}</td>
                        <td className="p-3">
                          <select
                            aria-label={`Nhóm ${course.code}`}
                            disabled={!editableTrack}
                            value={course.groupId}
                            className="border rounded p-2 max-w-48"
                            onChange={(event) =>
                              updateTrack((current) => ({
                                ...current,
                                courses: current.courses.map((item) =>
                                  item.id === course.id
                                    ? { ...item, groupId: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          >
                            {track.groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.code} — {group.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            aria-label={`Tính chất ${course.code}`}
                            disabled={!editableTrack}
                            value={course.requirementType}
                            className="border rounded p-2"
                            onChange={(event) =>
                              updateTrack((current) => ({
                                ...current,
                                courses: current.courses.map((item) =>
                                  item.id === course.id
                                    ? {
                                        ...item,
                                        requirementType: event.target.value as
                                          "REQUIRED" | "ELECTIVE",
                                      }
                                    : item,
                                ),
                              }))
                            }
                          >
                            <option value="REQUIRED">Bắt buộc</option>
                            <option value="ELECTIVE">Tự chọn</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <Input
                            aria-label={`Học kỳ ${course.code}`}
                            disabled={!editableTrack}
                            type="number"
                            min="1"
                            max="12"
                            placeholder="Chưa xếp"
                            value={course.semester ?? ""}
                            onChange={(event) =>
                              updateTrack((current) => ({
                                ...current,
                                courses: current.courses.map((item) =>
                                  item.id === course.id
                                    ? {
                                        ...item,
                                        semester:
                                          event.target.value === ""
                                            ? null
                                            : Number(event.target.value),
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </td>
                        <td className="p-3">
                          {editable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Bỏ học phần"
                              onClick={() => {
                                if (confirm("Bỏ học phần khỏi hướng này?"))
                                  updateTrack((current) => ({
                                    ...current,
                                    courses: current.courses.filter(
                                      (item) => item.id !== course.id,
                                    ),
                                  }));
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!track.courses.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          Chưa chọn học phần cho hướng này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
              {editableTrack && (
                <section className="bg-white border rounded-xl p-5 space-y-4">
                  <h2 className="font-bold">Chọn học phần từ ngân hàng</h2>
                  <ProgramFeedback
                    error={catalogError}
                    retry={() => {
                      setCatalogLoading(true);
                      setCatalogVersion((value) => value + 1);
                    }}
                  />
                  <Input
                    aria-label="Tìm học phần"
                    maxLength={255}
                    placeholder="Tìm theo mã hoặc tên học phần..."
                    value={catalogSearch}
                    onChange={(event) => {
                      setCatalogSearch(event.target.value);
                      setCatalogPage(1);
                      setCatalogLoading(true);
                    }}
                  />
                  {catalogLoading ? (
                    <p role="status" className="text-sm">
                      Đang tải học phần...
                    </p>
                  ) : (
                    catalog?.data.map((course) => (
                      <div
                        key={course.id}
                        className="flex justify-between gap-3 items-center border-b pb-2 text-sm"
                      >
                        <div>
                          <strong>{course.code}</strong> — {course.name}
                          <p className="text-xs text-slate-500">
                            {course.credits} TC · LT {course.theoryHours} / TH{" "}
                            {course.practiceHours}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            track.courses.some(
                              (item) => item.courseId === course.courseId,
                            ) || !track.groups.length
                          }
                          onClick={() =>
                            updateTrack((current) => ({
                              ...current,
                              courses: [
                                ...current.courses,
                                {
                                  id: "new-" + course.id,
                                  courseId: course.courseId,
                                  courseVersionId: course.id,
                                  code: course.code,
                                  name: course.name,
                                  credits: course.credits,
                                  englishName: null,
                                  theoryHours: course.theoryHours,
                                  practiceHours: course.practiceHours,
                                  prerequisites: [],
                                  ploMappings: [],
                                  groupId: current.groups[0].id,
                                  requirementType: "REQUIRED",
                                  semester: 1,
                                },
                              ],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Thêm
                        </Button>
                      </div>
                    ))
                  )}
                  {!catalogLoading && !catalog?.data.length && (
                    <p className="text-sm text-slate-500">
                      Không tìm thấy học phần ACTIVE phù hợp.
                    </p>
                  )}
                  <div className="flex gap-3 items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={catalogLoading || catalogPage <= 1}
                      onClick={() => {
                        setCatalogPage(catalogPage - 1);
                        setCatalogLoading(true);
                      }}
                    >
                      Trước
                    </Button>
                    <span className="text-xs">
                      Trang {catalogPage} / {catalog?.meta.totalPages ?? 0}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        catalogLoading ||
                        catalogPage >= (catalog?.meta.totalPages ?? 0)
                      }
                      onClick={() => {
                        setCatalogPage(catalogPage + 1);
                        setCatalogLoading(true);
                      }}
                    >
                      Sau
                    </Button>
                  </div>
                </section>
              )}
            </fieldset>
          )}
          <ProgramSqlDetails program={program} />
          <section className="bg-white border rounded-xl p-5 space-y-3">
            <h2 className="font-bold">Biên bản gần nhất & tài liệu đính kèm</h2>
            {program.review ? (
              <div className="text-sm space-y-1">
                <p>
                  {program.review.hoiDongThamDinh} · {program.review.ngayHop}
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
        </>
      )}
    </div>
  );
}
