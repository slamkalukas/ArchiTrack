import type { ChatRead } from "@prisma/client";
import type { ChatMessageWithRelations } from "@/features/chat/server/messages";

/**
 * Shape a ChatMessage (with author + attachments) for API responses.
 * Deleted messages show a placeholder body for both sides (spec/04-features.md §6 AC)
 * and never leak `storageKey` (spec/05-api.md §9.3) — only the display name/kind.
 */
export function serializeChatMessage(
  message: ChatMessageWithRelations,
  viewerId: string,
  reads: ChatRead[],
) {
  const messageReads = reads.filter((r) => r.messageId === message.id);
  const isDeleted = !!message.deletedAt;

  return {
    id: message.id,
    projectId: message.projectId,
    author: {
      id: message.author.id,
      name: message.author.name,
      avatarUrl: message.author.avatarUrl,
      role: message.author.role,
    },
    own: message.author.id === viewerId,
    body: isDeleted ? null : message.body,
    deleted: isDeleted,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    attachments: isDeleted
      ? []
      : message.attachments.map((file) => ({
          id: file.id,
          name: file.name,
          kind: attachmentKind(file.versions[0]?.mimeType),
          sizeBytes: file.versions[0]?.size ?? 0,
        })),
    readBy: messageReads.map((r) => ({ userId: r.userId, readAt: r.readAt.toISOString() })),
  };
}

function attachmentKind(mimeType?: string): "pdf" | "image" | "doc" | "other" {
  if (!mimeType) return "other";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("word") || mimeType.includes("officedocument") || mimeType === "text/plain") {
    return "doc";
  }
  return "other";
}
