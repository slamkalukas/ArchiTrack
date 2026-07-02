import { NextResponse } from "next/server";
import { requireUser, AuthzError, hasProjectAccess } from "@/lib/authz";
import { eventBus, type AppEvent } from "@/lib/events";
import { registerConnection, touchConnection } from "@/features/notifications/server/connections";

/**
 * GET /api/events — spec/05-api.md §7, spec/02-architecture.md §5.
 * Server-Sent Events endpoint. One long-lived connection per browser tab; the server
 * keeps a per-user connection registry (features/notifications/server/connections.ts)
 * and relays events published on the in-process event bus (src/lib/events.ts), filtered
 * server-side to what the requesting user may see:
 *   - `notification.new`: only if it's addressed to this exact user.
 *   - `chat.message` / `task.updated` / `file.added` / `typing`: only if the user has
 *     access to the event's projectId (requireProjectAccess semantics, deny-by-default).
 *
 * Sends a `retry:` hint and periodic `: keep-alive` comments so the connection survives
 * proxies/load balancers (Caddy `flush_interval -1` per spec/02-architecture.md §3).
 */
export const dynamic = "force-dynamic";

const KEEP_ALIVE_MS = 20_000;

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: { code: "unauthorized", message: error.message } }, { status: error.status });
    }
    throw error;
  }

  const userId = user.id;
  const encoder = new TextEncoder();

  // Cache of projectId -> access decision for this connection's lifetime, so we don't
  // re-query membership on every single event when several arrive for the same project.
  const accessCache = new Map<string, boolean>();
  async function canSeeProject(projectId: string | undefined): Promise<boolean> {
    if (!projectId) return true;
    const cached = accessCache.get(projectId);
    if (cached !== undefined) return cached;
    const allowed = await hasProjectAccess(projectId);
    accessCache.set(projectId, allowed);
    return allowed;
  }

  let unsubscribe: (() => void) | undefined;
  let deregister: (() => void) | undefined;
  let keepAliveTimer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // Retry hint for the browser's built-in EventSource reconnect, plus an initial
      // comment so proxies flush the response headers immediately.
      controller.enqueue(encoder.encode(`retry: 3000\n: connected\n\n`));

      deregister = registerConnection(userId);

      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          touchConnection(userId);
        } catch {
          // Controller already closed; the client 'close' handler below will clean up.
        }
      }, KEEP_ALIVE_MS);

      unsubscribe = eventBus.subscribe((event: AppEvent) => {
        void handleEvent(event);
      });

      async function handleEvent(event: AppEvent) {
        touchConnection(userId);

        if (event.name === "notification.new") {
          if (event.payload.userId !== userId) return;
          send("notification.new", event.payload);
          return;
        }

        // chat.message / task.updated / file.added / typing all carry projectId.
        const projectId = "projectId" in event.payload ? event.payload.projectId : undefined;
        const visible = await canSeeProject(projectId);
        if (!visible) return;
        send(event.name, event.payload);
      }
    },
    cancel() {
      unsubscribe?.();
      deregister?.();
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
