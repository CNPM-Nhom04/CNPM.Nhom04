import type { SessionUser } from "./services/authService";
import {
  OWN_PROGRAM_PATH,
  canReadOwnProgram,
  canUseDashboard,
} from "./accountAccess";
import { canAccessDashboard } from "./dashboardAccess";
export function loginDestination(
  user: SessionUser,
  next: string | null,
  origin: string,
) {
  if (user.mustChangePassword) return "/doi-mat-khau";
  const fallback = canUseDashboard(user)
    ? user.roles.includes("ADMIN") &&
      canAccessDashboard(user, "/dashboard/admin/nguoi-dung")
      ? "/dashboard/admin/nguoi-dung"
      : "/dashboard"
    : "/";
  if (!next) return fallback;
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin || target.username || target.password)
      return fallback;
    const path = target.pathname;
    if (path === "/dashboard/sinh-vien/chuong-trinh-dao-tao")
      return canReadOwnProgram(user) ? OWN_PROGRAM_PATH : fallback;
    if (
      ["/dashboard/dang-ky-hoc-phan", "/dashboard/sinh-vien/dang-ky"].some(
        (removed) => path === removed || path.startsWith(removed + "/"),
      )
    )
      return fallback;
    const publicPage =
      [
        "/",
        "/quy-che",
        "/chuong-trinh-dao-tao",
        "/dang-ky-thong-tin",
        "/doi-mat-khau",
      ].includes(path) || /^\/chuong-trinh-dao-tao\/[1-9]\d{0,19}$/.test(path);
    if (
      publicPage ||
      (path === OWN_PROGRAM_PATH && canReadOwnProgram(user)) ||
      ((path === "/dashboard" || path.startsWith("/dashboard/")) &&
        canAccessDashboard(user, path))
    )
      return path + target.search;
  } catch {
    /* Invalid return URLs use the authorized landing page. */
  }
  return fallback;
}
