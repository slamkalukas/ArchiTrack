import "server-only";

/**
 * Per-user SSE connection registry (spec/02-architecture.md §5, spec/05-api.md §7).
 * The `GET /api/events` route handler registers/unregisters connections here; other
 * server code (notification fan-out) reads it to decide "is this user online right now"
 * for the offline-email-after-5-minutes rule (spec/04-features.md §6, §9).
 *
 * Single app container ⇒ plain in-memory Map is sufficient (mirrors src/lib/events.ts).
 */

interface ConnectionRecord {
  /** Number of simultaneous open tabs/SSE connections for this user. */
  count: number;
  lastSeenAt: number;
}

const globalForConnections = globalThis as unknown as {
  sseConnections: Map<string, ConnectionRecord> | undefined;
};

const connections: Map<string, ConnectionRecord> =
  globalForConnections.sseConnections ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForConnections.sseConnections = connections;
}

/** Register that `userId` opened an SSE connection. Returns a cleanup function to call on close. */
export function registerConnection(userId: string): () => void {
  const existing = connections.get(userId);
  connections.set(userId, {
    count: (existing?.count ?? 0) + 1,
    lastSeenAt: Date.now(),
  });

  return () => {
    const current = connections.get(userId);
    if (!current) return;
    if (current.count <= 1) {
      connections.delete(userId);
    } else {
      connections.set(userId, { count: current.count - 1, lastSeenAt: Date.now() });
    }
  };
}

/** Touch the last-seen timestamp for a user (call on every heartbeat/event delivered). */
export function touchConnection(userId: string): void {
  const current = connections.get(userId);
  if (current) {
    current.lastSeenAt = Date.now();
  }
}

/** True if the user currently has at least one open SSE connection. */
export function isUserOnline(userId: string): boolean {
  return (connections.get(userId)?.count ?? 0) > 0;
}

/**
 * True if the user has been online (had an open connection) within the last `withinMs`.
 * Used for the "offline for 5 minutes" email-notification rule — a user is treated as
 * reachable in-app if they have a live connection right now.
 */
export function wasRecentlyOnline(userId: string, withinMs: number): boolean {
  const record = connections.get(userId);
  if (!record || record.count <= 0) return false;
  return Date.now() - record.lastSeenAt <= withinMs;
}
