import { z } from "zod";

/**
 * Zod schemas for the chat feature (spec/05-api.md §5, spec/04-features.md §6).
 * Shared between the route handlers and any client-side callers per
 * spec/02-architecture.md §1 ("Validation: Zod shared schemas").
 */

export const listChatMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;

/** Text-only POST body (JSON). Multipart uploads are parsed separately in the route handler. */
export const createChatMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(10_000),
});
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;

export const updateChatMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(10_000),
});
export type UpdateChatMessageInput = z.infer<typeof updateChatMessageSchema>;

export const markChatReadSchema = z.object({
  lastMessageId: z.string().uuid(),
});
export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;

/** Edit window for chat messages (spec/04-features.md §6): 15 minutes after creation. */
export const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Allowed attachment MIME/extension policy delegated to WP-5's upload service; this is just a soft cap on count per message. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
