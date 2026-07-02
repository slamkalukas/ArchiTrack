import { z } from "zod";

/**
 * Shared Zod schemas for the Files & folders feature (spec/05-api.md §4).
 * Imported by both route handlers and any client-side forms so validation stays in sync
 * (spec/02-architecture.md §1 — "Validation: Zod shared schemas").
 */

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]).optional(),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]).optional(),
  order: z.number().int().min(0).optional(),
});
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const updateFileSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["INTERNAL", "CLIENT_VISIBLE"]).optional(),
  validUntil: z.string().datetime().nullable().optional(),
});
export type UpdateFileInput = z.infer<typeof updateFileSchema>;

/** Query params for `GET /api/projects/:id/folders`. */
export const listFoldersQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
});

/** Query params for `GET /api/files/:id/download`. */
export const downloadQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});
