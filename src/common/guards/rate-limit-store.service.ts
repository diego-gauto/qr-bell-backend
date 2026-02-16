import { Injectable } from '@nestjs/common';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface ConsumeResult {
  allowed: boolean;
}

@Injectable()
export class RateLimitStoreService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(key: string, maxRequests: number, windowMs: number): ConsumeResult {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      this.cleanup(now);
      return { allowed: true };
    }

    if (existing.count >= maxRequests) {
      this.cleanup(now);
      return { allowed: false };
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    this.cleanup(now);

    return { allowed: true };
  }

  private cleanup(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
