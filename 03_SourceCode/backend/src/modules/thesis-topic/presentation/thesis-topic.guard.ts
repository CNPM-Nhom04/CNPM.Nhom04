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
import { TopicActor } from "../domain/thesis-topic";
export const TopicPermission = (permission: string) =>
  SetMetadata("topicPermission", permission);
export interface TopicRequest extends Request {
  user: { userId: string };
  topicActor: TopicActor;
}
@Injectable()
export class ThesisTopicGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector = new Reflector(),
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TopicRequest>();
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
    if (!permissions.includes("TOPIC_READ"))
      throw new ForbiddenException(
        "Bạn chưa được cấp quyền xem đề tài luận văn.",
      );
    const required = this.reflector.get<string>(
      "topicPermission",
      context.getHandler(),
    );
    if (required && !permissions.includes(required))
      throw new ForbiddenException("Bạn chưa được cấp quyền " + required + ".");
    request.topicActor = {
      id: String(request.user.userId),
      username: user.username,
      permissions,

      ip: request.ip || "",
    };
    return true;
  }
}
