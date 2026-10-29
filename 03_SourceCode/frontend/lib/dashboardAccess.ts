import type { SessionUser } from "./services/authService";

const routePermissions: Record<string, string> = {
  "/dashboard/admin/nguoi-dung": "USER_MANAGE",
  "/dashboard/admin/master-data": "MASTERDATA_MANAGE",
  "/dashboard/admin/cau-hinh": "SETTINGS_MANAGE",
  "/dashboard/admin/audit-log": "AUDIT_READ_ALL",
  "/dashboard/bao-cao": "PROGRAM_READ",
  "/dashboard/danh-muc-hoc-phan": "CATALOG_READ",
  "/dashboard/chuong-trinh-dao-tao": "PROGRAM_READ",
  "/dashboard/xet-duyet": "PROGRAM_APPROVE",
  "/dashboard/so-sanh": "PROGRAM_COMPARE",
  "/dashboard/de-tai-luan-van": "STUDENT_MANAGE",
  "/dashboard/bao-ve-luan-van": "DEFENSE_READ",
  "/dashboard/dang-ky-hoc-phan": "REGISTRATION_MANAGE",
  "/dashboard/sinh-vien/dang-ky": "COURSE_REGISTER",
  "/dashboard/quan-ly-diem": "STUDENT_MANAGE",
  "/dashboard/xet-tot-nghiep": "STUDENT_MANAGE",
};

// Menu visibility and direct navigation follow the same SQL-backed profile.
// NestJS guards remain responsible for authorizing every business API request.
export function canAccessDashboard(user: SessionUser | null, pathname: string) {
  if (!user) return false;
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
