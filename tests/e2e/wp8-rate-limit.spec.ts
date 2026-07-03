import { expect, test } from "@playwright/test";

/**
 * WP-8 build item 2 (spec/07-agent-workplan.md WP-8, spec/05-api.md §9.4): end-to-end
 * verification that an auth endpoint actually returns 429 once its per-IP bucket is
 * exhausted, against the real running server (not a mock) — complementing the isolated
 * token-bucket algorithm unit test at tests/unit/rate-limit.test.ts.
 *
 * The shared e2e server runs with AUTH_RATE_LIMIT_PER_MINUTE=100 (see playwright.config.ts)
 * so the rest of the suite's real logins — which all share one client IP — don't 429
 * each other. To still exercise the 429 path without exhausting that shared bucket (which
 * would break every other spec's ability to log in for the next minute), this test spoofs
 * a unique `x-forwarded-for` value per run: src/lib/rate-limit.ts's `getClientIp()` keys
 * strictly off that header, so a fake, unique-per-run IP gets its own independent bucket
 * — isolated from the shared one used by real browser logins in this same suite.
 */
test("POST /api/auth/forgot-password returns 429 once the per-IP limit is exhausted", async ({ request }) => {
  const fakeIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const limit = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE) || 100;

  let sawRateLimited = false;
  let lastStatus = 0;

  // One extra request beyond the bucket's capacity to guarantee we cross the threshold.
  for (let i = 0; i < limit + 5; i++) {
    const res = await request.post("/api/auth/forgot-password", {
      headers: { "x-forwarded-for": fakeIp, "content-type": "application/json" },
      data: { email: "nobody@example.com" },
    });
    lastStatus = res.status();
    if (lastStatus === 429) {
      sawRateLimited = true;
      const body = await res.json();
      expect(body.error.code).toBe("rate_limited");
      break;
    }
    expect(lastStatus).toBe(200);
  }

  expect(sawRateLimited, `expected a 429 within ${limit + 5} requests, last status was ${lastStatus}`).toBe(true);
});
