import { expect, test } from "@playwright/test";

/**
 * WP-2 happy path: the login screen renders (split-screen brand panel + form) and the
 * seed admin can sign in and land on the admin shell. Spec/07-agent-workplan.md ground
 * rule §0.2 — one Playwright happy path per work package.
 */
test("login screen renders and signs in the seed admin", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Prihlásenie" })).toBeVisible();

  await page.getByLabel("E-mail").fill("admin@architrack.local");
  await page.getByLabel("Heslo").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Projekty" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Architect Admin/ })).toBeVisible();
});
