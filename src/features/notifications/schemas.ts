import { z } from "zod";

/** Zod schemas for the notifications feature (spec/05-api.md §7, spec/04-features.md §9). */

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

/**
 * How long a user must be "offline" (no open SSE connection) before a notification
 * triggers an immediate email, per spec/04-features.md §6: "if recipient has no open
 * session in 5 min → email notification (respecting digest pref)".
 */
export const OFFLINE_EMAIL_THRESHOLD_MS = 5 * 60 * 1000;
