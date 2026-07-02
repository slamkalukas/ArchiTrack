import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/csrf";
import { createPhaseSchema } from "@/features/tasks/schemas";
import { createPhase, listPhasesForProject } from "@/features/tasks/server/phases";
import { handleTaskApiError } from "@/features/tasks/server/http";

/**
 * GET /api/projects/:id/phases — phases with tasks (role-filtered) + progress numbers.
 * POST /api/projects/:id/phases — ADMIN only, create phase.
 * spec/05-api.md §3.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireProjectAccess(id);
    const phases = await listPhasesForProject(id, user);
    return NextResponse.json({ items: phases });
  } catch (error) {
    return handleTaskApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const { user } = await requireProjectAccess(id, "ADMIN");
    const body = createPhaseSchema.parse(await request.json());
    const phase = await createPhase(id, body, user);
    return NextResponse.json(phase, { status: 201 });
  } catch (error) {
    return handleTaskApiError(error);
  }
}
