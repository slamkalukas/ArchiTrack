import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * WP-8 build item 1d (spec/07-agent-workplan.md WP-8): admin creates a task, moves it to
 * Done via the kanban board, the phase's progress updates — and the demo client, looking
 * at the same phase from the portal's Postup tab, sees the same updated percentage
 * (progress is computed from the *full* task set even for CLIENT, per
 * src/features/tasks/server/phases.ts — only the task list itself is visibility-filtered).
 */
const ADMIN_EMAIL = "admin@architrack.local";
const ADMIN_PASSWORD = "ChangeMe123!";
const CLIENT_EMAIL = "klient@architrack.local";
const CLIENT_PASSWORD = "DemoClient123!";
const PHASE_NAME = "Realizácia a autorský dozor";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

test("admin moves a task to Done; client's Postup tab shows the updated phase progress", async ({ browser }) => {
  const project = await db.project.findUniqueOrThrow({ where: { slug: "rd-novakovci-pezinok" } });
  const projectId = project.id;

  const phase = await db.phase.findFirstOrThrow({
    where: { projectId, templateKey: "sk_house.construction_supervision" },
  });
  const phaseId = phase.id;

  // Clean slate so the resulting percentage is deterministic for both admin and client.
  await db.task.deleteMany({ where: { phaseId } });

  // --- Admin: create + complete a task on the kanban board ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await adminPage.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  await adminPage.goto(`/projects/${projectId}/tasks`);
  await expect(adminPage.getByRole("heading", { name: "Fázy a úlohy" })).toBeVisible();

  await adminPage.getByRole("combobox").first().click();
  await adminPage.getByRole("option", { name: PHASE_NAME }).click();

  await adminPage.getByRole("button", { name: "Pridať úlohu" }).first().click();
  await adminPage.getByLabel("Názov", { exact: true }).fill("E2E kanban→portal progress task");
  await adminPage.getByRole("button", { name: "Vytvoriť úlohu" }).click();

  const taskCard = adminPage.getByText("E2E kanban→portal progress task").first();
  await expect(taskCard).toBeVisible();

  await taskCard.click();
  await adminPage.getByRole("combobox").filter({ hasText: "K vybaveniu" }).click();
  await adminPage.getByRole("option", { name: "Hotovo", exact: true }).click();
  await adminPage.getByRole("button", { name: "Uložiť úlohu" }).click();

  await expect(adminPage.getByRole("heading", { name: "Označiť fázu ako hotovú?" })).toBeVisible();
  await adminPage.getByRole("button", { name: "Označiť ako hotovú" }).click();

  const phaseRow = adminPage.locator(`text=${PHASE_NAME}`).locator("..").locator("..");
  await expect(phaseRow.getByText("100%")).toBeVisible({ timeout: 10_000 });

  await adminContext.close();

  // --- Client: Postup tab shows the same 100% for this phase ---
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();

  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await clientPage.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(clientPage).toHaveURL(/\/portal$/);

  await clientPage.goto("/portal/progress");
  await expect(clientPage.getByRole("heading", { name: "Postup" })).toBeVisible();

  // Locate the phase card by its accessible progressbar name (set via
  // common.progressLabel, e.g. "Priebeh: 100 %") rather than DOM-structure traversal
  // from the heading — more robust to the card's internal layout.
  await expect(
    clientPage.getByRole("progressbar", { name: /Priebeh:\s*100\s*%/ }),
  ).toBeVisible({ timeout: 10_000 });

  // The new task itself is internal by default — it must NOT leak into the client's
  // phase task list (spec/03-data-model.md §3.2 task-visibility rule).
  await expect(clientPage.getByText("E2E kanban→portal progress task")).not.toBeVisible();

  await clientContext.close();
});
