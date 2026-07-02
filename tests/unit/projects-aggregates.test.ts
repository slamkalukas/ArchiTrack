import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `getDashboardProjects` (src/features/projects/server/aggregates.ts) —
 * spec/04-features.md §2 AC: cards show current phase, progress %, unread chat count,
 * next due task, and expiring/overdue badges, computed via grouped queries (no N+1).
 */

const {
  findManyProjectMock,
  groupByFileMock,
  findManyChatMock,
  groupByActivityMock,
  findManyFileVersionMock,
} = vi.hoisted(() => ({
  findManyProjectMock: vi.fn(),
  groupByFileMock: vi.fn(),
  findManyChatMock: vi.fn(),
  groupByActivityMock: vi.fn(),
  findManyFileVersionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findMany: findManyProjectMock },
    file: { groupBy: groupByFileMock },
    chatMessage: { findMany: findManyChatMock },
    activityLog: { groupBy: groupByActivityMock },
    fileVersion: { findMany: findManyFileVersionMock },
  },
}));

const { getDashboardProjects } = await import("@/features/projects/server/aggregates");

const BASE_PROJECT = {
  id: "project-1",
  name: "RD Novákovci",
  slug: "rd-novakovci",
  status: "ACTIVE" as const,
  coverImageId: null,
  createdAt: new Date("2026-01-01"),
  members: [
    { user: { id: "admin-1", name: "Architect", role: "ADMIN" } },
    { user: { id: "client-1", name: "Ján Novák", role: "CLIENT" } },
  ],
  phases: [
    {
      id: "phase-1",
      name: "Štúdia",
      status: "ACTIVE" as const,
      weight: 15,
      order: 1,
      tasks: [
        { id: "task-1", title: "Koncept", status: "DONE" as const, weight: 1, dueDate: null, deletedAt: null },
        {
          id: "task-2",
          title: "Prezentácia",
          status: "TODO" as const,
          weight: 1,
          dueDate: new Date("2026-08-01"),
          deletedAt: null,
        },
      ],
    },
  ],
};

beforeEach(() => {
  findManyProjectMock.mockReset();
  groupByFileMock.mockReset().mockResolvedValue([]);
  findManyChatMock.mockReset().mockResolvedValue([]);
  groupByActivityMock.mockReset().mockResolvedValue([]);
  findManyFileVersionMock.mockReset().mockResolvedValue([]);
});

describe("getDashboardProjects", () => {
  it("returns an empty array without any grouped-query calls when there are no projects", async () => {
    findManyProjectMock.mockResolvedValue([]);

    const result = await getDashboardProjects({ userId: "admin-1" });

    expect(result).toEqual([]);
    expect(groupByFileMock).not.toHaveBeenCalled();
    expect(findManyChatMock).not.toHaveBeenCalled();
  });

  it("computes progress, current phase name, client names, and next due task from a single project", async () => {
    findManyProjectMock.mockResolvedValue([BASE_PROJECT]);

    const [card] = await getDashboardProjects({ userId: "admin-1" });

    expect(card).toMatchObject({
      id: "project-1",
      phaseName: "Štúdia",
      clientNames: ["Ján Novák"],
      progress: 50, // 1 of 2 equally-weighted tasks done in the only (weight-15) phase
    });
    expect(card!.nextDueTask).toMatchObject({ id: "task-2", title: "Prezentácia" });
  });

  it("counts unread messages only for messages not authored by the viewer and without a read receipt", async () => {
    findManyProjectMock.mockResolvedValue([BASE_PROJECT]);
    findManyChatMock.mockResolvedValue([
      { id: "m1", projectId: "project-1", authorId: "client-1", reads: [] }, // unread
      { id: "m2", projectId: "project-1", authorId: "client-1", reads: [{ userId: "admin-1" }] }, // already read
      { id: "m3", projectId: "project-1", authorId: "admin-1", reads: [] }, // own message, never counted
    ]);

    const [card] = await getDashboardProjects({ userId: "admin-1" });

    expect(card!.unreadCount).toBe(1);
  });

  it("surfaces expiring-file and overdue-task counts from the grouped queries", async () => {
    const overdueProject = {
      ...BASE_PROJECT,
      phases: [
        {
          ...BASE_PROJECT.phases[0],
          tasks: [
            {
              id: "task-overdue",
              title: "Late",
              status: "TODO" as const,
              weight: 1,
              dueDate: new Date("2020-01-01"),
              deletedAt: null,
            },
          ],
        },
      ],
    };
    findManyProjectMock.mockResolvedValue([overdueProject]);
    groupByFileMock.mockResolvedValue([{ projectId: "project-1", _count: { _all: 2 } }]);

    const [card] = await getDashboardProjects({ userId: "admin-1" });

    expect(card!.overdueTaskCount).toBe(1);
    expect(card!.expiringFileCount).toBe(2);
  });

  it("excludes soft-deleted tasks from progress and overdue counts", async () => {
    const withDeleted = {
      ...BASE_PROJECT,
      phases: [
        {
          ...BASE_PROJECT.phases[0],
          tasks: [
            { id: "t1", title: "Kept", status: "DONE" as const, weight: 1, dueDate: null, deletedAt: null },
            {
              id: "t2",
              title: "Deleted overdue",
              status: "TODO" as const,
              weight: 1,
              dueDate: new Date("2020-01-01"),
              deletedAt: new Date("2026-01-01"),
            },
          ],
        },
      ],
    };
    findManyProjectMock.mockResolvedValue([withDeleted]);

    const [card] = await getDashboardProjects({ userId: "admin-1" });

    expect(card!.progress).toBe(100); // only the one non-deleted DONE task counts
    expect(card!.overdueTaskCount).toBe(0);
  });

  it("passes the status filter through to the project query (defaults to ACTIVE)", async () => {
    findManyProjectMock.mockResolvedValue([]);

    await getDashboardProjects({ userId: "admin-1" });
    expect(findManyProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );

    await getDashboardProjects({ userId: "admin-1", status: "ARCHIVED" });
    expect(findManyProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ARCHIVED" }) }),
    );
  });
});
