"use client";
import { FormEvent, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useSessionUser } from "@/components/auth/SessionProvider";
import {
  thesisTopicService as api,
  Page,
  StudentOption,
  Supervisor,
  Topic,
  TopicDetail,
  TopicList,
  TopicStatus,
} from "@/lib/services/thesisTopicService";
const ctl =
  "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 disabled:bg-slate-100 disabled:text-slate-700";
const statuses: Record<TopicStatus, string> = {
  CHO_DUYET: "Chờ duyệt",
  DANG_THUC_HIEN: "Đang thực hiện",
  TU_CHOI: "Đã trả lại",
  HOAN_THANH: "Đã nghiệm thu",
  DA_HUY: "Đã hủy",
};
const err = (e: unknown) =>
  e instanceof Error ? e.message : "Không thể thực hiện yêu cầu.";
type Action = "duyet" | "tu-choi" | "huy" | "nghiem-thu";
const actionNames: Record<Action, string> = {
  duyet: "Duyệt đề tài",
  "tu-choi": "Trả lại đề tài",
  huy: "Hủy đề tài",
  "nghiem-thu": "Xác nhận nghiệm thu",
};
const blankSupervisor = () => ({
  unitId: "",
  code: "",
  fullName: "",
  institution: "",
  qualification: "",
  email: "",
});
export default function DeTaiLuanVanPage() {
  const user = useSessionUser();
  const [tab, setTab] = useState<"topics" | "supervisors">("topics");
  const [topics, setTopics] = useState<TopicList | null>(null);
  const [supervisors, setSupervisors] = useState<Page<Supervisor> | null>(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [units, setUnits] = useState<
      { id: string; name: string; status: string }[]
    >([]),
    [unitsError, setUnitsError] = useState("");
  const [detail, setDetail] = useState<TopicDetail | null>(null),
    [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState<TopicDetail | "new" | null>(null),
    [student, setStudent] = useState<StudentOption | Topic | null>(null);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [supervisorId, setSupervisorId] = useState(""),
    [formError, setFormError] = useState("");
  const [students, setStudents] = useState<Page<StudentOption> | null>(null),
    [studentSearch, setStudentSearch] = useState(""),
    [studentPage, setStudentPage] = useState(1),
    [studentError, setStudentError] = useState(""),
    [studentLoading, setStudentLoading] = useState(false);
  const [options, setOptions] = useState<Page<Supervisor> | null>(null),
    [supervisorSearch, setSupervisorSearch] = useState(""),
    [supervisorPage, setSupervisorPage] = useState(1),
    [supervisorError, setSupervisorError] = useState(""),
    [supervisorLoading, setSupervisorLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false),
    [profile, setProfile] = useState(blankSupervisor),
    [profileError, setProfileError] = useState("");
  const [action, setAction] = useState<Action | null>(null),
    [note, setNote] = useState(""),
    [reference, setReference] = useState(""),
    [actionError, setActionError] = useState("");
  const canManage =
    topics?.permissions.canManage ??
    !!user?.permissions.includes("TOPIC_MANAGE");
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
        tab === "topics"
          ? api.list(search, status, page, abort.signal).then(setTopics)
          : api
              .supervisors(search, status, "", page, abort.signal)
              .then(setSupervisors);
      job
        .catch((e) => {
          if (!abort.signal.aborted) setError(err(e));
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [tab, search, status, page, reload]);
  useEffect(() => {
    const abort = new AbortController();
    api
      .units(abort.signal)
      .then((x) => {
        setUnits(x);
        setUnitsError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setUnitsError(err(e));
      });
    return () => abort.abort();
  }, [reload]);
  useEffect(() => {
    if (editing !== "new") return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setStudentLoading(true);
        setStudentError("");
      }
    });
    const timer = setTimeout(
      () =>
        api
          .students(studentSearch, studentPage, abort.signal)
          .then(setStudents)
          .catch((e) => {
            if (!abort.signal.aborted) setStudentError(err(e));
          })
          .finally(() => {
            if (!abort.signal.aborted) setStudentLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [editing, studentSearch, studentPage, reload]);
  const selectedUnit = student?.unitId || "";
  useEffect(() => {
    if (!editing || !selectedUnit) return;
    const abort = new AbortController();
    queueMicrotask(() => {
      if (!abort.signal.aborted) {
        setSupervisorLoading(true);
        setSupervisorError("");
      }
    });
    const timer = setTimeout(
      () =>
        api
          .supervisors(
            supervisorSearch,
            "ACTIVE",
            selectedUnit,
            supervisorPage,
            abort.signal,
          )
          .then(setOptions)
          .catch((e) => {
            if (!abort.signal.aborted) setSupervisorError(err(e));
          })
          .finally(() => {
            if (!abort.signal.aborted) setSupervisorLoading(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [editing, selectedUnit, supervisorSearch, supervisorPage, reload]);
  const refresh = () => setReload((n) => n + 1);
  function begin(item: TopicDetail | "new") {
    setEditing(item);
    setStudent(item === "new" ? null : item);
    setTitle(item === "new" ? "" : item.title);
    setDescription(item === "new" ? "" : item.description || "");
    setSupervisorId(item === "new" ? "" : item.supervisorId);
    setFormError("");
    setStudentError("");
    setSupervisorError("");
    setStudentSearch("");
    setSupervisorSearch("");
    setStudentPage(1);
    setSupervisorPage(1);
    setOptions(null);
    setStudents(null);
    setNotice("");
  }
  async function view(item: Topic) {
    setBusy(true);
    setError("");
    setDetailError("");
    try {
      setDetail(await api.detail(item.id));
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing || !student || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const data = { supervisorId, title, description };
      const result =
        editing === "new"
          ? await api.create({ ...data, assignmentId: student.assignmentId })
          : await api.edit(editing.id, { ...data, revision: editing.revision });
      setDetail(result);
      setEditing(null);
      setNotice("Đã lưu đề tài vào CSDL và gửi chờ duyệt.");
      refresh();
    } catch (e) {
      setFormError(err(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProfileError("");
    try {
      await api.createSupervisor({
        ...profile,
        email: profile.email || undefined,
      });
      setProfileOpen(false);
      setNotice("Đã lưu hồ sơ GVHD vào CSDL.");
      refresh();
    } catch (e) {
      setProfileError(err(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggleProfile(item: Supervisor) {
    if (
      busy ||
      !window.confirm(
        (item.status === "ACTIVE"
          ? "Ngừng phân công mới cho "
          : "Mở phân công lại cho ") +
          item.fullName +
          "? Các đề tài cũ vẫn giữ lịch sử.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.supervisorStatus(item);
      refresh();
      setNotice("Đã cập nhật trạng thái hồ sơ GVHD.");
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }
  function beginAction(value: Action) {
    setAction(value);
    setNote("");
    setReference("");
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
          note,
          ...(["duyet", "nghiem-thu"].includes(action) ? { reference } : {}),
        }),
      );
      setAction(null);
      refresh();
      setNotice("Đã cập nhật trạng thái và lịch sử trong CSDL.");
    } catch (e) {
      setActionError(err(e));
    } finally {
      setBusy(false);
    }
  }
  function pager(
    meta: Page<unknown>["meta"] | undefined,
    current: number,
    change: (p: number) => void,
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
  return (
    <div className="space-y-5 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <FileText className="text-blue-600" />
            Quản Lý Đề Tài Luận Văn & Phân Công GVHD
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Hồ sơ học viên, đề tài và GVHD theo phạm vi đơn vị được cấp.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => begin("new")}>
              <Plus className="mr-1 h-4 w-4" />
              Đăng ký đề tài mới
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setProfile(blankSupervisor());
                setProfileError("");
                setProfileOpen(true);
              }}
            >
              Thêm hồ sơ GVHD
            </Button>
          </div>
        )}
      </header>
      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
      <div className="flex gap-2">
        {(["topics", "supervisors"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "outline"}
            onClick={() => {
              setTab(t);
              setSearch("");
              setStatus("ALL");
              setPage(1);
            }}
          >
            {t === "topics" ? "Đề tài luận văn" : "Hồ sơ GVHD"}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          aria-label="Tìm kiếm"
          placeholder={
            tab === "topics"
              ? "Tìm mã HV, tên học viên, đề tài hoặc GVHD..."
              : "Tìm mã hồ sơ hoặc tên GVHD..."
          }
          className={ctl + " flex-1"}
          value={search}
          maxLength={255}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Lọc trạng thái"
          className={ctl + " md:w-52"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          {tab === "topics" ? (
            Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))
          ) : (
            <>
              <option value="ACTIVE">Đang phân công</option>
              <option value="INACTIVE">Ngừng phân công mới</option>
            </>
          )}
        </select>
        <Button variant="outline" disabled={loading} onClick={refresh}>
          Tải lại
        </Button>
      </div>
      {error ? (
        <div role="alert" className="rounded bg-red-50 p-4 text-red-800">
          {error}{" "}
          <Button variant="outline" onClick={refresh}>
            Thử lại
          </Button>
        </div>
      ) : loading ? (
        <p role="status">Đang tải dữ liệu từ CSDL...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {tab === "topics" ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {[
                    "Mã HV",
                    "Học viên & CTĐT",
                    "Tên đề tài",
                    "GVHD",
                    "Trạng thái",
                    "Thao tác",
                  ].map((h) => (
                    <th className="p-4" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topics?.data.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4 font-semibold text-blue-700">
                      {item.studentCode}
                    </td>
                    <td className="p-4">
                      <strong>{item.studentName}</strong>
                      <p className="text-xs text-slate-600">
                        {item.programName} · {item.majorName}
                        <br />
                        {item.unitName}
                      </p>
                    </td>
                    <td className="p-4">{item.title}</td>
                    <td className="p-4">{item.supervisorName}</td>
                    <td className="p-4">{statuses[item.status]}</td>
                    <td className="p-4">
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
                {!topics?.data.length && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-600">
                      Chưa có đề tài phù hợp trong phạm vi. Không sử dụng dữ
                      liệu mẫu.
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
                    "Mã hồ sơ",
                    "Họ tên",
                    "Đơn vị quản lý",
                    "Hồ sơ chuyên môn",
                    "Trạng thái",
                    "Thao tác",
                  ].map((h) => (
                    <th key={h} className="p-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supervisors?.data.map((h) => (
                  <tr key={h.id}>
                    <td className="p-4">{h.code}</td>
                    <td className="p-4 font-semibold">{h.fullName}</td>
                    <td className="p-4">{h.unitName}</td>
                    <td className="p-4">
                      {h.qualification || "Chưa nhập"}
                      <p className="text-xs text-slate-600">
                        {h.institution}
                        <br />
                        {h.email}
                      </p>
                    </td>
                    <td className="p-4">
                      {h.status === "ACTIVE"
                        ? "Đang phân công"
                        : "Ngừng phân công mới"}
                    </td>
                    <td className="p-4">
                      {canManage && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => toggleProfile(h)}
                        >
                          {h.status === "ACTIVE" ? "Ngừng phân công" : "Mở lại"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!supervisors?.data.length && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-600">
                      Chưa có hồ sơ GVHD. Cán bộ cần nhập hồ sơ thực tế trước
                      khi phân công.
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
        pager(
          tab === "topics" ? topics?.meta : supervisors?.meta,
          page,
          setPage,
        )}
      <Modal
        isOpen={!!detail && !editing && !action}
        onClose={() => {
          if (!busy) setDetail(null);
        }}
        title="Chi tiết đề tài và lịch sử xử lý"
        size="2xl"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <h2 className="text-lg font-semibold">{detail.title}</h2>
            <p>
              <strong>
                {detail.studentCode} — {detail.studentName}
              </strong>
              <br />
              {detail.programName} · {detail.majorName}
              <br />
              {detail.unitName}
            </p>
            <p>
              GVHD: <strong>{detail.supervisorName}</strong> (
              {detail.supervisorCode}) · {statuses[detail.status]}
            </p>
            <p className="whitespace-pre-wrap">
              {detail.description || "Chưa nhập mô tả."}
            </p>
            {detail.reviewNote && (
              <p>
                Kết quả xét duyệt: {detail.reviewNote}
                <br />
                Hồ sơ/quyết định: {detail.decisionReference || "—"}
              </p>
            )}
            {detail.completionNote && (
              <p>
                Nghiệm thu: {detail.completionNote}
                <br />
                Hồ sơ: {detail.completionReference}
              </p>
            )}
            {detail.cancellationReason && (
              <p>Lý do hủy: {detail.cancellationReason}</p>
            )}
            {detailError && (
              <p role="alert" className="text-red-700">
                {detailError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {detail.permissions.canManage &&
                ["CHO_DUYET", "TU_CHOI"].includes(detail.status) && (
                  <Button disabled={busy} onClick={() => begin(detail)}>
                    Sửa và gửi duyệt lại
                  </Button>
                )}
              {detail.permissions.canApprove &&
                detail.status === "CHO_DUYET" && (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => beginAction("duyet")}
                    >
                      Duyệt đề tài
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => beginAction("tu-choi")}
                    >
                      Trả lại
                    </Button>
                  </>
                )}
              {detail.permissions.canManage &&
                !["HOAN_THANH", "DA_HUY"].includes(detail.status) &&
                !detail.defenses.some((d) =>
                  ["CHO_BAO_VE", "DA_DAT"].includes(d.status),
                ) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => beginAction("huy")}
                  >
                    Hủy đề tài
                  </Button>
                )}
              {detail.permissions.canComplete &&
                detail.status === "DANG_THUC_HIEN" && (
                  <Button
                    disabled={
                      busy ||
                      !detail.defenses.some((d) => d.status === "DA_DAT")
                    }
                    onClick={() => beginAction("nghiem-thu")}
                  >
                    Xác nhận nghiệm thu
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
            {detail.status === "DANG_THUC_HIEN" && (
              <p className="text-slate-600">
                Lập lịch ở trang Bảo vệ luận văn. Chỉ nghiệm thu sau khi có kết
                quả bảo vệ đạt liên kết với đề tài này.
              </p>
            )}
            <h3 className="font-semibold">Các lần bảo vệ liên kết</h3>
            {detail.defenses.length ? (
              detail.defenses.map((d) => (
                <p key={d.id}>
                  #{d.id} · {d.defenseDate} · {d.status} · Điểm:{" "}
                  {d.score ?? "Chưa chấm"}
                </p>
              ))
            ) : (
              <p>Chưa có lịch bảo vệ liên kết.</p>
            )}
            <h3 className="font-semibold">Lịch sử từ CSDL</h3>
            {detail.history.map((h, i) => (
              <p key={i} className="border-t border-slate-100 py-2">
                {new Date(h.createdAt).toLocaleString("vi-VN")} · {h.actorName}{" "}
                · {h.action}
                {h.reason && (
                  <span className="block text-slate-700">{h.reason}</span>
                )}
              </p>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!editing}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        title={
          editing === "new"
            ? "Đăng ký đề tài và phân công GVHD"
            : "Sửa và gửi lại đề tài"
        }
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="topic-form"
              disabled={
                busy ||
                !student ||
                !supervisorId ||
                studentLoading ||
                supervisorLoading ||
                !!studentError ||
                !!supervisorError
              }
            >
              Lưu và gửi duyệt
            </Button>
          </>
        }
      >
        <form id="topic-form" onSubmit={save} className="space-y-4">
          {formError && (
            <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
              {formError}
            </p>
          )}
          {editing === "new" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Tìm học viên
                <input
                  aria-label="Tìm học viên"
                  className={ctl}
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  maxLength={255}
                />
              </label>
              {studentError && (
                <p role="alert" className="text-red-700">
                  {studentError}
                  <Button type="button" variant="outline" onClick={refresh}>
                    Thử lại
                  </Button>
                </p>
              )}
              <label className="block text-sm font-medium">
                Học viên và phân CTĐT
                <select
                  aria-label="Học viên và phân CTĐT"
                  className={ctl}
                  required
                  value={student?.assignmentId || ""}
                  disabled={busy || studentLoading || !!studentError}
                  onChange={(e) => {
                    setStudent(
                      students?.data.find(
                        (s) => s.assignmentId === e.target.value,
                      ) || null,
                    );
                    setSupervisorId("");
                    setOptions(null);
                    setSupervisorPage(1);
                  }}
                >
                  <option value="">
                    {studentLoading ? "Đang tải..." : "Chọn học viên từ CSDL"}
                  </option>
                  {student &&
                    !students?.data.some(
                      (s) => s.assignmentId === student.assignmentId,
                    ) && (
                      <option value={student.assignmentId}>
                        {student.studentCode} — {student.studentName}
                      </option>
                    )}
                  {students?.data.map((s) => (
                    <option key={s.assignmentId} value={s.assignmentId}>
                      {s.studentCode} — {s.studentName} — {s.programName}
                    </option>
                  ))}
                </select>
              </label>
              {!studentLoading && !students?.data.length && !studentError && (
                <p className="text-sm text-slate-600">
                  Không có học viên phù hợp: cần phân CTĐT SĐH đang hoạt động,
                  chưa có đề tài hiện hành hoặc lịch chờ/kết quả bảo vệ đạt.
                </p>
              )}
              {pager(students?.meta, studentPage, setStudentPage)}
            </div>
          )}
          {student && (
            <div className="rounded bg-slate-50 p-3 text-sm">
              <strong>
                {student.studentCode} — {student.studentName}
              </strong>
              <p>
                {student.programName}
                <br />
                {student.majorName} · {student.levelName}
                <br />
                {student.unitName}
              </p>
            </div>
          )}
          <label className="block text-sm font-medium">
            Tên đề tài
            <input
              aria-label="Tên đề tài"
              className={ctl}
              required
              maxLength={1000}
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Mô tả
            <textarea
              aria-label="Mô tả"
              className={ctl}
              rows={3}
              maxLength={15000}
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Tìm GVHD trong đơn vị quản lý CTĐT
            <input
              aria-label="Tìm GVHD"
              className={ctl}
              value={supervisorSearch}
              disabled={!student}
              onChange={(e) => {
                setSupervisorSearch(e.target.value);
                setSupervisorPage(1);
              }}
              maxLength={255}
            />
          </label>
          {supervisorError && (
            <p role="alert" className="text-red-700">
              {supervisorError}
              <Button type="button" variant="outline" onClick={refresh}>
                Thử lại
              </Button>
            </p>
          )}
          <label className="block text-sm font-medium">
            Giảng viên hướng dẫn
            <select
              aria-label="Giảng viên hướng dẫn"
              className={ctl}
              required
              value={supervisorId}
              disabled={
                !student || busy || supervisorLoading || !!supervisorError
              }
              onChange={(e) => setSupervisorId(e.target.value)}
            >
              <option value="">
                {supervisorLoading ? "Đang tải..." : "Chọn hồ sơ GVHD từ CSDL"}
              </option>
              {editing &&
                editing !== "new" &&
                supervisorId === editing.supervisorId &&
                !options?.data.some((h) => h.id === supervisorId) && (
                  <option value={supervisorId}>
                    {editing.supervisorName} — hồ sơ hiện tại, cần còn hoạt động
                  </option>
                )}
              {options?.data.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} — {h.fullName}
                  {h.qualification ? " · " + h.qualification : ""}
                </option>
              ))}
            </select>
          </label>
          {student &&
            !supervisorLoading &&
            !options?.data.length &&
            !supervisorError && (
              <p className="text-sm text-slate-600">
                Chưa có hồ sơ GVHD hoạt động thuộc đơn vị này. Hãy lưu hồ sơ
                thật bằng nút “Thêm hồ sơ GVHD” trước.
              </p>
            )}
          {student && pager(options?.meta, supervisorPage, setSupervisorPage)}
          <p className="text-sm text-slate-600">
            Họ tên, ngành và CTĐT lấy từ SQL, không nhập lại. Cán bộ cần kiểm
            tra hồ sơ chuyên môn thật; hệ thống chưa có quy định học hàm/hạn mức
            GVHD để tự đánh giá.
          </p>
        </form>
      </Modal>
      <Modal
        isOpen={profileOpen}
        onClose={() => {
          if (!busy) setProfileOpen(false);
        }}
        title="Thêm hồ sơ GVHD thực tế"
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setProfileOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form="supervisor-form"
              disabled={busy || !!unitsError}
            >
              Lưu hồ sơ GVHD
            </Button>
          </>
        }
      >
        <form id="supervisor-form" onSubmit={saveProfile} className="space-y-4">
          {(profileError || unitsError) && (
            <p role="alert" className="text-red-700">
              {profileError || unitsError}
            </p>
          )}
          <label className="block text-sm font-medium">
            Đơn vị quản lý hồ sơ
            <select
              aria-label="Đơn vị quản lý hồ sơ"
              className={ctl}
              required
              value={profile.unitId}
              disabled={busy}
              onChange={(e) =>
                setProfile({ ...profile, unitId: e.target.value })
              }
            >
              <option value="">Chọn đơn vị từ CSDL</option>
              {units
                .filter((u) => u.status === "ACTIVE")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          {(
            [
              "code",
              "fullName",
              "institution",
              "qualification",
              "email",
            ] as const
          ).map((key) => (
            <label key={key} className="block text-sm font-medium">
              {
                {
                  code: "Mã hồ sơ GVHD",
                  fullName: "Họ tên GVHD",
                  institution: "Cơ quan công tác",
                  qualification: "Học hàm / học vị theo hồ sơ",
                  email: "Email",
                }[key]
              }
              <input
                aria-label={key}
                className={ctl}
                type={key === "email" ? "email" : "text"}
                required={key === "code" || key === "fullName"}
                maxLength={key === "code" ? 50 : key === "email" ? 254 : 255}
                value={profile[key]}
                disabled={busy}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.value })
                }
              />
            </label>
          ))}
          <p className="text-sm text-slate-600">
            Nhập theo hồ sơ thật. Thông tin chuyên môn chưa có thì để trống. Hồ
            sơ GVHD không tự tạo tài khoản đăng nhập hoặc cấp quyền.
          </p>
        </form>
      </Modal>
      <Modal
        isOpen={!!action}
        onClose={() => {
          if (!busy) setAction(null);
        }}
        title={action ? actionNames[action] : "Xử lý đề tài"}
        footer={
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Đóng
            </Button>
            <Button type="submit" form="topic-action" disabled={busy}>
              Xác nhận
            </Button>
          </>
        }
      >
        <form id="topic-action" onSubmit={submitAction} className="space-y-4">
          <p className="font-medium">{detail?.title}</p>
          {actionError && (
            <p role="alert" className="text-red-700">
              {actionError}
            </p>
          )}
          {action && ["duyet", "nghiem-thu"].includes(action) && (
            <label className="block text-sm font-medium">
              Số/ký hiệu hồ sơ hoặc quyết định
              <input
                aria-label="Số hồ sơ"
                className={ctl}
                required
                maxLength={255}
                value={reference}
                disabled={busy}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Nội dung xác nhận / lý do
            <textarea
              aria-label="Nội dung xác nhận"
              className={ctl}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="text-sm text-slate-600">
            Thao tác lưu người thực hiện, thời điểm và nội dung vào lịch sử SQL.
          </p>
        </form>
      </Modal>
    </div>
  );
}
