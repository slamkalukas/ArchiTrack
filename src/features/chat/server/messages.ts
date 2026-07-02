import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { eventBus } from "@/lib/events";
import { saveUpload } from "@/lib/uploads";
import { notifyUsers, maybeEmailOfflineRecipient } from "@/features/notifications/server/notify";
import { CHAT_EDIT_WINDOW_MS } from "@/features/chat/schemas";
import type { SessionUser } from "@/lib/authz";

/**
 * Chat server logic (spec/04-features.md §6, spec/05-api.md §5).
 * One thread per project; participants = ADMIN(s) + that project's CLIENT members.
 */

const MESSAGE_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true, role: true } },
  attachments: {
    include: { versions: { orderBy: { version: "desc" as const }, take: 1 } },
  },
} as const;

export type ChatMessageWithRelations = Awaited<ReturnType<typeof listChatMessages>>["items"][number];

/** Cursor-paginated, newest-first per spec/05-api.md §5 (`?cursor&limit=50`). */
export async function listChatMessages(projectId: string, cursor?: string, limit = 50) {
  const items = await db.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: MESSAGE_INCLUDE,
  });

  let nextCursor: string | undefined;
  if (items.length > limit) {
    const next = items.pop();
    nextCursor = next?.id;
  }

  // Read receipts: fetch the latest ChatRead per user for this project's messages in one query.
  const messageIds = items.map((m) => m.id);
  const reads = messageIds.length
    ? await db.chatRead.findMany({ where: { messageId: { in: messageIds } } })
    : [];

  return { items, nextCursor, reads };
}

/** All members of a project (ADMIN + CLIENT) who participate in its chat thread. */
export async function getProjectParticipants(projectId: string) {
  const [admins, clientMembers] = await Promise.all([
    db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true, locale: true } }),
    db.projectMember.findMany({
      where: { projectId, user: { isActive: true } },
      select: { user: { select: { id: true, locale: true } } },
    }),
  ]);
  const clients = clientMembers.map((m) => m.user);
  // De-dupe in case an admin was also somehow added as a member.
  const byId = new Map([...admins, ...clients].map((u) => [u.id, u]));
  return [...byId.values()];
}

export interface CreateMessageInput {
  projectId: string;
  authorId: string;
  body: string;
  files?: { name: string; type: string; buffer: Buffer }[];
}

/**
 * Create a chat message, save attachments via the shared upload service (spec §6: files
 * land in "Od klienta" when uploaded by a CLIENT, "Chat" folder when by ADMIN, and are
 * auto CLIENT_VISIBLE because both parties saw them in the thread), fan out
 * notifications, and publish the SSE event.
 */
export async function createChatMessage(input: CreateMessageInput) {
  const author = await db.user.findUniqueOrThrow({
    where: { id: input.authorId },
    select: { id: true, role: true },
  });

  const message = await db.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        projectId: input.projectId,
        authorId: input.authorId,
        body: input.body,
      },
    });

    await logActivity(
      { projectId: input.projectId, actorId: input.authorId, action: "chat.message_sent", entityId: created.id },
      tx,
    );

    return created;
  });

  // Attachments: uploaded outside the transaction (filesystem I/O), then linked.
  if (input.files?.length) {
    const folderKey = author.role === "CLIENT" ? "from_client" : "chat";
    for (const file of input.files) {
      const version = await saveUpload(input.projectId, folderKey, {
        name: file.name,
        type: file.type,
        buffer: file.buffer,
        uploadedBy: input.authorId,
      });
      const uploadedFile = await db.fileVersion.findUniqueOrThrow({
        where: { id: version.id },
        select: { fileId: true },
      });
      // Chat attachments are auto CLIENT_VISIBLE (spec/04-features.md §6) and linked back
      // to the message so the thread can render them as attachment tiles.
      await db.file.update({
        where: { id: uploadedFile.fileId },
        data: { visibility: "CLIENT_VISIBLE", chatMessageId: message.id },
      });
    }
  }

  eventBus.publish("chat.message", {
    projectId: input.projectId,
    entityId: message.id,
    authorId: input.authorId,
  });

  const participants = await getProjectParticipants(input.projectId);
  const recipients = participants.filter((p) => p.id !== input.authorId);

  await notifyUsers(
    recipients.map((r) => ({
      userId: r.id,
      kind: "CHAT_MESSAGE",
      projectId: input.projectId,
      entityId: message.id,
      titleKey: "notifications.chatMessage",
    })),
  );

  // Chat has its own "offline 5 min" immediate-email gate (spec §6), on top of the
  // generic emailDigest handling notifyUsers() already applied.
  const freshNotifications = await db.notification.findMany({
    where: { userId: { in: recipients.map((r) => r.id) }, entityId: message.id, kind: "CHAT_MESSAGE" },
    select: { id: true, userId: true },
  });
  await Promise.all(
    freshNotifications.map((n) => maybeEmailOfflineRecipient(n.id, n.userId)),
  );

  return getChatMessageById(message.id);
}

