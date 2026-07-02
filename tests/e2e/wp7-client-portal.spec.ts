import { expect, test } from "@playwright/test";

/**
 * WP-7 happy path (spec/07-agent-workplan.md ground rule §0.2, the "wave-4 wife-approval
 * demo" milestone): the demo client logs in, lands directly in the client portal (not the
 * admin dashboard), sees the Prehľad hero with the progress ring and current phase, opens
 * Postup and sees the phase list, opens Dokumenty and sees the client-scoped file view,
 * and opens Správy and sees the chat thread + composer.
 */
const CLIENT_EMAIL = "klient@architrack.local";
const CLIENT_PASSWORD = "DemoClient123!";

test("demo client logs in, tours Prehľad/Postup/Dokumenty/Správy", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await page.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();

  // Client lands in the portal home, not the admin dashboard.
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "RD Novákovci — Pezinok" })).toBeVisible();

  // Progress ring + current phase are visible on the Prehľad hero.
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText("Práve prebieha")).toBeVisible();

  // Postup tab: phase list renders (vertical cards, not kanban).
  await page.getByRole("link", { name: "Postup" }).click();
  await expect(page).toHaveURL(/\/portal\/progress$/);
  await expect(page.getByRole("heading", { name: "Postup" })).toBeVisible();
  await expect(page.getByText("Zadanie a prieskumy")).toBeVisible();

  // Dokumenty tab: client-scoped file view (folder tree + table), reusing WP-5's FilesView.
  await page.getByRole("link", { name: "Dokumenty" }).click();
  await expect(page).toHaveURL(/\/portal\/documents$/);
  await expect(page.getByRole("heading", { name: "Súbory" })).toBeVisible();

  // Správy tab: chat thread + composer, reusing WP-6's ChatPanel.
  await page.getByRole("link", { name: "Správy" }).click();
  await expect(page).toHaveURL(/\/portal\/messages$/);
  await expect(page.getByPlaceholder("Napíšte správu…")).toBeVisible();
});
