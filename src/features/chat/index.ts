/**
 * Public exports of the chat feature module (spec/02-architecture.md §2 feature-module
 * convention). WP-7 (client portal) reuses `ChatPanel` for the "Správy" tab per
 * spec/07-agent-workplan.md WP-7: "Správy (reusing WP-6 thread)".
 */
export { ChatPanel } from "@/features/chat/components/chat-panel";
export { useChatThread } from "@/features/chat/hooks/use-chat-thread";
export type { ChatApiMessage } from "@/features/chat/hooks/use-chat-thread";
export { getUnreadCount as getChatUnreadCount } from "@/features/chat/server/messages";
export * from "@/features/chat/schemas";
