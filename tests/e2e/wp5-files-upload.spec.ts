import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * WP-5 happy path (spec/07-agent-workplan.md ground rule §0.2): admin logs in, opens a
 * project's Files tab, uploads a file via the dropzone, sees it listed, and downloads it
 * — verifying the file round-trips through the real streaming upload + authorized
 * download pipeline against a real (seeded) Postgres + filesystem.
 */
test("admin uploads a file, sees it listed, and downloads it", async ({ page }) => {
  const db = new PrismaClient();
  const project = await db.project.findFirstOrThrow({
    where: { slug: "rd-novakovci-pezinok" },
    select: { id: true },
  });
  await db.$disconnect();

  const tmpDir = mkdtempSync(path.join(tmpdir(), "architrack-e2e-"));
  const filePath = path.join(tmpDir, `e2e-upload-${Date.now()}.pdf`);
  writeFileSync(filePath, "%PDF-1.4\n%E2E test fixture\n");

  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@architrack.local");
  await page.getByLabel("Heslo").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Prihlásiť sa" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/projects/${project.id}/files`);
  await expect(page.getByRole("heading", { name: "Súbory" })).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  const fileName = path.basename(filePath);
  const row = page.getByText(fileName, { exact: true });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.click();
  const drawer = page.getByRole("dialog", { name: fileName });
  await expect(drawer).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await drawer.getByRole("link", { name: "Stiahnuť" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(fileName);
});
