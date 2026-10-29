"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import { authRequest } from "@/lib/services/authService";
import { useSessionUser } from "@/components/auth/SessionProvider";
export default function Header() {
  const user = useSessionUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await authRequest("logout", {});
      router.replace("/dang-nhap");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đăng xuất.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <header className="min-h-16 bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-base font-semibold text-slate-800">
          Hệ thống Quản lý Đào tạo Sau Đại học
        </h1>
        <p className="text-xs text-slate-500">
          Phân hệ Số hóa & Quản lý Chương trình đào tạo
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-800">
            {user?.fullName || user?.username}
          </div>
          <div className="text-xs text-slate-500">
            {user?.roleNames.join(", ") || "Chưa được cấp vai trò"}
            {user?.orgUnitName ? " · " + user.orgUnitName : ""}
          </div>
          <Link
            href="/doi-mat-khau"
            className="text-xs text-blue-600 underline"
          >
            Đổi mật khẩu
          </Link>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
        <UserCircle className="h-8 w-8 text-blue-600" />
        <button
          title="Đăng xuất"
          aria-label="Đăng xuất"
          onClick={logout}
          disabled={busy}
          className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
 
