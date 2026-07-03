import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * WP-8 full invite flow (spec/07-agent-workplan.md WP-8 build item 1a):
 * admin invites a brand-new client from a project's Settings → Members tab, the invite
 * is persisted (email goes through the dev jsonTransport per src/lib/email.ts — no real
 * SMTP in dev/test, so the token is read straight from the DB, exactly as a human tester
 * would read it from the dev mail log), the new client opens the invite link, sets a
 * password, and lands in the portal seeing the project they were invited to.
 */
const ADMIN_EMAIL = "admin@architrack.local";
const ADMIN_PASSWORD = "ChangeMe123!";
const DEMO_PROJECT_SLUG = "rd-novakovci-pezinok";

const db = new PrismaClient();

test.afterAll(async () => {
  await db.$disconnect();
});

test("admin invites a new client; client accepts and lands in the portal seeing the project", async ({
  browser,
}) => {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: DEMO_PROJECT_SLUG },
    select: { id: true, name: true },
  });

  const newClientEmail = `e2e-invite-${Date.now()}@example.com`;
  const newClientName = "E2E Invited Client";
  const newClientPassword = "InvitedClient123!";

  // --- Admin: invite the new client from project settings ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await adminPage.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  await adminPage.goto(`/projects/${project.id}/settings`);
  await adminPage.getByRole("tab", { name: "Členovia" }).click();
  await adminPage.getByRole("button", { name: "Pridať klienta" }).first().click();

  await adminPage.getByLabel("Meno", { exact: true }).fill(newClientName);
  await adminPage.getByLabel("E-mail").fill(newClientEmail);
  await adminPage.getByRole("button", { name: "Pozvať", exact: true }).click();

  await expect(adminPage.getByText(newClientEmail)).toBeVisible({ timeout: 10_000 });
  await expect(adminPage.getByText("Čaká na prijatie pozvánky")).toBeVisible();

  await adminContext.close();

  // --- Extract the invite token straight from the DB (dev email transport is JSON-only,
  // no real SMTP — see src/lib/email.ts createTransporter fallback). ---
  const invitedUser = await db.user.findUniqueOrThrow({
    where: { email: newClientEmail },
    select: { id: true },
  });
  const invite = await db.invite.findFirstOrThrow({
    where: { userId: invitedUser.id, usedAt: null },
    orderBy: { expiresAt: "desc" },
    select: { token: true },
  });

  // --- New client: open the invite link, set a password ---
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();

  await clientPage.goto(`/invite/${invite.token}`);
  await expect(clientPage.getByRole("heading", { name: "Boli ste pozvaní" })).toBeVisible();
  await expect(clientPage.getByText(project.name)).toBeVisible();

  await clientPage.getByLabel("Meno a priezvisko").fill(newClientName);
  await clientPage.getByLabel("Zvoľte heslo").fill(newClientPassword);
  await clientPage.getByLabel("Potvrďte heslo").fill(newClientPassword);
  await clientPage.getByRole("button", { name: "Vytvoriť účet" }).click();

  await expect(clientPage).toHaveURL(/\/login$/, { timeout: 10_000 });

  // --- New client logs in and lands in the portal, seeing the project ---
  await clientPage.getByLabel("E-mail").fill(newClientEmail);
  await clientPage.getByLabel("Heslo").fill(newClientPassword);
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();

  await expect(clientPage).toHaveURL(/\/portal$/);
  await expect(clientPage.getByRole("heading", { name: project.name })).toBeVisible();

  await clientContext.close();

  // Cleanup: remove the test client + invite so repeated runs stay idempotent.
  await db.projectMember.deleteMany({ where: { userId: invitedUser.id } });
  await db.invite.deleteMany({ where: { userId: invitedUser.id } });
  await db.user.delete({ where: { id: invitedUser.id } });
});
