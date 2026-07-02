import { useTranslations } from "next-intl";
import { FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { dayKey } from "@/components/shared/date-helpers";
import type { ChatMessageItem } from "@/components/shared/types";

interface ChatThreadProps {
  messages: ChatMessageItem[];
  seenLabel?: string;
  className?: string;
}

const ATTACHMENT_ICON: Record<
  NonNullable<ChatMessageItem["attachments"]>[number]["kind"],
  typeof FileText
> = {
  pdf: FileText,
  image: ImageIcon,
  doc: FileText,
  other: FileIcon,
};

/** Classic thread: right-aligned own messages on accent-soft, day separators, "Seen" marker. */
export function ChatThread({ messages, seenLabel, className }: ChatThreadProps) {
  const t = useTranslations("ui.chat");

  if (messages.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        className={className}
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {messages.map((message, i) => {
        const showDaySeparator =
          i === 0 || dayKey(message.createdAt) !== dayKey(messages[i - 1].createdAt);
        const isLast = i === messages.length - 1;

        return (
          <div key={message.id} className="flex flex-col gap-1">
            {showDaySeparator && (
              <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {new Date(message.createdAt).toLocaleDateString()}
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div className={cn("flex flex-col gap-1", message.own ? "items-end" : "items-start")}>
              {!message.own && (
                <span className="px-1 text-xs text-muted-foreground">{message.authorName}</span>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  message.own
                    ? "rounded-br-sm bg-[var(--accent-soft)] text-foreground"
                    : "rounded-bl-sm bg-secondary text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                {!!message.attachments?.length && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {message.attachments.map((att) => {
                      const Icon = ATTACHMENT_ICON[att.kind];
                      return (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                        >
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{att.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="px-1 text-[11px] text-muted-foreground">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isLast && message.own && seenLabel && (
                <span className="px-1 text-[11px] text-muted-foreground">{seenLabel}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
