import type { SessionUser } from "./services/authService";
export const OWN_PROGRAM_PATH = "/ctdt-cua-toi";
export function canUseDashboard(user: Pick<SessionUser, "roles"> | null) {
  return (
    !!user &&
    user.roles.some((role) =>
      ["ADMIN", "TRAINING_OFFICER", "APPROVER", "LECTURER"].includes(role),
    )
  );
}
export function canReadOwnProgram(
  user: Pick<SessionUser, "roles" | "permissions"> | null,
) {
  return (
    !!user &&
    user.roles.includes("STUDENT") &&
    user.permissions.includes("PROGRAM_READ_OWN")
  );
}
