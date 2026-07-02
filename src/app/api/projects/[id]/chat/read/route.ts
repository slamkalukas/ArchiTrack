import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/authz";
import { apiError, handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { markChatReadSchema } from "@/features/chat/schemas";
import { markChatRead } from "@/features/chat/server/messages";

/** POST /api/projects/:id/chat/read — `{ lastMessageId }` → upserts ChatRead rows. spec/05-api.md §5. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    // Called fire-and-forget from the client on every thread update (see
    // useChatThread); an empty/malformed body (e.g. a superseded request during rapid
    // successive calls) is a client-side no-op, not a server error.
    const raw = await request.text();
    if (!raw) {
      return apiError(400, "validation_error", "Request body is required");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return apiError(400, "validation_error", "Invalid JSON body");
    }

    const body = markChatReadSchema.parse(parsed);
    await markChatRead(projectId, user.id, body.lastMessageId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2025") {
      return apiError(404, "not_found", "Message not found");
    }
    return handleApiError(error);
  }
}
