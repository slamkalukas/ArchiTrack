import { defineConfig, devices } from "@playwright/test";

/**
 * WP-6-specific Playwright config (spec/07-agent-workplan.md ground rule §0.2: ship one
 * happy-path e2e test per WP). Kept separate from `playwright.config.ts` (WP-2's, default
 * port 3100) per WP-6 instructions: "Any dev server / Playwright runs: use PORT 3006...
 * add your own config file". Runs only `tests/e2e/chat.spec.ts`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /chat\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006",
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
        command: "pnpm exec next dev -p 3006",
        url: "http://localhost:3006",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
