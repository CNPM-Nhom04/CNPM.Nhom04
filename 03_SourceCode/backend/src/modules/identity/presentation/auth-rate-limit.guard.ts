import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from "@nestjs/common";
import { createHash } from "crypto";
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!/\/(login|forgot-password|reset-password)\/?$/.test(req.path))
      return true;
    const now = Date.now();
    if (this.buckets.size > 5000) {
      for (const [key, bucket] of this.buckets)
        if (bucket.until <= now) this.buckets.delete(key);
      if (this.buckets.size > 5000)
        throw new HttpException(
          "Có quá nhiều yêu cầu. Vui lòng thử lại sau.",
          429,
        );
    }
    const take = (key: string, limit: number, duration: number) => {
      let bucket = this.buckets.get(key);
      if (!bucket || bucket.until <= now) {
        bucket = { count: 0, until: now + duration };
        this.buckets.set(key, bucket);
      }
      if (++bucket.count > limit) {
        context
          .switchToHttp()
          .getResponse()
          .setHeader("Retry-After", Math.ceil((bucket.until - now) / 1000));
        throw new HttpException(
          "Có quá nhiều yêu cầu. Vui lòng thử lại sau.",
          429,
        );
      }
    };
    const ip = req.ip || "unknown";
    const identity = String(
      req.body?.identifier || req.body?.email || req.body?.token || "",
    )
      .trim()
      .toLowerCase();
    const hash = createHash("sha256").update(identity).digest("hex");
    take(ip + ":" + req.path, 120, 60000);
    take(
      ip + ":" + req.path + ":" + hash,
      req.path.endsWith("login") ? 20 : 5,
      15 * 60000,
    );
    return true;
  }
}
 
