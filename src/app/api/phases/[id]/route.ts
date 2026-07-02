import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError } from "@/lib/api-error";
import { updatePhaseSchema } from "@/features/tasks/schemas";
import { deletePhase, updatePhase } from "@/features/tasks/server/phases";
import { handleTaskApiError } from "@/features/tasks/server/http";

/**
 * PATCH /api/phases/:id — ADMIN: rename, status, weight, order, visibility, description.
 * DELETE /api/phases/:id — ADMIN: only when empty.
 * spec/05-api.md §3. The route only carries the phase id, so we resolve its projectId
 * first and authorize against that — 404 (not the phase's existence) when the caller has
 * no access, matching the "don't leak existence" rule.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const phase = await db.phase.findUnique({ where: { id }, select: { projectId: true } });
    if (!phase) {
      return apiError(404, "not_found", "Not found");
    }

    const { user } = await requireProjectAccess(phase.projectId, "ADMIN");
    const body = updatePhaseSchema.parse(await request.json());
    const result = await updatePhase(id, body, user);
    return NextResponse.json(result.phase, {
      headers: result.activatedNextPhaseId ? { "x-activated-next-phase-id": result.activatedNextPhaseId } : undefined,
    });
  } catch (error) {
    return handleTaskApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const phase = await db.phase.findUnique({ where: { id }, select: { projectId: true } });
    if (!phase) {
      return apiError(404, "not_found", "Not found");
    }

    const { user } = await requireProjectAccess(phase.projectId, "ADMIN");
    await deletePhase(id, user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleTaskApiError(error);
  }
}