export async function getChatMessageById(id: string) {
  return db.chatMessage.findUniqueOrThrow({ where: { id }, include: MESSAGE_INCLUDE });
}

export interface UpdateMessageInput {
  messageId: string;
  actor: SessionUser;
  body: string;
}

export async function updateChatMessage(input: UpdateMessageInput) {
  const message = await db.chatMessage.findUniqueOrThrow({ where: { id: input.messageId } });

  if (message.authorId !== input.actor.id) {
    throw new Error("Only the author can edit this message");
  }
  if (message.deletedAt) {
    throw new Error("Cannot edit a deleted message");
  }
  const age = Date.now() - message.createdAt.getTime();
  if (age > CHAT_EDIT_WINDOW_MS) {
    throw new Error("Edit window has expired");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.chatMessage.update({
      where: { id: input.messageId },
      data: { body: input.body, editedAt: new Date() },
    });
    await logActivity(
      {
        projectId: message.projectId,
        actorId: input.actor.id,
        action: "chat.message_edited",
        entityId: message.id,
      },
      tx,
    );
    return result;
  });

  eventBus.publish("chat.message", {
    projectId: message.projectId,
    entityId: updated.id,
    authorId: updated.authorId,
  });

  return getChatMessageById(updated.id);
}

export interface DeleteMessageInput {
  messageId: string;
  actor: SessionUser;
}

/** Soft delete (spec/03-data-model.md §3: soft wherever a client may have seen the content). */
export async function deleteChatMessage(input: DeleteMessageInput) {
  const message = await db.chatMessage.findUniqueOrThrow({ where: { id: input.messageId } });

  const isAuthor = message.authorId === input.actor.id;
  const isAdmin = input.actor.role === "ADMIN";
  if (!isAuthor && !isAdmin) {
    throw new Error("Not authorized to delete this message");
  }

  await db.$transaction(async (tx) => {
    await tx.chatMessage.update({ where: { id: input.messageId }, data: { deletedAt: new Date() } });
    await logActivity(
      {
        projectId: message.projectId,
        actorId: input.actor.id,
        action: "chat.message_deleted",
        entityId: message.id,
      },
      tx,
    );
  });

  eventBus.publish("chat.message", {
    projectId: message.projectId,
    entityId: message.id,
    authorId: message.authorId,
  });
}

/** Upsert ChatRead rows for every message up to and including `lastMessageId` (spec/05-api.md §5). */
export async function markChatRead(projectId: string, userId: string, lastMessageId: string) {
  const lastMessage = await db.chatMessage.findFirstOrThrow({
    where: { id: lastMessageId, projectId },
    select: { createdAt: true },
  });

  const unreadUpToLast = await db.chatMessage.findMany({
    where: { projectId, createdAt: { lte: lastMessage.createdAt } },
    select: { id: true },
  });

  await db.$transaction(
    unreadUpToLast.map((m) =>
      db.chatRead.upsert({
        where: { messageId_userId: { messageId: m.id, userId } },
        create: { messageId: m.id, userId },
        update: { readAt: new Date() },
      }),
    ),
  );
}

/** Unread count for a user in a project: messages after their last read message, excluding their own. */
export async function getUnreadCount(projectId: string, userId: string): Promise<number> {
  const lastRead = await db.chatRead.findFirst({
    where: { userId, message: { projectId } },
    orderBy: { message: { createdAt: "desc" } },
    include: { message: { select: { createdAt: true } } },
  });

  return db.chatMessage.count({
    where: {
      projectId,
      authorId: { not: userId },
      deletedAt: null,
      ...(lastRead ? { createdAt: { gt: lastRead.message.createdAt } } : {}),
    },
  });
}
