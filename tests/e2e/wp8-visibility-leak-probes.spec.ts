import { expect, test } from "@playwright/test";
import { PrismaClient, type Project, type Phase, type Task, type Folder, type File as PrismaFile } from "@prisma/client";
import { randomUUID } from "node:crypto";

/**
 * WP-8 build item 1e — the security-critical part of the WP (spec/05-api.md §9.3,
 * spec/02-architecture.md §4.1): as a CLIENT, direct API requests for internal
 * tasks/files/folders/other projects — including IDOR attempts with *valid* ids
 * belonging to a project the client is not a member of — must return 404, never
 * 403/200. A 403 would let a client distinguish "exists but not mine" from "does not
 * exist"; per `requireProjectAccess()` in src/lib/authz.ts every denial is a 404.
 *
 * Fixture: a second project ("E2E Leak-Probe Project", not seeded by prisma/seed.ts) is
 * created directly via Prisma with an internal phase/task, an internal folder/file, and
 * a chat message — the demo client (klient@architrack.local) is deliberately NOT added
 * as a member of it. We also probe an internal (never client-visible) task/file/folder
 * that DOES belong to the demo client's own seeded project, to check same-project
 * visibility leaks (not just cross-project IDOR).
 */
const CLIENT_EMAIL = "klient@architrack.local";
const CLIENT_PASSWORD = "DemoClient123!";

const db = new PrismaClient();

let otherProject: Project;
let otherPhase: Phase;
let otherTask: Task;
let otherFolder: Folder;
let otherFile: PrismaFile;
let otherChatMessageId: string;

let ownProjectId: string;
let ownInternalTask: Task;
let ownInternalFolder: Folder;
let ownInternalFile: PrismaFile;

test.beforeAll(async () => {
  // --- Project the client is NOT a member of at all ---
  otherProject = await db.project.create({
    data: {
      name: "E2E Leak-Probe Project",
      slug: `e2e-leak-probe-${Date.now()}`,
      status: "ACTIVE",
    },
  });

  otherPhase = await db.phase.create({
    data: {
      projectId: otherProject.id,
      name: "E2E Other-Project Phase",
      order: 1,
      weight: 10,
      visibility: "CLIENT_VISIBLE", // even a client-visible phase must be unreachable cross-project
    },
  });

  otherTask = await db.task.create({
    data: {
      phaseId: otherPhase.id,
      title: "E2E Other-Project Task",
      order: 1,
      visibility: "CLIENT_VISIBLE",
    },
  });

  otherFolder = await db.folder.create({
    data: { projectId: otherProject.id, name: "E2E Other-Project Folder", visibility: "CLIENT_VISIBLE" },
  });

  otherFile = await db.file.create({
    data: {
      projectId: otherProject.id,
      folderId: otherFolder.id,
      name: "e2e-other-project-file.pdf",
      visibility: "CLIENT_VISIBLE",
      versions: {
        create: {
          version: 1,
          storageKey: randomUUID(),
          size: 10,
          mimeType: "application/pdf",
          uploadedBy: (await db.user.findUniqueOrThrow({ where: { email: CLIENT_EMAIL } })).id,
        },
      },
    },
  });

  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const otherChatMessage = await db.chatMessage.create({
    data: { projectId: otherProject.id, authorId: admin.id, body: "E2E other-project chat message" },
  });
  otherChatMessageId = otherChatMessage.id;

  // --- Internal (never client-visible) entities inside the client's OWN project ---
  // Task visibility is per-task (defaults to INTERNAL — spec/03-data-model.md §3.2), so
  // any existing phase works; the demo template's phases are themselves all
  // CLIENT_VISIBLE, which makes this the "same-project, task-level visibility" probe
  // (distinct from the phase-level one already covered by the cross-project fixtures).
  const demoProject = await db.project.findUniqueOrThrow({ where: { slug: "rd-novakovci-pezinok" } });
  ownProjectId = demoProject.id;

  const anyPhase = await db.phase.findFirstOrThrow({ where: { projectId: ownProjectId } });

  ownInternalTask = await db.task.create({
    data: { phaseId: anyPhase.id, title: "E2E Own-Project Internal Task", order: 999, visibility: "INTERNAL" },
  });

  ownInternalFolder = await db.folder.create({
    data: { projectId: ownProjectId, name: `E2E Own Internal Folder ${Date.now()}`, visibility: "INTERNAL" },
  });

  ownInternalFile = await db.file.create({
    data: {
      projectId: ownProjectId,
      folderId: ownInternalFolder.id,
      name: "e2e-own-internal-file.pdf",
      visibility: "INTERNAL",
      versions: {
        create: {
          version: 1,
          storageKey: randomUUID(),
          size: 10,
          mimeType: "application/pdf",
          uploadedBy: admin.id,
        },
      },
    },
  });
});

