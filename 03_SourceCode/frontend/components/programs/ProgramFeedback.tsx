"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ProgramApiError } from "@/lib/services/programService";
export function ProgramFeedback({
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
      className={`whitespace-pre-line rounded-lg border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
    >
      <p>{error?.message || message}</p>
      {error instanceof ProgramApiError && [401, 403].includes(error.status) ? (
        <Link
          className="mt-2 inline-block font-semibold underline"
          href="/dang-nhap?next=/dashboard/chuong-trinh-dao-tao"
        >
          Đăng nhập tài khoản được phân quyền
        </Link>
      ) : error && retry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
