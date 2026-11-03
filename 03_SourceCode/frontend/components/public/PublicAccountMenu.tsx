"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, UserCircle, LogOut } from "lucide-react";
import { authRequest, type SessionUser } from "@/lib/services/authService";
import {
  canReadOwnProgram,
  canUseDashboard,
  OWN_PROGRAM_PATH,
} from "@/lib/accountAccess";
const primary =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-[#087b62] px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-900 sm:px-4 sm:text-sm";
export function PublicAccountMenu({ user }: { user: SessionUser | null }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await authRequest("logout", {});
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đăng xuất.");
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <Link href="/dang-nhap" className={primary}>
        Đăng nhập <ArrowUpRight size={16} />
      </Link>
    );
  const staff = canUseDashboard(user),
    own = canReadOwnProgram(user);
  return (
    <div className="flex items-center gap-2">
      {staff ? (
        <Link href="/dashboard" className={primary}>
          Dashboard <ArrowUpRight size={16} />
        </Link>
      ) : own ? (
        <Link href={OWN_PROGRAM_PATH} className={primary}>
          CTĐT của tôi <ArrowUpRight size={16} />
        </Link>
      ) : null}
      <details className="relative">
        <summary
          aria-label="Tài khoản đang đăng nhập"
          className="flex cursor-pointer list-none items-center rounded p-1 text-emerald-800"
        >
          <UserCircle size={28} />
        </summary>
        <div className="absolute right-0 top-full z-40 mt-3 w-64 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-lg">
          <p className="break-words font-semibold">
            {user.fullName || user.username}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500">
            {user.username} · {user.roleNames.join(", ")}
          </p>
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
            {own && (
              <Link
                href={OWN_PROGRAM_PATH}
                className="block rounded px-2 py-2 text-emerald-800 hover:bg-emerald-50"
              >
                CTĐT của tôi
              </Link>
            )}
            {staff && (
              <Link
                href="/dashboard"
                className="block rounded px-2 py-2 hover:bg-slate-50"
              >
                Vào dashboard
              </Link>
            )}
            <Link
              href="/doi-mat-khau"
              className="block rounded px-2 py-2 hover:bg-slate-50"
            >
              Đổi mật khẩu
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={logout}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut size={16} />
              {busy ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-xs leading-5 text-red-700">
              {error}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
