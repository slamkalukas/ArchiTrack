import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError } from "@/lib/api-error";
import { createTaskSchema } from "@/features/tasks/schemas";
import { createTask } from "@/features/tasks/server/tasks";
import { handleTaskApiError } from "@/features/tasks/server/http";

/** POST /api/phases/:id/tasks — ADMIN only, create task. spec/05-api.md §3. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const phase = await db.phase.findUnique({ where: { id }, select: { projectId: true } });
    if (!phase) {
      return apiError(404, "not_found", "Not found");
    }

    const { user } = await requireProjectAccess(phase.projectId, "ADMIN");
    const body = createTaskSchema.parse(await request.json());
    const task = await createTask(id, body, user);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return handleTaskApiError(error);
  }
}
