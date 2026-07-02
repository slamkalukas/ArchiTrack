"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveEvents } from "@/features/notifications/hooks/use-live-events";

export interface CommentApiItem {
  id: string;
  author: { id: string; name: string; avatarUrl: string | null; role: "ADMIN" | "CLIENT" };
  body: string | null;
  deleted: boolean;
  createdAt: string;
  replies: {
    id: string;
    author: { id: string; name: string; avatarUrl: string | null; role: "ADMIN" | "CLIENT" };
    body: string | null;
    deleted: boolean;
    createdAt: string;
  }[];
}

interface UseCommentThreadResult {
  comments: CommentApiItem[];
  loading: boolean;
  error: string | null;
  post: (body: string, parentId?: string) => Promise<void>;
  posting: boolean;
}

/** Data hook for a task/file comment thread (spec/04-features.md §7). */
export function useCommentThread(subjectKind: "task" | "file", subjectId: string): UseCommentThreadResult {
  const [comments, setComments] = useState<CommentApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = `/api/${subjectKind === "task" ? "tasks" : "files"}/${subjectId}/comments`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load comments");
      const data = (await res.json()) as { items: CommentApiItem[] };
      setComments(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to load comments");
        const data = (await res.json()) as { items: CommentApiItem[] };
        if (!cancelled) setComments(data.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load comments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  useLiveEvents({
    filter: ["task.updated"],
    onEvent: (event) => {
      if (event.name !== "task.updated") return;
      if (event.payload.entityId !== subjectId) return;
      void load();
    },
    onFocus: () => void load(),
  });

  const post = useCallback(
    async (body: string, parentId?: string) => {
      setPosting(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, parentId }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error?.message ?? "Failed to post comment");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to post comment");
        throw e;
      } finally {
        setPosting(false);
      }
    },
    [endpoint, load],
  );

  return { comments, loading, error, post, posting };
}
