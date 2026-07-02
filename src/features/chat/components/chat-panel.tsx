"use client";

import { useTranslations } from "next-intl";
import { ChatThread } from "@/components/shared/chat-thread";
import { MessageComposer } from "@/components/shared/message-composer";
import { Button } from "@/components/ui/button";
import { useChatThread } from "@/features/chat/hooks/use-chat-thread";
import type { ChatMessageItem } from "@/components/shared/types";

interface ChatPanelProps {
  projectId: string;
  readOnly?: boolean;
}

/** Full chat tab: thread + composer, wired to the live chat API + SSE (spec/04-features.md §6, spec/06-ui-ux.md §3.5). */
export function ChatPanel({ projectId, readOnly }: ChatPanelProps) {
  const t = useTranslations("chat.panel");
  const { messages, loading, error, hasMore, loadMore, sendMessage, sending } = useChatThread(projectId);

  const items: ChatMessageItem[] = messages.map((m) => ({
    id: m.id,
    authorName: m.author.name,
    own: m.own,
    body: m.deleted ? t("deletedPlaceholder") : (m.body ?? ""),
    createdAt: m.createdAt,
    attachments: m.attachments.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
  }));

  const lastOwnMessage = [...messages].reverse().find((m) => m.own);
  const seenByOthers = !!lastOwnMessage && lastOwnMessage.readBy.some((r) => r.userId !== lastOwnMessage.author.id);

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      {hasMore && (
        <div className="flex justify-center border-b border-border py-2">
          <Button variant="ghost" size="sm" onClick={loadMore}>
            {t("loadOlder")}
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <ChatThread messages={items} seenLabel={seenByOthers ? t("seen") : undefined} />
        )}
      </div>
      {error && <p className="px-4 pb-2 text-xs text-destructive">{error}</p>}
      {readOnly ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">{t("archivedReadOnly")}</p>
      ) : (
        <MessageComposer onSend={(body, files) => void sendMessage(body, files)} disabled={sending} />
      )}
    </div>
  );
}
