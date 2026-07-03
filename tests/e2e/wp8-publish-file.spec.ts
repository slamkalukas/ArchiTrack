import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * WP-8 build item 1b (spec/07-agent-workplan.md WP-8): admin uploads a file (private by
 * default — spec/03-data-model.md §3.2), publishes it via the visibility toggle, and the
 * demo client can see + download that exact file from the portal's Dokumenty tab. A
 * second, still-internal file uploaded in the same run must stay invisible to the client
 * (spec/05-api.md §9.3 visibility rule) — verified both in the UI listing and via a
 * direct API probe for its file id (must 404, never 403/200).
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

test("admin publishes a file; client sees and downloads it but not the internal one", async ({ browser }) => {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: DEMO_PROJECT_SLUG },
    select: { id: true },
  });

  const tmpDir = mkdtempSync(path.join(tmpdir(), "architrack-e2e-publish-"));
  const publicFileName = `e2e-published-${Date.now()}.pdf`;
  const internalFileName = `e2e-internal-${Date.now()}.pdf`;
  const publicFilePath = path.join(tmpDir, publicFileName);
  const internalFilePath = path.join(tmpDir, internalFileName);
  writeFileSync(publicFilePath, "%PDF-1.4\n%E2E published fixture\n");
  writeFileSync(internalFilePath, "%PDF-1.4\n%E2E internal fixture\n");

  // --- Admin: upload both files at the project root, publish only one ---
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await adminPage.goto("/login");
  await adminPage.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await adminPage.getByLabel("Heslo").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(adminPage).toHaveURL(/\/dashboard$/);

  await adminPage.goto(`/projects/${project.id}/files`);
  await expect(adminPage.getByRole("heading", { name: "Súbory" })).toBeVisible();

  const fileInput = adminPage.locator('input[type="file"]');
  await fileInput.setInputFiles([publicFilePath, internalFilePath]);

  await expect(adminPage.getByText(publicFileName, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(adminPage.getByText(internalFileName, { exact: true })).toBeVisible({ timeout: 15_000 });

  // Publish only the first file: click its row's visibility toggle (starts as "Interné").
  const publicRow = adminPage.getByRole("row", { name: new RegExp(publicFileName) });
  await publicRow.getByRole("button", { name: "Interné" }).click();
  await expect(publicRow.getByRole("button", { name: "Viditeľné pre klienta" })).toBeVisible();

  // Grab the internal file's id via the API for the leak probe below.
  const foldersRes = await adminPage.request.get(`/api/projects/${project.id}/folders`);
  const foldersBody = await foldersRes.json();
  const internalFile = (foldersBody.rootFiles as { id: string; name: string }[]).find(
    (f) => f.name === internalFileName,
  );
  expect(internalFile).toBeTruthy();
  const internalFileId = internalFile!.id;

  const publicFile = (foldersBody.rootFiles as { id: string; name: string }[]).find(
    (f) => f.name === publicFileName,
  );
  const publicFileId = publicFile!.id;

  await adminContext.close();

  // --- Client: sees the published file in the portal, downloads it, cannot see the internal one ---
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();

  await clientPage.goto("/login");
  await clientPage.getByLabel("E-mail").fill(CLIENT_EMAIL);
  await clientPage.getByLabel("Heslo").fill(CLIENT_PASSWORD);
  await clientPage.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(clientPage).toHaveURL(/\/portal$/);

  await clientPage.goto("/portal/documents");
  await expect(clientPage.getByRole("heading", { name: "Súbory" })).toBeVisible();

  await expect(clientPage.getByText(publicFileName, { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(clientPage.getByText(internalFileName, { exact: true })).not.toBeVisible();

  // Client downloads the published file via the preview drawer.
  await clientPage.getByText(publicFileName, { exact: true }).click();
  const drawer = clientPage.getByRole("dialog", { name: publicFileName });
  await expect(drawer).toBeVisible();
  const downloadPromise = clientPage.waitForEvent("download");
  await drawer.getByRole("link", { name: "Stiahnuť" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(publicFileName);

  // Leak probe: direct API requests for the internal file — metadata and download both 404.
  const metaRes = await clientPage.request.get(`/api/files/${internalFileId}`);
  expect(metaRes.status()).toBe(404);

  const downloadRes = await clientPage.request.get(`/api/files/${internalFileId}/download`);
  expect(downloadRes.status()).toBe(404);

  // Sanity: the same probe against the published file succeeds for the client.
  const publicMetaRes = await clientPage.request.get(`/api/files/${publicFileId}`);
  expect(publicMetaRes.ok()).toBeTruthy();

  await clientContext.close();
});
