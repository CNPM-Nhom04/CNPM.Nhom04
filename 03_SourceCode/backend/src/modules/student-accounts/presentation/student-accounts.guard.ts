import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Request } from "express";
import { ACCOUNT_IMPORT_PERMISSIONS } from "../domain/student-accounts";
export interface StudentAccountsRequest extends Request {
  user: { userId: string; username: string };
}
@Injectable()
export class StudentAccountsGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<StudentAccountsRequest>();
    if (!req.user?.userId)
      throw new UnauthorizedException("Vui lòng đăng nhập.");
    const [user] = await this.db.query(
      `SELECT u.account_status,u.deleted_at,EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_code='ADMIN' AND r.status='ACTIVE') isAdmin,(SELECT COUNT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code IN (?,?,?)) permissionCount FROM users u WHERE u.id=?`,
      [...ACCOUNT_IMPORT_PERMISSIONS, req.user.userId],
    );
    if (!user || user.account_status !== "ACTIVE" || user.deleted_at)
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    if (!Number(user.isAdmin) || Number(user.permissionCount) !== 3)
      throw new ForbiddenException(
        "Cần Admin với USER_MANAGE, ROLE_SCOPE_MANAGE và STUDENT_ACCOUNT_IMPORT.",
      );
    return true;
  }
}
