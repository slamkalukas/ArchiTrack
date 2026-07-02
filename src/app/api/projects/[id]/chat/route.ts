import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { apiError, handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { chatRateLimiter } from "@/lib/rate-limit";
import {
  createChatMessageSchema,
  listChatMessagesQuerySchema,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/features/chat/schemas";
import { createChatMessage, listChatMessages } from "@/features/chat/server/messages";
import { serializeChatMessage } from "@/features/chat/server/serialize";

/**
 * GET/POST /api/projects/:id/chat — spec/05-api.md §5.
 * GET: cursor-paginated messages, newest first, with attachments + read receipts.
 * POST: `{ body }` JSON, or multipart with attachments (files land via WP-5's saveUpload).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    const { searchParams } = new URL(request.url);
    const query = listChatMessagesQuerySchema.parse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const { items, nextCursor, reads } = await listChatMessages(projectId, query.cursor, query.limit);

    return NextResponse.json({
      items: items.map((m) => serializeChatMessage(m, user.id, reads)),
      nextCursor: nextCursor ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId);

    const limit = chatRateLimiter.consume(`chat:${user.id}`);
    if (!limit.ok) {
      return apiError(429, "rate_limited", "Too many messages. Please slow down.");
    }

    const project = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    if (project.status === "ARCHIVED" && user.role === "CLIENT") {
      return apiError(403, "project_archived", "This project is archived; chat is read-only.");
    }

    const contentType = request.headers.get("content-type") ?? "";
    let body: string;
    const files: { name: string; type: string; buffer: Buffer }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = String(form.get("body") ?? "");
      const entries = form.getAll("files");
      if (entries.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        return apiError(400, "validation_error", "Too many attachments.");
      }
      for (const entry of entries) {
        if (entry instanceof File) {
          const buffer = Buffer.from(await entry.arrayBuffer());
          files.push({ name: entry.name, type: entry.type || "application/octet-stream", buffer });
        }
      }
      if (!body.trim() && files.length === 0) {
        return apiError(400, "validation_error", "Message cannot be empty");
      }
    } else {
      const json = createChatMessageSchema.parse(await request.json());
      body = json.body;
    }

    const message = await createChatMessage({
      projectId,
      authorId: user.id,
      body: body.trim(),
      files,
    });

    return NextResponse.json({ item: serializeChatMessage(message, user.id, []) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
