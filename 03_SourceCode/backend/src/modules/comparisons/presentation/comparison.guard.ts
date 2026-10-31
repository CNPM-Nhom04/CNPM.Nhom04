import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Request } from "express";
export interface ComparisonRequest extends Request {
  user: { userId: string };
}
@Injectable()
export class ComparisonGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<ComparisonRequest>();
    const [user] = await this.db.query(
      `SELECT u.account_status,u.deleted_at,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE'
      JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=u.id AND p.permission_code='PROGRAM_COMPARE') allowed
      FROM users u WHERE u.id=?`,
      [req.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException();
    if (!Number(user.allowed))
      throw new ForbiddenException(
        "Tài khoản chưa được cấp quyền PROGRAM_COMPARE.",
      );
    return true;
  }
}
