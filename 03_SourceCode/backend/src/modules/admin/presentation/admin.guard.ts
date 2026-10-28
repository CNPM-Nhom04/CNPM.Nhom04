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
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const [user] = await this.dataSource.query(
      `SELECT u.username, u.account_status, u.deleted_at,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.role_code = 'ADMIN' AND r.status = 'ACTIVE') AS isAdmin
      FROM users u WHERE u.id = ?`,
      [request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE") {
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    }
    if (!Number(user.isAdmin))
      throw new ForbiddenException("Chức năng chỉ dành cho quản trị viên.");
    request.user.username = user.username;
    return true;
  }
}
