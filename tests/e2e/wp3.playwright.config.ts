import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * WP-3 Playwright config — runs its own happy path against PORT 3003 and this worktree's
 * dedicated dev DB (spec/07-agent-workplan.md ground rule §0.2), without touching the
 * shared `playwright.config.ts` (which other WPs' default port-3000 setup depends on).
 */
export default defineConfig({
  testDir: "./",
  testMatch: "wp3-*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3003",
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
        command: "pnpm exec next dev -p 3003",
        cwd: path.resolve(__dirname, "../.."),
        url: "http://localhost:3003",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
