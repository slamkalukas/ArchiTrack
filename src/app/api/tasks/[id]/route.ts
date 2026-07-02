import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError } from "@/lib/api-error";
import { updateTaskSchema } from "@/features/tasks/schemas";
import { deleteTask, updateTask } from "@/features/tasks/server/tasks";
import { handleTaskApiError } from "@/features/tasks/server/http";

/**
 * PATCH /api/tasks/:id — ADMIN: any field, incl. `{ status, order }` for drag & drop.
 * DELETE /api/tasks/:id — ADMIN: soft if ever client-visible.
 * spec/05-api.md §3.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const task = await db.task.findUnique({ where: { id }, select: { phase: { select: { projectId: true } } } });
    if (!task) {
      return apiError(404, "not_found", "Not found");
    }

    const { user } = await requireProjectAccess(task.phase.projectId, "ADMIN");
    const body = updateTaskSchema.parse(await request.json());
    const updated = await updateTask(id, body, user);
    return NextResponse.json(updated);
  } catch (error) {
    return handleTaskApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const task = await db.task.findUnique({ where: { id }, select: { phase: { select: { projectId: true } } } });
    if (!task) {
      return apiError(404, "not_found", "Not found");
    }

    const { user } = await requireProjectAccess(task.phase.projectId, "ADMIN");
    await deleteTask(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleTaskApiError(error);
  }
}
