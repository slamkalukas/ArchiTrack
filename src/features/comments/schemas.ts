import { z } from "zod";

/** Zod schemas for the comments feature (spec/05-api.md §6, spec/04-features.md §7). */

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5_000),
  parentId: z.string().uuid().optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5_000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const listCommentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

export type CommentSubjectKind = "task" | "file";
