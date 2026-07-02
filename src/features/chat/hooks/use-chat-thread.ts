"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveEvents } from "@/features/notifications/hooks/use-live-events";

/** API shape returned by GET/POST /api/projects/:id/chat (src/features/chat/server/serialize.ts). */
export interface ChatApiMessage {
  id: string;
  projectId: string;
  author: { id: string; name: string; avatarUrl: string | null; role: "ADMIN" | "CLIENT" };
  own: boolean;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  attachments: { id: string; name: string; kind: "pdf" | "image" | "doc" | "other"; sizeBytes: number }[];
  readBy: { userId: string; readAt: string }[];
}

interface UseChatThreadResult {
  messages: ChatApiMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  sendMessage: (body: string, files: File[]) => Promise<void>;
  sending: boolean;
}

/** Data-fetching + realtime hook for a project's chat thread (spec/04-features.md §6). */
export function useChatThread(projectId: string): UseChatThreadResult {
  const [messages, setMessages] = useState<ChatApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const latestIdRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/projects/${projectId}/chat?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load chat");
      return (await res.json()) as { items: ChatApiMessage[]; nextCursor: string | null };
    },
    [projectId],
  );

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    void (async () => {
      try {
        const { items, nextCursor: cursor } = await fetchPage(nextCursor);
        setMessages((prev) => [...[...items].reverse(), ...prev]);
        setNextCursor(cursor);
      } catch {
        // Silently ignore — pagination failures aren't fatal, user can retry via scroll.
      }
    })();
  }, [fetchPage, nextCursor]);

  const refetchLatest = useCallback(async () => {
    try {
      const { items } = await fetchPage();
      const ordered = [...items].reverse();
      setMessages((prev) => mergeMessages(prev, ordered));
      latestIdRef.current = ordered.at(-1)?.id ?? latestIdRef.current;
    } catch {
      // best-effort refresh
    }
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { items, nextCursor: cursor } = await fetchPage();
        if (cancelled) return;
        // API returns newest-first; thread UI wants oldest-first.
        const ordered = [...items].reverse();
        setMessages(ordered);
        setNextCursor(cursor);
        latestIdRef.current = ordered.at(-1)?.id ?? null;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  useLiveEvents({
    filter: ["chat.message"],
    onEvent: (event) => {
      if (event.name !== "chat.message") return;
      if (event.payload.projectId !== projectId) return;
      void refetchLatest();
    },
    onFocus: () => {
      void refetchLatest();
    },
  });

  const sendMessage = useCallback(
    async (body: string, files: File[]) => {
      setSending(true);
      setError(null);
      try {
        let res: Response;
        if (files.length > 0) {
          const form = new FormData();
          form.set("body", body);
          for (const file of files) form.append("files", file);
          res = await fetch(`/api/projects/${projectId}/chat`, { method: "POST", body: form });
        } else {
          res = await fetch(`/api/projects/${projectId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
          });
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error?.message ?? "Failed to send message");
        }
        const { item } = (await res.json()) as { item: ChatApiMessage };
        setMessages((prev) => [...prev, item]);
        latestIdRef.current = item.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
        throw e;
      } finally {
        setSending(false);
      }
    },
    [projectId],
  );

  // Mark read whenever the latest message changes (best-effort, fire-and-forget).
  useEffect(() => {
    const lastMessageId = latestIdRef.current;
    if (!lastMessageId) return;
    void fetch(`/api/projects/${projectId}/chat/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastMessageId }),
    }).catch(() => {});
  }, [projectId, messages.length]);

  return {
    messages,
    loading,
    error,
    hasMore: !!nextCursor,
    loadMore,
    sendMessage,
    sending,
  };
}

function mergeMessages(prev: ChatApiMessage[], fresh: ChatApiMessage[]): ChatApiMessage[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of fresh) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
