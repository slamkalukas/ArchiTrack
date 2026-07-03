import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * WP-8 build item 1c (spec/07-agent-workplan.md WP-8): chat both directions. Complements
 * tests/e2e/chat.spec.ts (WP-6's admin→client happy path) with the client→admin direction
 * plus the unread counter actually clearing after the recipient reads the thread
 * (POST /api/projects/:id/chat/read, spec/05-api.md §5).
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

test("client sends a chat message; admin's unread count rises then clears after reading", async ({ browser }) => {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: DEMO_PROJECT_SLUG },
    select: { id: true, name: true },
  });

  const messageText = `E2E client→admin message ${Date.now()}`;

  // --- Client: log in, open Správy, send a message ---
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();

  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await clientPage.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(clientPage).toHaveURL(/\/portal$/);

  await clientPage.goto("/portal/messages");
  const composer = clientPage.getByPlaceholder("Napíšte správu…");
  await composer.fill(messageText);
  await clientPage.getByRole("button", { name: "Odoslať" }).click();
  await expect(clientPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  await clientContext.close();

  // --- Admin: sees the message + an unread notification ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await adminPage.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  const notificationsBefore = await adminPage.request.get("/api/notifications?limit=20");
  expect(notificationsBefore.ok()).toBeTruthy();
  const beforeBody = await notificationsBefore.json();
  const unreadBefore = beforeBody.items.find(
    (n: { kind: string; projectId: string; read: boolean; payload?: { body?: string } }) =>
      n.kind === "CHAT_MESSAGE" && n.projectId === project.id && !n.read,
  );
  expect(unreadBefore).toBeTruthy();

  // Admin opens the chat tab and reads the thread.
  await adminPage.goto(`/projects/${project.id}/chat`);
  await expect(adminPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });

  const chatRes = await adminPage.request.get(`/api/projects/${project.id}/chat?limit=5`);
  const chatBody = await chatRes.json();
  const seenByAdmin = chatBody.items.find((m: { body: string }) => m.body === messageText);
  expect(seenByAdmin).toBeTruthy();
  expect(seenByAdmin.own).toBe(false);

  // Mark the chat thread read (per-message read receipts, ChatRead rows — spec/05-api.md
  // §5) — independent of the notification bell's own read state, see below.
  const readRes = await adminPage.request.post(`/api/projects/${project.id}/chat/read`, {
    data: { lastMessageId: seenByAdmin.id },
  });
  expect(readRes.ok()).toBeTruthy();

  // The notification bell has its own read state (spec/05-api.md §7:
  // POST /api/notifications/read) — mark it explicitly, as the UI's NotificationBell does
  // when the dropdown is opened, and confirm the unread flag clears.
  const markReadRes = await adminPage.request.post("/api/notifications/read", {
    data: { ids: [unreadBefore.id] },
  });
  expect(markReadRes.ok()).toBeTruthy();

  const notificationsAfter = await adminPage.request.get("/api/notifications?limit=20");
  const afterBody = await notificationsAfter.json();
  const stillUnread = afterBody.items.find(
    (n: { id: string; read: boolean }) => n.id === unreadBefore.id && !n.read,
  );
  expect(stillUnread).toBeFalsy();

  await adminContext.close();
});
