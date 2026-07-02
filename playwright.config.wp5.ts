import { defineConfig, devices } from "@playwright/test";

/**
 * WP-5 (Files & folders) e2e config — runs the dev server on PORT 3005 against the
 * wp5-files worktree's own dev DB (docker-compose -p architrack-wp5), so it never
 * collides with the shared `playwright.config.ts` (port 3100) used by other WPs
 * (spec/07-agent-workplan.md ground rule §0.2, orchestrator instructions).
 *
 * Usage: `pnpm exec playwright test --config=playwright.config.wp5.ts`
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /wp5-.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3005",
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
        command: "pnpm exec next dev -p 3005",
        url: "http://localhost:3005",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
