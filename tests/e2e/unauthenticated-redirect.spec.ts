import { expect, test } from "@playwright/test";

/**
 * Unauthenticated page requests must land on /login (via the proxy middleware), never
 * on a 500 from an uncaught AuthzError in a server component. API routes are excluded —
 * they keep JSON 401/404 semantics (covered by the leak-probe spec).
 */
test.describe("unauthenticated visitors are redirected to login", () => {
  for (const path of ["/dashboard", "/inbox", "/settings", "/portal", "/portal/documents"]) {
    test(`GET ${path} → /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("API stays JSON 401", async ({ request }) => {
    const res = await request.get("/api/notifications");
    expect(res.status()).toBe(401);
  });
});
