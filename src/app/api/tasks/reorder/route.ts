import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requireProjectAccess, AuthzError } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { reorderTasksSchema } from "@/features/tasks/schemas";
import { reorderTasks } from "@/features/tasks/server/tasks";
import { handleTaskApiError } from "@/features/tasks/server/http";

/**
 * POST /api/tasks/reorder — ADMIN, `{ moves: [{taskId, status, order}] }` batch,
 * transactional (spec/05-api.md §3, spec/04-features.md §4 AC: drag & drop persists
 * `(status, order)`). Not project-scoped in the URL, so we resolve the project from the
 * first referenced task and authorize against it; `reorderTasks` itself re-verifies every
 * task belongs to that same project inside the transaction.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      throw new AuthzError(404, "Not found");
    }

    const body = reorderTasksSchema.parse(await request.json());

    const firstTask = await db.task.findUnique({
      where: { id: body.moves[0]!.taskId },
      select: { phase: { select: { projectId: true } } },
    });
    if (!firstTask) {
      throw new AuthzError(404, "Not found");
    }
    await requireProjectAccess(firstTask.phase.projectId, "ADMIN");

    const result = await reorderTasks(body, user);
    return NextResponse.json({ ok: true, updatedTaskIds: result.updatedTaskIds });
  } catch (error) {
    return handleTaskApiError(error);
  }
}
