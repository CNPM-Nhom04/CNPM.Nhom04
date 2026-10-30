import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DataSource } from "typeorm";
import { Request } from "express";
import { DefenseActor } from "../domain/thesis-defense";
export const DefensePermission = (permission: string) =>
  SetMetadata("defensePermission", permission);
export interface DefenseRequest extends Request {
  user: { userId: string };
  defenseActor: DefenseActor;
}
@Injectable()
export class ThesisDefenseGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector = new Reflector(),
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DefenseRequest>();
    const [user] = await this.db.query(
      `SELECT u.username,u.account_status,u.deleted_at,
      (SELECT GROUP_CONCAT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
       JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
       WHERE ur.user_id=u.id AND r.status='ACTIVE') permissionCodes FROM users u WHERE u.id=?`,
      [request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const permissions = (user.permissionCodes || "").split(",");
    if (!permissions.includes("DEFENSE_READ"))
      throw new ForbiddenException(
        "Bạn chưa được cấp quyền xem bảo vệ luận văn.",
      );
    const required = this.reflector.get<string>(
      "defensePermission",
      context.getHandler(),
    );
    if (required && !permissions.includes(required))
      throw new ForbiddenException("Bạn chưa được cấp quyền " + required + ".");
    request.defenseActor = {
      id: String(request.user.userId),
      username: user.username,
      permissions,
      canSchedule: permissions.includes("DEFENSE_SCHEDULE"),
      canRecord: permissions.includes("DEFENSE_RESULT"),
      ip: request.ip || "",
    };
    return true;
  }
}
