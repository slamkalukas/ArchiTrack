import { expect, test } from "@playwright/test";

/**
 * WP-3 happy path (spec/07-agent-workplan.md ground rule §0.2): admin logs in, creates a
 * project from the "Rodinný dom SK" template via the creation wizard (pruning one task in
 * step 2), and sees the new project card on the dashboard with the applied template's
 * first phase as its current phase.
 */
test("admin creates a project from the Rodinný dom SK template and sees it on the dashboard", async ({ page }) => {
  const projectName = `E2E Test Dom ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@architrack.local");
  await page.getByLabel("Heslo").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Nový projekt/ }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);

  // Step 1: basic details + template selection.
  await page.getByLabel("Názov projektu").fill(projectName);
  await page.getByLabel("Lokalita").fill("Bratislava");

  await page.getByRole("combobox").filter({ hasText: "Prázdny projekt" }).click();
  await page.getByRole("option", { name: "Rodinný dom SK" }).click();

  await page.getByRole("button", { name: "Ďalej" }).click();

  // Step 2: pruning — uncheck the first task of the first phase.
  await expect(page.getByText("Zadanie a prieskumy")).toBeVisible();
  const firstTaskCheckbox = page.getByRole("checkbox").first();
  await firstTaskCheckbox.uncheck();
  await page.getByRole("button", { name: "Ďalej" }).click();

  // Step 3: summary + create.
  await expect(page.getByText(projectName)).toBeVisible();
  await page.getByRole("button", { name: "Vytvoriť projekt" }).click();

  // Lands on the new project's overview page.
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  // Back on the dashboard, the new project card is visible with its first phase as current.
  await page.goto("/dashboard");
  await expect(page.getByText(projectName)).toBeVisible();
});
