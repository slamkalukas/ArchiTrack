"use client";

import { useEffect, useRef } from "react";
import type { AppEvent, AppEventName } from "@/lib/events";

/**
 * Client hook for `GET /api/events` (spec/02-architecture.md §5, spec/05-api.md §7).
 * - Reconnects with exponential backoff (capped) on connection loss.
 * - Also refetches on window focus (`onFocus` callback) so any events missed while the
 *   tab was backgrounded/disconnected self-heal, per spec: "UI also refetches on window
 *   focus, so lost events self-heal."
 *
 * Usage:
 *   useLiveEvents({
 *     onEvent: (event) => { if (event.name === "chat.message") refetch(); },
 *     onFocus: () => refetch(),
 *   });
 */
export interface UseLiveEventsOptions {
  onEvent?: (event: AppEvent) => void;
  onFocus?: () => void;
  /** Only invoke onEvent for these event names; omit to receive all. */
  filter?: AppEventName[];
  enabled?: boolean;
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useLiveEvents(options: UseLiveEventsOptions = {}): void {
  const { onEvent, onFocus, filter, enabled = true } = options;
  const onEventRef = useRef(onEvent);
  const onFocusRef = useRef(onFocus);

  useEffect(() => {
    onEventRef.current = onEvent;
    onFocusRef.current = onFocus;
  });

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const eventNames: AppEventName[] = filter ?? [
      "chat.message",
      "notification.new",
      "task.updated",
      "file.added",
      "typing",
    ];

    function connect() {
      if (closed) return;
      source = new EventSource("/api/events");

      source.onopen = () => {
        backoff = INITIAL_BACKOFF_MS;
      };

      for (const name of eventNames) {
        source.addEventListener(name, (messageEvent) => {
          try {
            const payload = JSON.parse((messageEvent as MessageEvent).data);
            onEventRef.current?.({ name, payload } as AppEvent);
          } catch {
            // Ignore malformed events rather than crashing the listener.
          }
        });
      }

      source.onerror = () => {
        source?.close();
        if (closed) return;
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      };
    }

    connect();

    function handleFocus() {
      onFocusRef.current?.();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleFocus();
    });

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      window.removeEventListener("focus", handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filter/enabled intentionally control effect re-run; callbacks read via refs
  }, [enabled, filter?.join(",")]);
}
