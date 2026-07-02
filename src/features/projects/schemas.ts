import { z } from "zod";

/**
 * Zod schemas for the projects feature (spec/05-api.md §2, §8 `/api/me/locale`).
 * Shared between route handlers and client forms per spec/02-architecture.md §1
 * ("Validation: Zod shared schemas in /src/lib/schemas" — kept feature-local here per
 * the feature-module convention in spec/02-architecture.md §2, imported by both server
 * and client code in this feature).
 */

export const projectStatusSchema = z.enum(["ACTIVE", "ON_HOLD", "ARCHIVED"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  locationText: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  startDate: z.coerce.date().optional(),
  targetDate: z.coerce.date().optional(),
  coverImageId: z.string().uuid().optional(),
  /** Existing client emails/names to invite immediately; empty = invite later from settings. */
  clients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().trim().min(1).max(120),
        locale: z.enum(["sk", "en"]).default("sk"),
      }),
    )
    .max(10)
    .default([]),
  templateId: z.string().uuid().optional(),
  /** TaskTemplate ids the wizard's pruning step removed — those tasks (and empty resulting folders) are skipped. */
  prunedTaskTemplateIds: z.array(z.string().uuid()).default([]),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: projectStatusSchema.optional(),
  locationText: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  coverImageId: z.string().uuid().nullable().optional(),
  /** Phase id → weight, applied together so the wizard/settings weight editor can save in one call. */
  phaseWeights: z.record(z.string().uuid(), z.number().int().min(0).max(100)).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  locale: z.enum(["sk", "en"]).default("sk"),
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const createContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const activityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  clientFeed: z
    .union([z.literal("1"), z.literal("0")])
    .optional()
    .transform((v) => v === "1"),
});
export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

export const projectListQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});
export type ProjectListQueryInput = z.infer<typeof projectListQuerySchema>;

/** `PATCH /api/me` — profile fields including locale persistence for the LocaleSwitcher. */
export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(["sk", "en"]).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  emailDigest: z.boolean().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/)
    .optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/** `PATCH /api/me/locale` — minimal dedicated route used by WP-2's LocaleSwitcher best-effort call. */
export const updateMyLocaleSchema = z.object({
  locale: z.enum(["sk", "en"]),
});
export type UpdateMyLocaleInput = z.infer<typeof updateMyLocaleSchema>;
