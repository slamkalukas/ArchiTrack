/**
 * Public exports of the comments feature module. WP-4 (task modal) and WP-5 (file
 * preview drawer) embed `CommentThread` for their respective subjects
 * (spec/04-features.md §7, spec/07-agent-workplan.md WP-6 "threaded comments... visibility rules").
 */
export { CommentThread } from "@/features/comments/components/comment-thread";
export { getCommentCount } from "@/features/comments/server/comments";
export * from "@/features/comments/schemas";
