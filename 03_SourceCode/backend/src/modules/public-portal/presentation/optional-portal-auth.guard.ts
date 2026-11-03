import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
@Injectable()
export class OptionalPortalAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    // A supplied invalid/expired credential must fail rather than widening to guest mode.
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
  handleRequest<TUser = any>(
    error,
    user,
    info,
    context: ExecutionContext,
  ): TUser {
    const account = super.handleRequest<TUser>(error, user, info, context);
    if (user?.mustChangePassword)
      throw new ForbiddenException(
        "Bạn cần đổi mật khẩu trước khi xem chương trình theo khoa của tài khoản.",
      );
    return account;
  }
}
