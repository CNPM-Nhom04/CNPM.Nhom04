import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = any>(
    error,
    user,
    info,
    context: ExecutionContext,
  ): TUser {
    const account = super.handleRequest<TUser>(error, user, info, context);
    const path = context.switchToHttp().getRequest().path.replace(/\/+$/, "");
    if (
      user?.mustChangePassword &&
      !["/auth/profile", "/auth/change-password", "/auth/logout"].includes(path)
    ) {
      throw new ForbiddenException(
        "Bạn cần đổi mật khẩu trước khi sử dụng chức năng này.",
      );
    }
    return account;
  }
}
