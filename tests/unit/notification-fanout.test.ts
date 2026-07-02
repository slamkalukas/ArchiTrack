import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Notification fan-out (spec/04-features.md §9, spec/05-api.md §9.1): writing rows,
 * publishing the SSE event, and gating immediate email by `emailDigest` preference.
 */

const {
  createNotificationMock,
  findUniqueNotificationMock,
  updateNotificationMock,
  findUniqueUserMock,
  publishMock,
  sendMailMock,
} = vi.hoisted(() => ({
  createNotificationMock: vi.fn(),
  findUniqueNotificationMock: vi.fn(),
  updateNotificationMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  publishMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      create: createNotificationMock,
      findUnique: findUniqueNotificationMock,
      update: updateNotificationMock,
    },
    user: { findUnique: findUniqueUserMock },
  },
}));

vi.mock("@/lib/events", () => ({
  eventBus: { publish: publishMock },
}));

vi.mock("@/lib/email", () => ({
  sendMail: sendMailMock,
  renderEmailLayout: (opts: { heading: string; bodyHtml: string }) =>
    `<html>${opts.heading}${opts.bodyHtml}</html>`,
}));

const { notifyUsers } = await import("@/features/notifications/server/notify");

const NOTIFICATION_ROW = {
  id: "notif-1",
  userId: "user-1",
  kind: "CHAT_MESSAGE" as const,
  projectId: "project-1",
  entityId: "msg-1",
  titleKey: "notifications.chatMessage",
  payload: null,
  readAt: null,
  emailedAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  createNotificationMock.mockReset().mockResolvedValue(NOTIFICATION_ROW);
  findUniqueNotificationMock.mockReset().mockResolvedValue(NOTIFICATION_ROW);
  updateNotificationMock.mockReset();
  findUniqueUserMock.mockReset();
  publishMock.mockReset();
  sendMailMock.mockReset().mockResolvedValue({ messageId: "dev" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("notifyUsers", () => {
  it("creates one Notification row per recipient and publishes notification.new for each", async () => {
    createNotificationMock.mockResolvedValueOnce({ ...NOTIFICATION_ROW, id: "n-1", userId: "user-1" });
    createNotificationMock.mockResolvedValueOnce({ ...NOTIFICATION_ROW, id: "n-2", userId: "user-2" });
    findUniqueUserMock.mockResolvedValue(null); // short-circuit email path for this assertion

    await notifyUsers([
      { userId: "user-1", kind: "CHAT_MESSAGE", projectId: "project-1", entityId: "msg-1", titleKey: "notifications.chatMessage" },
      { userId: "user-2", kind: "CHAT_MESSAGE", projectId: "project-1", entityId: "msg-1", titleKey: "notifications.chatMessage" },
    ]);

    expect(createNotificationMock).toHaveBeenCalledTimes(2);
    expect(publishMock).toHaveBeenCalledWith(
      "notification.new",
      expect.objectContaining({ userId: "user-1", entityId: "n-1" }),
    );
    expect(publishMock).toHaveBeenCalledWith(
      "notification.new",
      expect.objectContaining({ userId: "user-2", entityId: "n-2" }),
    );
  });

  it("does nothing for an empty recipient list", async () => {
    await notifyUsers([]);
    expect(createNotificationMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("sends an immediate email when the recipient's emailDigest preference is false (immediate mode)", async () => {
    findUniqueUserMock.mockResolvedValue({
      id: "user-1",
      email: "client@architrack.local",
      name: "Client",
      locale: "sk",
      emailDigest: false,
      isActive: true,
    });

    await notifyUsers([
      { userId: "user-1", kind: "CHAT_MESSAGE", projectId: "project-1", entityId: "msg-1", titleKey: "notifications.chatMessage" },
    ]);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "client@architrack.local" }));
    expect(updateNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { emailedAt: expect.any(Date) } }),
    );
  });

  it("does NOT send an immediate email when the recipient is on the daily digest (emailDigest = true)", async () => {
    findUniqueUserMock.mockResolvedValue({
      id: "user-2",
      email: "admin@architrack.local",
      name: "Admin",
      locale: "sk",
      emailDigest: true,
      isActive: true,
    });

    await notifyUsers([
      { userId: "user-2", kind: "CHAT_MESSAGE", projectId: "project-1", entityId: "msg-1", titleKey: "notifications.chatMessage" },
    ]);

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("does not email a deactivated user even if their preference is immediate", async () => {
    findUniqueUserMock.mockResolvedValue({
      id: "user-1",
      email: "client@architrack.local",
      name: "Client",
      locale: "sk",
      emailDigest: false,
      isActive: false,
    });

    await notifyUsers([
      { userId: "user-1", kind: "CHAT_MESSAGE", projectId: "project-1", entityId: "msg-1", titleKey: "notifications.chatMessage" },
    ]);

    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
