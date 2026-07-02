"use client";

import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/shared/notification-bell";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";

/**
 * Wires the shared `NotificationBell` (WP-2) to live data: fetch, SSE live-update, and
 * mark-all-read. Opening the dropdown marks every currently-listed notification as read
 * (spec/04-features.md §9: "mark read, mark all read" — simplest UX for v1 given only
 * two parties per project).
 */
export function NotificationBellContainer() {
  const t = useTranslations("notifications.kinds");
  const { items, markAllRead } = useNotifications((titleKey) => translateTitleKey(t, titleKey));

  return (
    <div onClick={() => void markAllRead()} className="contents">
      <NotificationBell items={items} />
    </div>
  );
}

function translateTitleKey(t: ReturnType<typeof useTranslations>, titleKey: string): string {
  const key = titleKey.replace(/^notifications\./, "");
  try {
    return t(key as never);
  } catch {
    return titleKey;
  }
}
