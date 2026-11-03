import { canUseDashboard } from "./accountAccess";
import type { SessionUser } from "./services/authService";

const routePermissions: Record<string, string> = {
  "/dashboard/admin/lop-hoc-vien": "STUDENT_ACCOUNT_IMPORT",
  "/dashboard/admin/nguoi-dung": "USER_MANAGE",
  "/dashboard/admin/master-data": "MASTERDATA_MANAGE",
  "/dashboard/admin/cong-thong-tin": "MASTERDATA_MANAGE",
  "/dashboard/admin/khoa": "MASTERDATA_MANAGE",
  "/dashboard/admin/nganh-dao-tao": "MASTERDATA_MANAGE",
  "/dashboard/admin/cau-hinh": "SETTINGS_MANAGE",
  "/dashboard/admin/audit-log": "AUDIT_READ_ALL",
  "/dashboard/bao-cao": "PROGRAM_READ",
  "/dashboard/danh-muc-hoc-phan": "CATALOG_READ",
  "/dashboard/chuong-trinh-dao-tao": "PROGRAM_READ",
  "/dashboard/xet-duyet": "PROGRAM_APPROVE",
  "/dashboard/so-sanh": "PROGRAM_COMPARE",
  "/dashboard/de-tai-luan-van": "TOPIC_READ",
  "/dashboard/bao-ve-luan-van": "DEFENSE_READ",
  "/dashboard/quan-ly-diem": "GRADE_READ",
  "/dashboard/xet-tot-nghiep": "GRADUATION_READ",
};

// Menu visibility and direct navigation follow the same SQL-backed profile.
// NestJS guards remain responsible for authorizing every business API request.
export function canAccessDashboard(user: SessionUser | null, pathname: string) {
  if (!user || !canUseDashboard(user)) return false;
  if (
    [
      "/dashboard/dang-ky-hoc-phan",
      "/dashboard/sinh-vien/dang-ky",
      "/dashboard/sinh-vien/chuong-trinh-dao-tao",
    ].some(
      (removed) => pathname === removed || pathname.startsWith(removed + "/"),
    )
  )
    return false;
  if (
    pathname.startsWith("/dashboard/admin/lop-hoc-vien") &&
    !["USER_MANAGE", "ROLE_SCOPE_MANAGE", "STUDENT_ACCOUNT_IMPORT"].every(
      (permission) => user.permissions.includes(permission),
    )
  )
    return false;
  if (pathname.startsWith("/dashboard/admin") && !user.roles.includes("ADMIN"))
    return false;
  if (pathname === "/dashboard/chuong-trinh-dao-tao/tao-moi")
    return user.permissions.includes("PROGRAM_EDIT");
  if (/^\/dashboard\/chuong-trinh-dao-tao\/[^/]+\/xet-duyet$/.test(pathname))
    return user.permissions.includes("PROGRAM_APPROVE");
  const route = Object.keys(routePermissions).find(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );
  return !route || user.permissions.includes(routePermissions[route]);
}
