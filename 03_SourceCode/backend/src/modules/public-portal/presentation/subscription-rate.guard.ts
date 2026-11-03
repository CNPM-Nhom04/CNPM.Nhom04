import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from "@nestjs/common";
@Injectable()
export class SubscriptionRateGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; expires: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest(),
      key = request.ip || "unknown",
      now = Date.now();
    for (const [ip, item] of this.hits)
      if (item.expires <= now) this.hits.delete(ip);
    const item = this.hits.get(key) || { count: 0, expires: now + 60000 };
    if (item.count >= 30 || (!this.hits.has(key) && this.hits.size >= 10000))
      throw new HttpException(
        "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau một phút.",
        429,
      );
    item.count++;
    this.hits.set(key, item);
    return true;
  }
}
