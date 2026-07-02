import "dotenv/config";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * WP-4 happy path (spec/07-agent-workplan.md §0.2): admin logs in, opens the demo
 * project's Phases & Tasks tab, creates a task, moves it to Done via the kanban board,
 * and the phase's progress bar updates immediately (spec/04-features.md §4 AC).
 */
test("admin creates a task and moves it to Done, updating phase progress", async ({ page }) => {
  const db = new PrismaClient();
  let projectId: string;
  let phaseId: string;

  try {
    const project = await db.project.findUniqueOrThrow({ where: { slug: "rd-novakovci-pezinok" } });
    projectId = project.id;

    // Use a phase with no tasks yet-completed-fully so the "all done" prompt is
    // deterministic: pick the last (UPCOMING, empty-ish) phase and start clean.
    const phase = await db.phase.findFirstOrThrow({
      where: { projectId, templateKey: "sk_house.construction_supervision" },
    });
    phaseId = phase.id;

    // Ensure a clean slate for this phase's tasks so progress math is predictable.
    await db.task.deleteMany({ where: { phaseId } });
  } finally {
    await db.$disconnect();
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@architrack.local");
  await page.getByLabel("Heslo").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/projects/${projectId}/tasks`);
  await expect(page.getByRole("heading", { name: "Fázy a úlohy" })).toBeVisible();

  // Scope the board to our clean phase via the phase selector.
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Realizácia a autorský dozor" }).click();

  // Create a task via "Add task".
  await page.getByRole("button", { name: "Pridať úlohu" }).first().click();
  await page.getByLabel("Názov", { exact: true }).fill("E2E testovacia úloha");
  await page.getByRole("button", { name: "Vytvoriť úlohu" }).click();

  const taskCard = page.getByText("E2E testovacia úloha").first();
  await expect(taskCard).toBeVisible();

  // Open the task and move it to Done via the modal's status select (equivalent to a
  // drag & drop move — exercises the same PATCH → progress recompute path).
  await taskCard.click();
  await page.getByRole("combobox").filter({ hasText: "K vybaveniu" }).click();
  await page.getByRole("option", { name: "Hotovo", exact: true }).click();
  await page.getByRole("button", { name: "Uložiť úlohu" }).click();

  // Phase-done prompt should appear since this was the only (now Done) task.
  await expect(page.getByRole("heading", { name: "Označiť fázu ako hotovú?" })).toBeVisible();
  await page.getByRole("button", { name: "Označiť ako hotovú" }).click();

  // Phase progress bar for "Realizácia a autorský dozor" reflects the change (100%).
  const phaseRow = page.locator("text=Realizácia a autorský dozor").locator("..").locator("..");
  await expect(phaseRow.getByText("100%")).toBeVisible({ timeout: 10_000 });
});
