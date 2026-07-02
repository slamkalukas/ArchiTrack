import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { apiError, handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { updateChatMessageSchema } from "@/features/chat/schemas";
import { deleteChatMessage, updateChatMessage } from "@/features/chat/server/messages";
import { serializeChatMessage } from "@/features/chat/server/serialize";

/**
 * PATCH /api/chat/:messageId — author only, within the 15-minute edit window.
 * DELETE /api/chat/:messageId — author or ADMIN, soft delete.
 * spec/05-api.md §5.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  try {
    assertSameOrigin(request);
    const { messageId } = await context.params;

    const message = await db.chatMessage.findUnique({ where: { id: messageId }, select: { projectId: true } });
    if (!message) return apiError(404, "not_found", "Message not found");

    const { user } = await requireProjectAccess(message.projectId);
    const body = updateChatMessageSchema.parse(await request.json());

    const updated = await updateChatMessage({ messageId, actor: user, body: body.body });
    return NextResponse.json({ item: serializeChatMessage(updated, user.id, []) });
  } catch (error) {
    if (error instanceof Error && /author|window|deleted/i.test(error.message)) {
      return apiError(403, "forbidden", error.message);
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  try {
    assertSameOrigin(request);
    const { messageId } = await context.params;

    const message = await db.chatMessage.findUnique({ where: { id: messageId }, select: { projectId: true } });
    if (!message) return apiError(404, "not_found", "Message not found");

    const { user } = await requireProjectAccess(message.projectId);
    await deleteChatMessage({ messageId, actor: user });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && /not authorized/i.test(error.message)) {
      return apiError(403, "forbidden", error.message);
    }
    return handleApiError(error);
  }
}
