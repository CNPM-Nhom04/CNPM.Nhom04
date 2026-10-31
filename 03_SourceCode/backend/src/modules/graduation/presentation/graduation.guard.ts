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
import { GraduationActor } from "../domain/graduation";
export const GraduationPermission = (permission: string) =>
  SetMetadata("graduationPermission", permission);
export interface GraduationRequest extends Request {
  user: { userId: string };
  graduationActor: GraduationActor;
}
@Injectable()
export class GraduationGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<GraduationRequest>();
    const [u] = await this.db.query(
      `SELECT u.username,u.account_status,u.deleted_at,
   (SELECT GROUP_CONCAT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.status='ACTIVE'
    JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id) permissions
   FROM users u WHERE u.id=?`,
      [req.user?.userId || "0"],
    );
    if (!u || u.deleted_at || u.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const permissions = (u.permissions || "").split(","),
      required = this.reflector.get<string>(
        "graduationPermission",
        context.getHandler(),
      );
    if (
      !permissions.includes("GRADUATION_READ") ||
      (required && !permissions.includes(required))
    )
      throw new ForbiddenException(
        "Tài khoản chưa được cấp quyền xét tốt nghiệp tương ứng.",
      );
    req.graduationActor = {
      id: String(req.user.userId),
      username: u.username,
      permissions,
      ip: req.ip || "",
    };
    return true;
  }
}
