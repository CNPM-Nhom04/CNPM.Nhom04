import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { Request } from "express";
export interface ComparisonRequest extends Request {
  user: { userId: string };
}
export const ComparisonExportPermission = () =>
  SetMetadata("comparisonExport", true);
@Injectable()
export class ComparisonGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector = new Reflector(),
  ) {}
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
    if (this.reflector.get<boolean>("comparisonExport", context.getHandler())) {
      const [permission] = await this.db.query(
        "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE' AND p.permission_code='PROGRAM_EXPORT' LIMIT 1",
        [req.user.userId],
      );
      if (!permission)
        throw new ForbiddenException(
          "Bạn chưa được cấp quyền PROGRAM_EXPORT để xuất so sánh.",
        );
    }
    return true;
  }
}
