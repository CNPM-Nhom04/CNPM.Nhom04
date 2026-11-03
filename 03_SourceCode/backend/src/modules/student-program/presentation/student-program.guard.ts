import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { Request } from "express";
export interface StudentProgramRequest extends Request {
  user: { userId: string };
}
@Injectable()
export class StudentProgramGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<StudentProgramRequest>();
    if (!req.user?.userId)
      throw new UnauthorizedException("Vui lòng đăng nhập.");
    const [user] = await this.db.query(
      `SELECT u.account_status,u.deleted_at,
   EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND r.role_code='STUDENT') isStudent,
   EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id AND r.status='ACTIVE' AND p.permission_code='PROGRAM_READ_OWN') canRead
   FROM users u WHERE u.id=?`,
      [req.user.userId],
    );
    if (!user || user.account_status !== "ACTIVE" || user.deleted_at)
      throw new UnauthorizedException("Tài khoản không còn hoạt động.");
    if (!Number(user.isStudent) || !Number(user.canRead))
      throw new ForbiddenException(
        "Chức năng yêu cầu tài khoản học viên có quyền PROGRAM_READ_OWN.",
      );
    return true;
  }
}
