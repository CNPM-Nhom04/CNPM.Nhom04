import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Request } from "express";
import { DefenseActor } from "../domain/thesis-defense";
export interface DefenseRequest extends Request {
  user: { userId: string };
  defenseActor: DefenseActor;
}
@Injectable()
export class ThesisDefenseGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DefenseRequest>();
    const [user] = await this.db.query(
      `SELECT u.username, u.account_status, u.deleted_at,
      (SELECT GROUP_CONCAT(r.role_code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.status = 'ACTIVE') AS roleCodes
      FROM users u WHERE u.id = ?`,
      [request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const roles = (user.roleCodes || "").split(",");
    const isAdmin = roles.includes("ADMIN");
    const canSchedule = isAdmin || roles.includes("TRAINING_OFFICER");
    const canRecord = canSchedule || roles.includes("APPROVER");
    if (!canRecord)
      throw new ForbiddenException(
        "Chức năng dành cho cán bộ đào tạo và hội đồng xét duyệt.",
      );
    request.defenseActor = {
      id: String(request.user.userId),
      username: user.username,
      isAdmin,
      canSchedule,
      canRecord,
      ip: request.ip || "",
    };
    return true;
  }
}
