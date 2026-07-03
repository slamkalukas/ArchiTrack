import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Clients can leave comments / change requests on client-visible tasks from the Postup
 * tab, and the architect sees and answers them in the admin task modal
 * (spec/04-features.md §7 — comments on tasks; server notifies the other party).
 *
 * The test seeds its own uniquely-titled, client-visible task via the admin API so it is
 * unambiguous even against a shared dev DB that already holds many template projects.
 */
const DEMO_PROJECT = "RD Novákovci — Pezinok";

async function findDemoProjectId(api: APIRequestContext): Promise<string> {
  const res = await api.get("/api/projects");
  expect(res.ok()).toBeTruthy();
  const { items } = (await res.json()) as { items: { id: string; name: string }[] };
  const demo = items.find((p) => p.name === DEMO_PROJECT);
  expect(demo, "demo project present in seed").toBeTruthy();
  return demo!.id;
}

test("client comments on a task; admin sees and answers it", async ({ browser }) => {
  const stamp = Date.now();
  const taskTitle = `Kuchyňa dispozícia ${stamp}`;
  const clientText = `Prosíme väčšie okno nad drezom ${stamp}`;
  const adminText = `Zapracujeme do návrhu ${stamp}`;

  // Admin context: create a unique client-visible task in the demo project's active phase.
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill("admin@architrack.local");
  await adminPage.getByLabel("Heslo").fill("ChangeMe123!");
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  const projectId = await findDemoProjectId(adminPage.request);
  const phasesRes = await adminPage.request.get(`/api/projects/${projectId}/phases`);
  const { items: phases } = (await phasesRes.json()) as {
    items: { id: string; visibility: string; status: string }[];
  };
  const phase =
    phases.find((p) => p.visibility === "CLIENT_VISIBLE" && p.status === "ACTIVE") ??
    phases.find((p) => p.visibility === "CLIENT_VISIBLE") ??
    phases[0];
  const createRes = await adminPage.request.post(`/api/phases/${phase.id}/tasks`, {
    data: { title: taskTitle, visibility: "CLIENT_VISIBLE" },
  });
  expect(createRes.ok(), "task created").toBeTruthy();

  // Client context: log in → Postup → open the seeded task → post a comment/change request.
  const clientCtx = await browser.newContext();
  const clientPage = await clientCtx.newPage();
  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill("klient@architrack.local");
  await clientPage.getByLabel("Heslo").fill("DemoClient123!");
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(clientPage).toHaveURL(/\/portal$/);

  await clientPage.goto(`/portal/progress?project=${projectId}`);
  const taskButton = clientPage
    .getByRole("button", { name: /Otvoriť úlohu/ })
    .filter({ hasText: taskTitle });
  await expect(taskButton).toBeVisible();
  await taskButton.click();

  const dialog = clientPage.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Komentáre" })).toBeVisible();
  await dialog.getByPlaceholder(/komentár/i).fill(clientText);
  const [postRes] = await Promise.all([
    clientPage.waitForResponse((r) => r.url().includes("/comments") && r.request().method() === "POST"),
    dialog.getByRole("button", { name: "Odoslať" }).click(),
  ]);
  expect(postRes.status(), "client comment persisted").toBe(201);
  await expect(dialog.getByRole("paragraph").filter({ hasText: clientText })).toBeVisible();
  await clientPage.keyboard.press("Escape");

  // The task row now shows the server-rendered comment-count badge after a reload.
  await clientPage.reload();
  await expect(taskButton.getByText(/^\d+$/)).toBeVisible();

  // Admin: open the same task in the Phases & Tasks tab → see the client's comment, reply.
  await adminPage.getByRole("link", { name: DEMO_PROJECT }).first().click();
  await adminPage.getByRole("link", { name: /Fázy a úlohy|Úlohy/ }).click();
  await adminPage.getByText(taskTitle, { exact: true }).first().click();

  const adminDialog = adminPage.getByRole("dialog");
  await expect(adminDialog.getByText(clientText)).toBeVisible();
  await adminDialog.getByPlaceholder(/komentár/i).fill(adminText);
  await adminDialog.getByRole("button", { name: "Odoslať" }).click();
  await expect(adminDialog.getByText(adminText)).toBeVisible();

  await clientCtx.close();
  await adminCtx.close();
});
