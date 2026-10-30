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
import { CourseActor } from "../domain/course";
export const ManageCourses = () => SetMetadata("manageCourses", true);
export interface CourseRequest extends Request {
  user: { userId: string };
  courseActor: CourseActor;
}
@Injectable()
export class CourseGuard implements CanActivate {
  constructor(
    private readonly db: DataSource,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<CourseRequest>();
    const [user] = await this.db.query(
      `SELECT u.username,u.account_status,u.deleted_at,
      (SELECT GROUP_CONCAT(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
      JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
      WHERE ur.user_id=u.id AND r.status='ACTIVE') permissionCodes
      FROM users u WHERE u.id=?`,
      [request.user?.userId || "0"],
    );
    if (!user || user.deleted_at || user.account_status !== "ACTIVE")
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    const permissions = String(user.permissionCodes || "").split(",");
    const canManage = permissions.includes("CATALOG_MANAGE");
    if (
      !permissions.includes("CATALOG_READ") ||
      (this.reflector.get<boolean>("manageCourses", context.getHandler()) &&
        !canManage)
    )
      throw new ForbiddenException(
        "Không có quyền xem hoặc quản lý danh mục học phần.",
      );
    request.courseActor = {
      id: String(request.user.userId),
      username: user.username,
      canManage,
      ip: request.ip || "",
    };
    return true;
  }
}
