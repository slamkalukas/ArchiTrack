import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — spec/07-agent-workplan.md ground rule §0.2 (ship one happy-path
 * e2e test per WP). WP-8 owns `tests/e2e/**` long-term and will extend this config with
 * the full suite; this is the minimal bootstrap WP-2 needs to ship its login happy path.
 *
 * Requires the dev DB (docker-compose.dev.yml) to be running and migrated/seeded —
 * see spec/02-architecture.md §3. The dev server is started automatically below.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Single worker everywhere: the suite runs against ONE dev server, and with parallel
  // workers another spec's first-visit route compile triggers hot reloads that remount
  // components mid-interaction (observed: the project wizard losing its form state).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // The suite logs in more than 5×/min from one IP; see src/lib/rate-limit.ts.
          AUTH_RATE_LIMIT_PER_MINUTE: "100",
          APP_URL: "http://localhost:3100",
        },
      },
});
