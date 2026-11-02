"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { SessionUser } from "@/lib/services/authService";
import { OWN_PROGRAM_PATH } from "@/lib/accountAccess";
import {
  getMyProgram,
  StudentProgramError,
  type OwnProgramResult,
} from "@/lib/services/studentProgramService";
const control =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-500";
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
const studentStates: Record<string, string> = {
  ACTIVE: "Đang học",
  INACTIVE: "Ngừng hoạt động",
  GRADUATED: "Đã tốt nghiệp",
  SUSPENDED: "Tạm dừng",
  DROPPED: "Thôi học",
};
export function StudentProgramContent({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [data, setData] = useState<OwnProgramResult | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const [search, setSearch] = useState(""),
    [groupId, setGroupId] = useState("ALL"),
    [requirement, setRequirement] = useState("ALL");
  useEffect(() => {
    const abort = new AbortController();
    getMyProgram(abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        setData(result);
        setSearch("");
        setGroupId("ALL");
        setRequirement("ALL");
        setError("");
        setLoading(false);
      })
      .catch((e) => {
        if (abort.signal.aborted) return;
        setData(null);
        setLoading(false);
        setError(
          e instanceof Error ? e.message : "Không thể tải CTĐT cá nhân.",
        );
        if (e instanceof StudentProgramError && e.status === 401) {
          router.replace(
            "/dang-nhap?next=" + encodeURIComponent(OWN_PROGRAM_PATH),
          );
          router.refresh();
        }
      });
    return () => abort.abort();
  }, [version, router]);
  const student = data?.student,
    plan = data?.curriculum;
  const rows = useMemo(() => {
    const keyword = normalize(search.trim());
    return (
      plan?.courses.filter(
        (c) =>
          (groupId === "ALL" || c.groupId === groupId) &&
          (requirement === "ALL" || c.requirementType === requirement) &&
          (!keyword || normalize(c.code + " " + c.name).includes(keyword)),
      ) || []
    );
  }, [plan, search, groupId, requirement]);
  const credit = (value: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
  function reload() {
    setLoading(true);
    setError("");
    setVersion((v) => v + 1);
  }
  return (
    <div className="space-y-6 pb-16 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="flex items-center gap-3 text-xl font-bold">
            <GraduationCap className="text-emerald-600" />
            Chương trình đào tạo của tôi
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Tra cứu chương trình, phiên bản và hướng được phân công cho tài
            khoản đang đăng nhập.
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={reload}>
          <RefreshCw size={16} className="mr-2" />
          Tải lại
        </Button>
      </header>
      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Đang tải CTĐT được phân công...
        </p>
      ) : error ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          <p>{error}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Button variant="outline" onClick={reload}>
              Thử lại
            </Button>
            <Link href="/" className="self-center underline">
              Về trang chủ
            </Link>
          </div>
        </section>
      ) : (
        data && (
          <>
            <section
              aria-label="Hồ sơ học viên"
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h2 className="mb-5 flex items-center gap-2 font-bold">
                <UserRound size={20} className="text-emerald-600" />
                Hồ sơ học viên
              </h2>
              <dl className="grid gap-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Tài khoản đăng nhập</dt>
                  <dd className="mt-2 font-semibold">{user?.username}</dd>
                </div>
                {student && (
                  <>
                    <div>
                      <dt className="text-slate-500">Mã học viên / Họ tên</dt>
                      <dd className="mt-2 font-semibold">
                        {student.studentCode} — {student.fullName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Đơn vị học viên</dt>
                      <dd className="mt-2 font-semibold">
                        {student.unitName || "Chưa gắn đơn vị"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">
                        Năm nhập học / Trạng thái
                      </dt>
                      <dd className="mt-2 font-semibold">
                        {student.admissionYear} ·{" "}
                        {studentStates[student.status] || student.status}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
            {data.state !== "READY" || !plan ? (
              <section
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 p-6"
              >
                <h2 className="font-bold text-amber-900">
                  {data.state === "UNLINKED"
                    ? "Chưa liên kết hồ sơ học viên"
                    : data.state === "UNASSIGNED"
                      ? "Chưa có phân công CTĐT"
                      : "CTĐT chưa sẵn sàng để tra cứu"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-amber-900">
                  {data.message}
                </p>
              </section>
            ) : (
              <>
                <section
                  aria-label="CTĐT được phân công"
                  className="rounded-xl border border-emerald-200 bg-white p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                        {plan.programCode} · {plan.versionCode}
                      </p>
                      <h2 className="mt-3 text-xl font-bold leading-8">
                        {plan.programName}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {plan.levelName} · Ngành {plan.majorName}
                      </p>
                    </div>
                    <span
                      className={
                        "rounded-full px-3 py-1 text-xs font-semibold " +
                        (plan.versionStatus === "ARCHIVED"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-emerald-50 text-emerald-800")
                      }
                    >
                      {plan.versionStatus === "ARCHIVED"
                        ? "Phiên bản đã lưu trữ"
                        : "Phiên bản đã ban hành"}
                    </span>
                  </div>
                  <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Hướng được phân công", plan.trackName],
                      ["Khóa áp dụng", String(plan.cohortYear)],
                      ["Đơn vị quản lý CTĐT", plan.unitName],
                      ["Ngày phân công", plan.assignedAt],
                      [
                        "Số quyết định",
                        plan.decisionNumber || "Chưa có thông tin",
                      ],
                      [
                        "Ngày ban hành",
                        plan.decisionDate || "Chưa có thông tin",
                      ],
                    ].map(([name, value]) => (
                      <div key={name}>
                        <dt className="text-slate-500">{name}</dt>
                        <dd className="mt-2 font-semibold leading-6">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
                    Đây là đúng phiên bản và hướng trong phân công đang hoạt
                    động của bạn. Phiên bản đã lưu trữ vẫn được giữ theo phân
                    công; hệ thống không tự chuyển sang CTĐT mới nhất.
                  </p>
                  {plan.trackStatus !== "ACTIVE" && (
                    <p className="mt-3 text-sm text-amber-800">
                      Hướng hiện đã ngừng hoạt động. Thông tin phân công cũ vẫn
                      được giữ để tra cứu.
                    </p>
                  )}
                </section>
                <section
                  aria-label="Định mức và danh sách"
                  className="grid gap-4 sm:grid-cols-3"
                >
                  {[
                    [
                      "Định mức của hướng",
                      credit(plan.requiredCredits) + " TC",
                    ],
                    ["Số học phần trong khung", String(plan.courses.length)],
                    [
                      "Tổng TC danh sách",
                      credit(
                        plan.courses.reduce((sum, c) => sum + c.credits, 0),
                      ) + " TC",
                    ],
                  ].map(([name, value]) => (
                    <div
                      className="rounded-xl border border-slate-200 bg-white p-5"
                      key={name}
                    >
                      <p className="text-sm text-slate-500">{name}</p>
                      <p className="mt-3 text-2xl font-bold text-emerald-700">
                        {value}
                      </p>
                    </div>
                  ))}
                </section>
                <p className="text-sm leading-7 text-slate-600">
                  Tổng tín chỉ danh sách bao gồm tất cả lựa chọn tự chọn nên có
                  thể lớn hơn định mức của hướng. Đây là khung chương trình,
                  không phải số tín chỉ bạn đã tích lũy.
                </p>
                <section className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="mb-5 flex items-center gap-2 font-bold">
                    <BookOpen size={20} className="text-emerald-600" />
                    Nhóm kiến thức
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {plan.groups.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <h3 className="text-sm font-semibold leading-6">
                          {g.code} — {g.name}
                        </h3>
                        <p className="mt-3 text-xs leading-6 text-slate-600">
                          Tối thiểu: {credit(g.minimumCredits)} TC
                          <br />
                          Tối đa:{" "}
                          {g.maximumCredits == null
                            ? "Chưa quy định"
                            : credit(g.maximumCredits) + " TC"}
                        </p>
                        {g.parentId && (
                          <p className="mt-2 text-xs text-slate-500">
                            Nhóm cha:{" "}
                            {plan.groups.find(
                              (parent) => parent.id === g.parentId,
                            )?.code || "Chưa có thông tin"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {!plan.groups.length && (
                    <p className="text-sm text-slate-500">
                      Khung được phân công chưa có nhóm kiến thức.
                    </p>
                  )}
                </section>
                <section className="space-y-4">
                  <h2 className="text-lg font-bold">
                    Học phần trong hướng được phân công
                  </h2>
                  <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <label className="flex min-w-56 flex-1 items-center gap-2">
                      <Search size={18} className="text-slate-400" />
                      <input
                        aria-label="Tìm học phần trong CTĐT cá nhân"
                        className={control}
                        maxLength={255}
                        placeholder="Tìm mã hoặc tên học phần..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Lọc nhóm kiến thức"
                      className={control + " md:w-64"}
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      <option value="ALL">Tất cả nhóm kiến thức</option>
                      {plan.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Lọc tính chất học phần"
                      className={control + " md:w-48"}
                      value={requirement}
                      onChange={(e) => setRequirement(e.target.value)}
                    >
                      <option value="ALL">Tất cả tính chất</option>
                      <option value="REQUIRED">Bắt buộc</option>
                      <option value="ELECTIVE">Tự chọn</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {[
                            "Mã / Tên học phần",
                            "TC",
                            "Nhóm",
                            "Tính chất",
                            "Học kỳ",
                            "Tiên quyết",
                          ].map((h) => (
                            <th className="p-4" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((c) => (
                          <tr key={c.id} className="border-t border-slate-100">
                            <td className="p-4">
                              <strong className="text-emerald-700">
                                {c.code}
                              </strong>
                              <p className="mt-1 leading-6">{c.name}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                Phiên bản {c.versionNo} · LT {c.theoryHours} /
                                TH {c.practiceHours} tiết
                              </p>
                              {c.notes && (
                                <p className="mt-2 text-xs text-slate-500">
                                  {c.notes}
                                </p>
                              )}
                            </td>
                            <td className="p-4 font-semibold">
                              {credit(c.credits)}
                            </td>
                            <td className="p-4">
                              {plan.groups.find((g) => g.id === c.groupId)
                                ?.code || "—"}
                            </td>
                            <td className="p-4">
                              <span
                                className={
                                  "rounded-full px-2 py-1 text-xs font-semibold " +
                                  (c.requirementType === "REQUIRED"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-amber-50 text-amber-800")
                                }
                              >
                                {c.requirementType === "REQUIRED"
                                  ? "Bắt buộc"
                                  : "Tự chọn"}
                              </span>
                            </td>
                            <td className="p-4">{c.semester ?? "Chưa xếp"}</td>
                            <td className="max-w-xs p-4">
                              {c.prerequisites.length ? (
                                <ul className="space-y-2">
                                  {c.prerequisites.map((p) => (
                                    <li
                                      key={p.courseEntryId}
                                      className="text-xs leading-6"
                                    >
                                      <strong>{p.code}</strong> — {p.name} (v
                                      {p.versionNo})
                                      {p.minimumGrade != null && (
                                        <span className="block text-slate-500">
                                          Điểm tối thiểu: {p.minimumGrade}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                "Không có tiên quyết được lưu"
                              )}
                            </td>
                          </tr>
                        ))}
                        {!rows.length && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-8 text-center text-slate-500"
                            >
                              Không có học phần phù hợp.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-slate-500">
                    Hiển thị {rows.length} / {plan.courses.length} học phần
                    trong {plan.trackName}.
                  </p>
                </section>
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
