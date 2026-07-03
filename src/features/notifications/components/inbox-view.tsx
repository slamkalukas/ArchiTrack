"use client";

import Link from "next/link";
import { CheckCheck, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";

/**
 * Global admin Inbox page body (spec/04-features.md §2: "Global 'Inbox' panel: latest
 * notifications across projects"). Reuses the same data hook as the notification bell —
 * fetch + SSE live-update + mark-read — but renders a full-page list with per-project
 * links instead of a dropdown.
 */
export function InboxView() {
  const t = useTranslations("inbox");
  const tKinds = useTranslations("notifications.kinds");
  const { items, unreadCount, markAllRead, markRead } = useNotifications((titleKey) => {
    const key = titleKey.replace(/^notifications\./, "");
    try {
      return tKinds(key as never);
    } catch {
      return titleKey;
    }
  });

  if (items.length === 0) {
    return <EmptyState icon={<Inbox className="size-8" />} title={t("empty")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0 ? t("unreadCount", { count: unreadCount }) : t("allRead")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
        >
          <CheckCheck className="size-4" />
          {t("markAllRead")}
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => {
          const row = (
            <div
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors duration-150",
                item.href && "hover:bg-secondary/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", item.read ? "text-muted-foreground" : "font-medium text-foreground")}>
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.timeLabel}</p>
              </div>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} onClick={() => void markRead([item.id])}>
                  {row}
                </Link>
              ) : (
                <button type="button" className="w-full text-left" onClick={() => void markRead([item.id])}>
                  {row}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
