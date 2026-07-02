import "server-only";

/**
 * In-memory token-bucket rate limiter (spec/02-architecture.md §4.5, spec/05-api.md §9.4).
 * Fine for this scale (single app container, no Redis needed). Buckets are keyed by
 * caller-supplied string (typically `ip` or `ip:route`) and refill continuously at
 * `tokensPerInterval / intervalMs`.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  /** Max tokens the bucket can hold — i.e. the burst limit. */
  capacity: number;
  /** How many tokens are added per `intervalMs`. */
  refillAmount: number;
  intervalMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** ms until at least one token is available again (0 when ok). */
  retryAfterMs: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = options;
  }

  /** Consume one token for `key`. Returns whether the request is allowed. */
  consume(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.options.capacity, lastRefill: now };

    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed / this.options.intervalMs) * this.options.refillAmount;
    bucket.tokens = Math.min(this.options.capacity, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    this.buckets.set(key, bucket);
    const tokensNeeded = 1 - bucket.tokens;
    const msPerToken = this.options.intervalMs / this.options.refillAmount;
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.ceil(tokensNeeded * msPerToken),
    };
  }

  /** Periodic cleanup to avoid unbounded growth from one-off callers (e.g. bots). */
  sweep(maxIdleMs: number): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > maxIdleMs) {
        this.buckets.delete(key);
      }
    }
  }
}

const globalForRateLimit = globalThis as unknown as {
  authRateLimiter: TokenBucketRateLimiter | undefined;
  uploadRateLimiter: TokenBucketRateLimiter | undefined;
  chatRateLimiter: TokenBucketRateLimiter | undefined;
};

/** Auth endpoints: 5 requests/min/IP (spec/05-api.md §9.4). */
export const authRateLimiter =
  globalForRateLimit.authRateLimiter ??
  new TokenBucketRateLimiter({ capacity: 5, refillAmount: 5, intervalMs: 60_000 });

/** Uploads: 60 requests/h/user. */
export const uploadRateLimiter =
  globalForRateLimit.uploadRateLimiter ??
  new TokenBucketRateLimiter({ capacity: 60, refillAmount: 60, intervalMs: 3_600_000 });

/** Chat: 30 messages/min/user. */
export const chatRateLimiter =
  globalForRateLimit.chatRateLimiter ??
  new TokenBucketRateLimiter({ capacity: 30, refillAmount: 30, intervalMs: 60_000 });

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.authRateLimiter = authRateLimiter;
  globalForRateLimit.uploadRateLimiter = uploadRateLimiter;
  globalForRateLimit.chatRateLimiter = chatRateLimiter;
}

/** Extract a best-effort client IP from a Next.js Request for rate-limit keys. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