test.afterAll(async () => {
  await db.project.delete({ where: { id: otherProject.id } }); // cascades phases/tasks/folders/files/chat
  await db.file.delete({ where: { id: ownInternalFile.id } });
  await db.folder.delete({ where: { id: ownInternalFolder.id } });
  await db.task.delete({ where: { id: ownInternalTask.id } });
  await db.$disconnect();
});

test("CLIENT direct-API probes for internal/other-project entities all return 404", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await page.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(page).toHaveURL(/\/portal$/);

  const probes: { label: string; request: () => Promise<{ status(): number }> }[] = [
    // --- Cross-project (IDOR with valid ids from a project the client has zero membership in) ---
    { label: "GET /api/projects/:otherProjectId", request: () => page.request.get(`/api/projects/${otherProject.id}`) },
    {
      label: "GET /api/projects/:otherProjectId/phases",
      request: () => page.request.get(`/api/projects/${otherProject.id}/phases`),
    },
    {
      label: "GET /api/projects/:otherProjectId/folders",
      request: () => page.request.get(`/api/projects/${otherProject.id}/folders`),
    },
    {
      label: "GET /api/projects/:otherProjectId/chat",
      request: () => page.request.get(`/api/projects/${otherProject.id}/chat?limit=5`),
    },
    {
      label: "GET /api/projects/:otherProjectId/activity",
      request: () => page.request.get(`/api/projects/${otherProject.id}/activity`),
    },
    {
      label: "GET /api/projects/:otherProjectId/files/zip",
      request: () => page.request.get(`/api/projects/${otherProject.id}/files/zip`),
    },
    { label: "PATCH /api/tasks/:otherTaskId", request: () => page.request.patch(`/api/tasks/${otherTask.id}`, { data: { title: "hacked" } }) },
    { label: "GET /api/files/:otherFileId", request: () => page.request.get(`/api/files/${otherFile.id}`) },
    {
      label: "GET /api/files/:otherFileId/download",
      request: () => page.request.get(`/api/files/${otherFile.id}/download`),
    },
    {
      label: "GET /api/files/:otherFileId/thumbnail",
      request: () => page.request.get(`/api/files/${otherFile.id}/thumbnail`),
    },
    { label: "PATCH /api/folders/:otherFolderId", request: () => page.request.patch(`/api/folders/${otherFolder.id}`, { data: { name: "hacked" } }) },
    {
      label: "GET /api/tasks/:otherTaskId/comments",
      request: () => page.request.get(`/api/tasks/${otherTask.id}/comments`),
    },
    {
      label: "GET /api/files/:otherFileId/comments",
      request: () => page.request.get(`/api/files/${otherFile.id}/comments`),
    },
    {
      label: "PATCH /api/chat/:otherChatMessageId",
      request: () => page.request.patch(`/api/chat/${otherChatMessageId}`, { data: { body: "hacked" } }),
    },
    {
      label: "DELETE /api/chat/:otherChatMessageId",
      request: () => page.request.delete(`/api/chat/${otherChatMessageId}`),
    },

    // --- Same project, but INTERNAL entities (visibility rule, not just membership) ---
    {
      label: "GET /api/files/:ownInternalFileId",
      request: () => page.request.get(`/api/files/${ownInternalFile.id}`),
    },
    {
      label: "GET /api/files/:ownInternalFileId/download",
      request: () => page.request.get(`/api/files/${ownInternalFile.id}/download`),
    },
    {
      label: "GET /api/tasks/:ownInternalTaskId/comments",
      request: () => page.request.get(`/api/tasks/${ownInternalTask.id}/comments`),
    },

    // --- Nonexistent ids (well-formed uuid, no matching row) — same 404 shape ---
    {
      label: "GET /api/files/:nonexistentId",
      request: () => page.request.get(`/api/files/${randomUUID()}`),
    },
    {
      label: "GET /api/projects/:nonexistentId",
      request: () => page.request.get(`/api/projects/${randomUUID()}`),
    },
  ];

  for (const probe of probes) {
    const res = await probe.request();
    expect(res.status(), `${probe.label} should be 404`).toBe(404);
  }

  // The internal own-project folder must not appear in the folder tree response either
  // (list-endpoint role-shaping, spec/05-api.md §9.3 item 3) — not just direct-id probes.
  const foldersRes = await page.request.get(`/api/projects/${ownProjectId}/folders`);
  expect(foldersRes.ok()).toBeTruthy();
  const foldersBody = await foldersRes.json();
  const folderNames = JSON.stringify(foldersBody);
  expect(folderNames).not.toContain(ownInternalFolder.name);
  expect(folderNames).not.toContain(ownInternalFile.name);

  await context.close();
});
