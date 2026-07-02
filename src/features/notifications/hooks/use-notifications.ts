"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveEvents } from "@/features/notifications/hooks/use-live-events";
import type { NotificationItem } from "@/components/shared/notification-bell";

interface ApiNotification {
  id: string;
  kind: string;
  projectId: string | null;
  entityId: string | null;
  titleKey: string;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

interface UseNotificationsResult {
  items: NotificationItem[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  refresh: () => void;
}

/** Data hook for NotificationBell: fetch + live-update via SSE `notification.new`, plus mark-read actions. */
export function useNotifications(titleForKey: (titleKey: string, payload: unknown) => string): UseNotificationsResult {
  const [raw, setRaw] = useState<ApiNotification[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=30");
    if (!res.ok) return;
    const data = (await res.json()) as { items: ApiNotification[] };
    setRaw(data.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/notifications?limit=30");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items: ApiNotification[] };
      if (!cancelled) setRaw(data.items);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useLiveEvents({
    filter: ["notification.new"],
    onEvent: (event) => {
      if (event.name !== "notification.new") return;
      void load();
    },
    onFocus: () => void load(),
  });

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setRaw((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setRaw((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
  }, []);

  const items: NotificationItem[] = raw.map((n) => ({
    id: n.id,
    title: titleForKey(n.titleKey, n.payload),
    timeLabel: new Date(n.createdAt).toLocaleString(),
    read: n.read,
    href: n.projectId ? `/projects/${n.projectId}` : undefined,
  }));

  return {
    items,
    unreadCount: raw.filter((n) => !n.read).length,
    markAllRead,
    markRead,
    refresh: () => void load(),
  };
}
