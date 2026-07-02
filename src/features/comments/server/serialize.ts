import type { CommentWithRelations } from "@/features/comments/server/comments";

/** Shape a Comment (with author + one level of replies) for API responses; deleted comments show a placeholder. */
export function serializeComment(comment: CommentWithRelations) {
  const isDeleted = !!comment.deletedAt;
  return {
    id: comment.id,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      avatarUrl: comment.author.avatarUrl,
      role: comment.author.role,
    },
    body: isDeleted ? null : comment.body,
    deleted: isDeleted,
    createdAt: comment.createdAt.toISOString(),
    replies: comment.replies.map((reply) => ({
      id: reply.id,
      author: {
        id: reply.author.id,
        name: reply.author.name,
        avatarUrl: reply.author.avatarUrl,
        role: reply.author.role,
      },
      body: reply.deletedAt ? null : reply.body,
      deleted: !!reply.deletedAt,
      createdAt: reply.createdAt.toISOString(),
    })),
  };
}
