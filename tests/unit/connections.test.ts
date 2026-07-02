import { afterEach, describe, expect, it } from "vitest";

/**
 * Per-user SSE connection registry (spec/02-architecture.md §5) — backs the "offline for
 * 5 minutes → email" rule in spec/04-features.md §6.
 */
const { registerConnection, isUserOnline, wasRecentlyOnline, touchConnection } = await import(
  "@/features/notifications/server/connections"
);

afterEach(() => {
  // Best-effort cleanup: deregister anything a test forgot to clean up, by re-importing
  // fresh state isn't possible (module-level Map), so tests use unique user ids instead.
});

describe("registerConnection / isUserOnline", () => {
  it("is online after registering a connection", () => {
    const userId = "user-online-1";
    expect(isUserOnline(userId)).toBe(false);
    const deregister = registerConnection(userId);
    expect(isUserOnline(userId)).toBe(true);
    deregister();
  });

  it("goes offline after the single connection is deregistered", () => {
    const userId = "user-online-2";
    const deregister = registerConnection(userId);
    expect(isUserOnline(userId)).toBe(true);
    deregister();
    expect(isUserOnline(userId)).toBe(false);
  });

  it("stays online while at least one of multiple connections (tabs) remains open", () => {
    const userId = "user-online-3";
    const deregisterA = registerConnection(userId);
    const deregisterB = registerConnection(userId);

    deregisterA();
    expect(isUserOnline(userId)).toBe(true);

    deregisterB();
    expect(isUserOnline(userId)).toBe(false);
  });
});

describe("wasRecentlyOnline", () => {
  it("is false for a user who was never registered", () => {
    expect(wasRecentlyOnline("never-seen-user", 5 * 60 * 1000)).toBe(false);
  });

  it("is true immediately after registering, within the threshold", () => {
    const userId = "user-recent-1";
    const deregister = registerConnection(userId);
    touchConnection(userId);
    expect(wasRecentlyOnline(userId, 5 * 60 * 1000)).toBe(true);
    deregister();
  });

  it("is false once the connection is deregistered (count drops to 0)", () => {
    const userId = "user-recent-2";
    const deregister = registerConnection(userId);
    deregister();
    expect(wasRecentlyOnline(userId, 5 * 60 * 1000)).toBe(false);
  });
});
