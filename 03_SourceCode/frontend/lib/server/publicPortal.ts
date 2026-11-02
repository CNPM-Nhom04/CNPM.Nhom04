import "server-only";
import { backendUrl } from "./backend";
export async function readPublic<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(backendUrl("/public/" + path), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
