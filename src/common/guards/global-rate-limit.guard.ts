import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitStoreService } from './rate-limit-store.service';

interface HttpRequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitStore: RateLimitStoreService
  ) {
    this.maxRequests = this.parsePositiveInteger(
      this.configService.get<string>('GLOBAL_RATE_LIMIT_MAX'),
      120
    );
    this.windowMs = this.parsePositiveInteger(
      this.configService.get<string>('GLOBAL_RATE_LIMIT_WINDOW_MS'),
      60000
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const clientId = this.extractClientId(request);
    const result = this.rateLimitStore.consume(
      `global:${clientId}`,
      this.maxRequests,
      this.windowMs
    );

    if (!result.allowed) {
      throw new HttpException('Too many requests. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private extractClientId(request: HttpRequestLike): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      const first = forwardedFor.split(',')[0]?.trim();
      if (first) {
        return first;
      }
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      const first = forwardedFor[0]?.trim();
      if (first) {
        return first;
      }
    }

    return request.ip ?? request.socket?.remoteAddress ?? 'unknown-client';
  }

  private parsePositiveInteger(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
