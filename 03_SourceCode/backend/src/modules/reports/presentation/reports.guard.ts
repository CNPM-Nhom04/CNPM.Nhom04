import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { DataSource } from "typeorm";
@Injectable()
export class ReportsGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const [permission] = await this.db.query(
      "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? AND r.status='ACTIVE' AND p.permission_code='PROGRAM_READ' LIMIT 1",
      [request.user?.userId || "0"],
    );
    if (!permission)
      throw new ForbiddenException(
        "Bạn chưa được cấp quyền xem báo cáo chương trình đào tạo.",
      );
    return true;
  }
}
 
