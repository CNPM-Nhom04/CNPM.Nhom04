"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Search,
  GraduationCap,
  Award,
  ArrowRight,
  Building2,
  BookOpen,
} from "lucide-react";
import {
  portalRequest,
  type PublicPage,
  type PublicProgram,
  type PublicCatalogView,
} from "@/lib/services/portalService";

function DegreePrograms({
  code,
  title,
  search,
  onView,
}: {
  code: "MASTER" | "DOCTOR";
  title: string;
  search: string;
  onView: (view: PublicCatalogView) => void;
}) {
  const [page, setPage] = useState(1),
    [data, setData] = useState<PublicPage<PublicProgram> | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      portalRequest<PublicPage<PublicProgram>>(
        "chuong-trinh-dao-tao?" +
          new URLSearchParams({
            levelCode: code,
            search,
            page: String(page),
            limit: "8",
          }),
        { signal: abort.signal },
      )
        .then((result) => {
          if (abort.signal.aborted) return;
          setData(result);
          setBusy(false);
          setError("");
          if (result.view) onView(result.view);
          if (page > 1 && page > result.meta.totalPages)
            setPage(Math.max(1, result.meta.totalPages));
        })
        .catch((reason) => {
          if (!abort.signal.aborted) {
            setData(null);
            setBusy(false);
            setError(
              reason instanceof Error
                ? reason.message
                : "Không tải được danh sách chương trình.",
            );
          }
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [code, search, page, reload, onView]);
  const Icon = code === "MASTER" ? GraduationCap : Award;
  return (
    <section
      id={code === "MASTER" ? "thac-si" : "tien-si"}
      aria-label={"Chương trình đào tạo " + title}
      className="scroll-mt-6 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 bg-[#f2f6ef] px-5 py-6 sm:px-7">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#087b62] text-white">
            <Icon size={27} />
          </span>
          <div>
            <p className="text-[11px] font-bold tracking-[.15em] text-emerald-700">
              CHƯƠNG TRÌNH ĐÀO TẠO
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[#113f36]">{title}</h2>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800">
          {busy
            ? "Đang tải..."
            : error
              ? "Chưa tải được dữ liệu"
              : `${data?.meta.total || 0} phiên bản đã ban hành`}
        </span>
      </header>
      {error ? (
        <div
          role="alert"
          className="m-5 rounded border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-800"
        >
          <p>{error}</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <button
              className="font-semibold underline"
              onClick={() => {
                setBusy(true);
                setReload((n) => n + 1);
              }}
            >
              Thử lại
            </button>
            <Link
              className="underline"
              href="/dang-nhap?next=/chuong-trinh-dao-tao"
            >
              Đăng nhập lại
            </Link>
            <Link className="underline" href="/doi-mat-khau">
              Đổi mật khẩu
            </Link>
          </div>
        </div>
      ) : busy ? (
        <p role="status" className="p-10 text-center text-sm text-slate-500">
          Đang tải chương trình {title.toLowerCase()}...
        </p>
      ) : data?.data.length ? (
        <ol className="divide-y divide-slate-100">
          {data.data.map((program, index) => (
            <li
              key={program.id}
              className="group grid gap-4 px-5 py-6 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[auto_1fr_auto] sm:px-7"
            >
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                {String((page - 1) * 8 + index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold tracking-wide text-emerald-700">
                  {program.code} · {program.versionCode}
                </p>
                <h3 className="text-lg font-bold leading-7 text-slate-900">
                  <Link
                    className="hover:text-emerald-700"
                    href={"/chuong-trinh-dao-tao/" + program.id}
                  >
                    {program.name}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Ngành: {program.majorName}
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-500">
                  <Building2 size={15} className="mt-1 shrink-0" />
                  {program.unitName}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>Khóa {program.cohortYear}</span>
                  {program.duration && (
                    <span>Thời gian: {program.duration}</span>
                  )}
                  {program.decisionNumber && (
                    <span>Quyết định: {program.decisionNumber}</span>
                  )}
                </div>
              </div>
              <Link
                aria-label={"Xem chương trình " + program.name}
                href={"/chuong-trinh-dao-tao/" + program.id}
                className="inline-flex items-center gap-2 self-center justify-self-start rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-700 hover:text-white"
              >
                Xem chương trình <ArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-start gap-3 px-5 py-9 text-sm leading-7 text-slate-500 sm:px-7">
          <BookOpen size={20} className="mt-1 shrink-0" />
          <p>
            {data?.view?.mode === "UNASSIGNED"
              ? "Tài khoản chưa được gắn khoa; chưa thể xác định danh sách chương trình theo khoa."
              : `Chưa có chương trình ${title.toLowerCase()} đã ban hành phù hợp${data?.view?.mode === "FACULTY" ? " trong khoa của bạn" : ""}.`}
          </p>
        </div>
      )}
      {data && !error && data.meta.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm">
          <span className="text-slate-500">
            Trang {page}/{data.meta.totalPages} · Tổng {data.meta.total} phiên
            bản
          </span>
          <div className="flex gap-3">
            <button
              className="rounded border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
              disabled={busy || page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setBusy(true);
              }}
            >
              Trang trước {title.toLowerCase()}
            </button>
            <button
              className="rounded border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
              disabled={busy || page >= data.meta.totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                setBusy(true);
              }}
            >
              Trang sau {title.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
export function PublicPrograms() {
  const [search, setSearch] = useState(""),
    [view, setView] = useState<PublicCatalogView | null>(null);
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Chọn bậc tra cứu" className="flex flex-wrap gap-3">
          <a
            href="#thac-si"
            className="rounded-lg bg-[#087b62] px-5 py-3 text-sm font-semibold text-white"
          >
            Đào tạo Thạc sĩ
          </a>
          <a
            href="#tien-si"
            className="rounded-lg border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-800"
          >
            Đào tạo Tiến sĩ
          </a>
        </nav>
        <label className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 sm:max-w-md">
          <Search size={20} className="shrink-0 text-slate-400" />
          <input
            aria-label="Tìm chương trình đào tạo"
            className="w-full bg-white py-2 text-sm text-slate-950 outline-none"
            placeholder="Tìm mã CTĐT, tên chương trình hoặc ngành..."
            maxLength={255}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div
        role="status"
        className="rounded-lg border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-900"
      >
        {view?.mode === "FACULTY" ? (
          <>
            <strong>Chương trình của {view.facultyName}</strong>
            <p>
              Danh sách được lọc theo khoa của tài khoản trong CSDL, gồm các
              phiên bản đã ban hành.
            </p>
          </>
        ) : view?.mode === "UNASSIGNED" ? (
          <>
            <strong>Tài khoản chưa được gắn khoa.</strong>
            <p>
              Liên hệ Admin để liên kết đơn vị hoặc hồ sơ học viên đúng người.
            </p>
          </>
        ) : view?.mode === "ADMIN_ALL" ? (
          "Tài khoản quản trị không gắn khoa: đang xem CTĐT đã ban hành của tất cả khoa."
        ) : (
          "Tra cứu công khai: hiển thị đầy đủ CTĐT đã ban hành ở hai bậc Thạc sĩ và Tiến sĩ. Khi đăng nhập, danh sách hiển thị theo khoa của tài khoản."
        )}
      </div>
      <DegreePrograms
        key={"MASTER:" + search}
        code="MASTER"
        title="Thạc sĩ"
        search={search}
        onView={setView}
      />
      <DegreePrograms
        key={"DOCTOR:" + search}
        code="DOCTOR"
        title="Tiến sĩ"
        search={search}
        onView={setView}
      />
    </div>
  );
}
