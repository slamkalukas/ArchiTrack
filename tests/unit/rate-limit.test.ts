import { describe, expect, it, vi } from "vitest";
import { TokenBucketRateLimiter } from "@/lib/rate-limit";

/**
 * WP-8 build item 2 (spec/07-agent-workplan.md WP-8, spec/05-api.md §9.4): direct
 * unit coverage of the token-bucket algorithm underlying every rate limit in the app
 * (auth 5/min/IP, uploads 60/h/user, chat 30/min/user). The e2e suite additionally
 * exercises the real `/api/auth/forgot-password` endpoint end-to-end for the 429
 * behavior (tests/e2e/wp8-rate-limit.spec.ts) — this test isolates the algorithm so the
 * boundary/refill math is verified without depending on wall-clock timing in a browser.
 */
describe("TokenBucketRateLimiter", () => {
  it("allows up to `capacity` requests, then rejects with ok:false", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5, refillAmount: 5, intervalMs: 60_000 });

    for (let i = 0; i < 5; i++) {
      expect(limiter.consume("ip-1")).toMatchObject({ ok: true });
    }

    const sixth = limiter.consume("ip-1");
    expect(sixth.ok).toBe(false);
    expect(sixth.remaining).toBe(0);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it("keys buckets independently per caller (one IP hitting the limit doesn't affect another)", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillAmount: 2, intervalMs: 60_000 });

    expect(limiter.consume("ip-a").ok).toBe(true);
    expect(limiter.consume("ip-a").ok).toBe(true);
    expect(limiter.consume("ip-a").ok).toBe(false);

    // A different key still has its full bucket.
    expect(limiter.consume("ip-b").ok).toBe(true);
  });

  it("refills tokens over time proportionally to elapsed ms", () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({ capacity: 5, refillAmount: 5, intervalMs: 60_000 });

      for (let i = 0; i < 5; i++) limiter.consume("ip-1");
      expect(limiter.consume("ip-1").ok).toBe(false);

      // Half the interval passes — refillAmount/2 = 2.5 tokens should be back.
      vi.advanceTimersByTime(30_000);
      expect(limiter.consume("ip-1")).toMatchObject({ ok: true });
      expect(limiter.consume("ip-1")).toMatchObject({ ok: true });
      expect(limiter.consume("ip-1").ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sweep() evicts buckets idle longer than maxIdleMs", () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({ capacity: 1, refillAmount: 1, intervalMs: 60_000 });
      limiter.consume("stale-ip");
      expect(limiter.consume("stale-ip").ok).toBe(false);

      vi.advanceTimersByTime(120_000);
      limiter.sweep(60_000);

      // Bucket was evicted and recreated fresh — full capacity again.
      expect(limiter.consume("stale-ip").ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
