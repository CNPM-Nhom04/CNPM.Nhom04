import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE, backendUrl } from "./backend";
export async function readPublic<T>(path: string): Promise<T | null> {
  try {
    const token = path.startsWith("chuong-trinh-dao-tao")
      ? (await cookies()).get(AUTH_COOKIE)?.value
      : undefined;
    const response = await fetch(backendUrl("/public/" + path), {
      cache: "no-store",
      headers: token ? { Authorization: "Bearer " + token } : {},
      signal: AbortSignal.timeout(10000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
