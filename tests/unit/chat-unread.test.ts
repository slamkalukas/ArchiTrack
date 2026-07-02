import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unread chat-count logic (spec/04-features.md §6 AC: "unread counts survive reload").
 * `getUnreadCount` = messages after the user's last ChatRead, excluding their own and
 * soft-deleted ones.
 */

const { findFirstChatReadMock, countChatMessageMock } = vi.hoisted(() => ({
  findFirstChatReadMock: vi.fn(),
  countChatMessageMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatRead: { findFirst: findFirstChatReadMock },
    chatMessage: { count: countChatMessageMock },
  },
}));

const { getUnreadCount } = await import("@/features/chat/server/messages");

beforeEach(() => {
  findFirstChatReadMock.mockReset();
  countChatMessageMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getUnreadCount", () => {
  it("counts all non-own, non-deleted messages when the user has never read anything", async () => {
    findFirstChatReadMock.mockResolvedValue(null);
    countChatMessageMock.mockResolvedValue(5);

    const count = await getUnreadCount("project-1", "user-1");

    expect(count).toBe(5);
    expect(countChatMessageMock).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        authorId: { not: "user-1" },
        deletedAt: null,
      },
    });
  });

  it("counts only messages created after the user's last read message", async () => {
    const lastReadAt = new Date("2026-07-01T10:00:00.000Z");
    findFirstChatReadMock.mockResolvedValue({
      message: { createdAt: lastReadAt },
    });
    countChatMessageMock.mockResolvedValue(2);

    const count = await getUnreadCount("project-1", "user-1");

    expect(count).toBe(2);
    expect(countChatMessageMock).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        authorId: { not: "user-1" },
        deletedAt: null,
        createdAt: { gt: lastReadAt },
      },
    });
  });

  it("orders by the read message's createdAt (newest first) so 'last read' is the most recent one", async () => {
    findFirstChatReadMock.mockResolvedValue(null);
    countChatMessageMock.mockResolvedValue(0);

    await getUnreadCount("project-1", "user-1");

    expect(findFirstChatReadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", message: { projectId: "project-1" } },
        orderBy: { message: { createdAt: "desc" } },
      }),
    );
  });
});
