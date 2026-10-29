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
import { ProgramActor } from "../domain/program";
export const ProgramPermission = (permission: string) =>
  SetMetadata("programPermission", permission);
export interface ProgramRequest extends Request {
  user: { userId: string };
  programActor: ProgramActor;
}
@Injectable()
export class ProgramGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ProgramRequest>();
    const [user] = await this.db.query(
      `SELECT u.username, u.account_status, u.deleted_at,
      EXISTS(SELECT 1 FROM user_scopes us WHERE us.user_id=u.id
        AND us.scope_type IN ('GLOBAL','ORG_UNIT','MAJOR')) AS canCreateProgram,
      (SELECT GROUP_CONCAT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
       JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
       WHERE ur.user_id=u.id AND r.status='ACTIVE') AS permissionCodes FROM users u WHERE u.id=?`,
      [request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const permissions = (user.permissionCodes || "").split(",");
    const required =
      this.reflector.get<string>("programPermission", context.getHandler()) ||
      "PROGRAM_READ";
    if (!permissions.includes(required))
      throw new ForbiddenException(
        "Tài khoản chưa được cấp quyền " + required + ".",
      );
    request.programActor = {
      id: String(request.user.userId),
      username: user.username,
      permissions,
      canCreateProgram: !!Number(user.canCreateProgram),
      ip: request.ip || "",
    };
    return true;
  }
}
