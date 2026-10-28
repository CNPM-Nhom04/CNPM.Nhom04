"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AdminApiError, type PageMeta } from "@/lib/services/adminService";

export function AdminFeedback({
  error,
  message,
  retry,
}: {
  error?: Error | null;
  message?: string;
  retry?: () => void;
}) {
  if (!error && !message) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-lg border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
    >
      <p>{error?.message || message}</p>
      {error instanceof AdminApiError && error.status === 401 ? (
        <Link
          href={`/dang-nhap?next=${encodeURIComponent(window.location.pathname)}`}
          className="mt-2 inline-block underline font-semibold"
        >
          Đăng nhập tài khoản quản trị
        </Link>
      ) : error && retry ? (
        <Button variant="outline" size="sm" onClick={retry} className="mt-2">
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
export function AdminPagination({
  meta,
  page,
  loading,
  changePage,
}: {
  meta?: PageMeta;
  page: number;
  loading: boolean;
  changePage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        {loading ? "Đang tải dữ liệu..." : `Tổng ${meta?.total ?? 0} kết quả`}
      </span>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => changePage(page - 1)}
        >
          Trang trước
        </Button>
        <span>
          Trang {meta?.totalPages ? page : 0} / {meta?.totalPages ?? 0}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || page >= (meta?.totalPages ?? 0)}
          onClick={() => changePage(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}
