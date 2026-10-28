import { cookies } from "next/headers";
import { AUTH_COOKIE, backendUrl } from "./backend";
import type { SessionUser } from "@/lib/services/authService";
export async function getSession(): Promise<{
  user: SessionUser | null;
  status: number;
}> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return { user: null, status: 401 };
  try {
    const response = await fetch(backendUrl("/auth/profile"), {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return {
      user: response.ok ? await response.json() : null,
      status: response.status,
    };
  } catch {
    return { user: null, status: 502 };
  }
}
