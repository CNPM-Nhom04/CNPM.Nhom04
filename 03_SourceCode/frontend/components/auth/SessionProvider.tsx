"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      {children}
    </SessionContext.Provider>
  );
}
