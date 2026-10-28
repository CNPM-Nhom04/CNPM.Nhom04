import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Request } from "express";
export interface AdminRequest extends Request {
  user: { userId: string; username: string };
  adminPermission?: string;
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const resource = request.path?.split("/")[2] || "nguoi-dung";
    const permission = {
      "nguoi-dung": "USER_MANAGE",
      "master-data": "MASTERDATA_MANAGE",
      "cau-hinh": "SETTINGS_MANAGE",
      "audit-log": "AUDIT_READ_ALL",
    }[resource];
    const [user] = await this.dataSource.query(
      `SELECT u.username,u.account_status,u.deleted_at,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.role_code='ADMIN' AND r.status='ACTIVE') AS isAdmin,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code=?) AS hasPermission
      FROM users u WHERE u.id=?`,
      [permission || "", request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    if (!Number(user.isAdmin) || !Number(user.hasPermission))
      throw new ForbiddenException(
        "Tài khoản chưa có quyền quản trị chức năng này.",
      );
    request.user.username = user.username;
    request.adminPermission = permission;
    return true;
  }
}
