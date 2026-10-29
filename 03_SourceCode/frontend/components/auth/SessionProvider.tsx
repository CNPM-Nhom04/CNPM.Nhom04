"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { canAccessDashboard } from "@/lib/dashboardAccess";
import {
  authRequest,
  AuthApiError,
  type SessionUser,
} from "@/lib/services/authService";
const SessionContext = createContext<SessionUser | null>(null);
export function useSessionUser() {
  return useContext(SessionContext);
}
export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState(user);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    authRequest<SessionUser>("profile")
      .then((next) => {
        if (!active) return;
        setCurrent(next);
        if (next.mustChangePassword) router.replace("/doi-mat-khau");
      })
      .catch((reason) => {
        if (active && reason instanceof AuthApiError && reason.status === 401) {
          router.replace("/dang-nhap?next=" + encodeURIComponent(pathname));
          router.refresh();
        }
      });
    return () => {
      active = false;
    };
  }, [pathname, user, router]);
  return (
    <SessionContext.Provider value={current}>
      {canAccessDashboard(current, pathname) ? (
        children
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900"
        >
          <p className="font-semibold">
            Bạn không có quyền truy cập trang này.
          </p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block text-blue-700 underline"
          >
            Về bảng điều khiển
          </Link>
        </div>
      )}
    </SessionContext.Provider>
  );
}
 
