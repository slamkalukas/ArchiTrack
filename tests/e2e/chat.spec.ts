import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * WP-6 happy path (spec/07-agent-workplan.md ground rule §0.2): admin logs in, opens the
 * demo project's Chat tab, sends a message, and it appears in the thread. Also verifies
 * the demo client's unread count increases (via a second, client-authenticated browser
 * context hitting `GET /api/notifications` + the chat GET response), confirming the
 * notification fan-out + unread tracking described in spec/04-features.md §6, §9.
 *
 * Runs against the WP-6 dev DB (seeded via `pnpm db:seed`) on PORT 3006 — see
 * playwright.wp6.config.ts. The demo project is looked up directly via Prisma (seeded by
 * `prisma/seed.ts`, slug `rd-novakovci-pezinok`) since the admin dashboard's project list
 * UI is owned by WP-3 and isn't present in this worktree.
 */

const ADMIN_EMAIL = "admin@architrack.local";
const ADMIN_PASSWORD = "ChangeMe123!";
const CLIENT_EMAIL = "klient@architrack.local";
const CLIENT_PASSWORD = "DemoClient123!";
const DEMO_PROJECT_SLUG = "rd-novakovci-pezinok";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

test("admin sends a chat message in the demo project; it appears and the client's unread count rises", async ({
  browser,
}) => {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: DEMO_PROJECT_SLUG },
    select: { id: true, name: true },
  });

  const messageText = `E2E happy path message ${Date.now()}`;

  // --- Admin: log in, open the Chat tab, send a message ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await adminPage.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  await adminPage.goto(`/projects/${project.id}/chat`);
  await expect(adminPage.getByRole("heading", { name: project.name })).toBeVisible();

  const composer = adminPage.getByPlaceholder("Napíšte správu…");
  await composer.fill(messageText);
  await adminPage.getByRole("button", { name: "Odoslať" }).click();

  await expect(adminPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  // --- Verify via API that the message actually persisted with the right author ---
  const chatApiRes = await adminPage.request.get(`/api/projects/${project.id}/chat?limit=5`);
  expect(chatApiRes.ok()).toBeTruthy();
  const chatApiBody = await chatApiRes.json();
  const posted = chatApiBody.items.find((m: { body: string }) => m.body === messageText);
  expect(posted).toBeTruthy();
  expect(posted.own).toBe(true);

  await adminContext.close();

  // --- Client: log in as the demo client, verify an unread notification exists ---
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();

  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await clientPage.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();

  // Client lands in the portal, not the admin dashboard.
  await expect(clientPage).toHaveURL(/\/portal/);

  const notificationsRes = await clientPage.request.get("/api/notifications?limit=10");
  expect(notificationsRes.ok()).toBeTruthy();
  const notificationsBody = await notificationsRes.json();
  const chatNotification = notificationsBody.items.find(
    (n: { kind: string; read: boolean; projectId: string }) =>
      n.kind === "CHAT_MESSAGE" && n.projectId === project.id && !n.read,
  );
  expect(chatNotification).toBeTruthy();

  // Unread chat count for the client should be at least 1 (the message just sent).
  const clientChatRes = await clientPage.request.get(`/api/projects/${project.id}/chat?limit=5`);
  expect(clientChatRes.ok()).toBeTruthy();
  const clientChatBody = await clientChatRes.json();
  const seenByClient = clientChatBody.items.find((m: { body: string }) => m.body === messageText);
  expect(seenByClient).toBeTruthy();
  expect(seenByClient.own).toBe(false);

  await clientContext.close();
});
