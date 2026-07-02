import { z } from "zod";

/**
 * Shared Zod schemas for phases/tasks (spec/05-api.md §3). Client and server import the
 * same schemas — see spec/05-api.md header note.
 */

export const phaseStatusSchema = z.enum(["UPCOMING", "ACTIVE", "DONE", "SKIPPED"]);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const visibilitySchema = z.enum(["INTERNAL", "CLIENT_VISIBLE"]);
export const assigneeTypeSchema = z.enum(["ARCHITECT", "EXTERNAL"]);

/** POST /api/projects/:id/phases */
export const createPhaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  weight: z.number().int().min(0).max(1000).default(10),
  visibility: visibilitySchema.default("CLIENT_VISIBLE"),
});
export type CreatePhaseInput = z.infer<typeof createPhaseSchema>;

/** PATCH /api/phases/:id */
export const updatePhaseSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: phaseStatusSchema.optional(),
  weight: z.number().int().min(0).max(1000).optional(),
  order: z.number().int().min(1).optional(),
  visibility: visibilitySchema.optional(),
  /** When marking a phase DONE, optionally auto-activate the next UPCOMING phase. */
  activateNext: z.boolean().optional(),
});
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;

/** POST /api/phases/:id/tasks */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(10000).nullable().optional(),
  status: taskStatusSchema.default("TODO"),
  dueDate: z.iso.datetime().nullable().optional(),
  weight: z.number().int().min(0).max(1000).default(1),
  milestone: z.boolean().default(false),
  visibility: visibilitySchema.default("INTERNAL"),
  assigneeType: assigneeTypeSchema.default("ARCHITECT"),
  contactId: z.uuid().nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** PATCH /api/tasks/:id — any field, including { status, order } for dnd. */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  status: taskStatusSchema.optional(),
  order: z.number().int().min(1).optional(),
  phaseId: z.uuid().optional(),
  dueDate: z.iso.datetime().nullable().optional(),
  weight: z.number().int().min(0).max(1000).optional(),
  milestone: z.boolean().optional(),
  visibility: visibilitySchema.optional(),
  assigneeType: assigneeTypeSchema.optional(),
  contactId: z.uuid().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** POST /api/tasks/reorder — batch, transactional. */
export const reorderTasksSchema = z.object({
  moves: z
    .array(
      z.object({
        taskId: z.uuid(),
        status: taskStatusSchema,
        order: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(500),
});
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;

/** Response shape helpers used by both server route handlers and the client feature UI. */
export interface TaskDTO {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  status: z.infer<typeof taskStatusSchema>;
  order: number;
  weight: number;
  milestone: boolean;
  visibility: z.infer<typeof visibilitySchema>;
  assigneeType: z.infer<typeof assigneeTypeSchema>;
  contactId: string | null;
  contactName?: string | null;
  dueDate: string | null;
  doneAt: string | null;
  createdAt: string;
  commentCount?: number;
}

export interface PhaseDTO {
  id: string;
  projectId: string;
  name: string;
  templateKey: string | null;
  order: number;
  status: z.infer<typeof phaseStatusSchema>;
  weight: number;
  description: string | null;
  visibility: z.infer<typeof visibilitySchema>;
  progress: number;
  tasks: TaskDTO[];
}
