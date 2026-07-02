import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Comment visibility rules (spec/03-data-model.md §3.2, spec/04-features.md §7 AC:
 * "a client cannot comment on internal entities even by ID probing").
 */

const { findUniqueTaskMock, findUniqueFileMock, findUniqueFolderMock } = vi.hoisted(() => ({
  findUniqueTaskMock: vi.fn(),
  findUniqueFileMock: vi.fn(),
  findUniqueFolderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    task: { findUnique: findUniqueTaskMock },
    file: { findUnique: findUniqueFileMock },
    folder: { findUnique: findUniqueFolderMock },
  },
}));

const { isTaskClientVisible, isFileClientVisible, assertClientCanAccessSubject } = await import(
  "@/features/comments/server/visibility"
);

beforeEach(() => {
  findUniqueTaskMock.mockReset();
  findUniqueFileMock.mockReset();
  findUniqueFolderMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("isTaskClientVisible", () => {
  it("is true only when both the task and its phase are CLIENT_VISIBLE", async () => {
    findUniqueTaskMock.mockResolvedValue({
      visibility: "CLIENT_VISIBLE",
      deletedAt: null,
      phase: { visibility: "CLIENT_VISIBLE" },
    });
    await expect(isTaskClientVisible("task-1")).resolves.toBe(true);
  });

  it("is false when the task is CLIENT_VISIBLE but its phase is INTERNAL", async () => {
    findUniqueTaskMock.mockResolvedValue({
      visibility: "CLIENT_VISIBLE",
      deletedAt: null,
      phase: { visibility: "INTERNAL" },
    });
    await expect(isTaskClientVisible("task-1")).resolves.toBe(false);
  });

  it("is false when the task itself is INTERNAL even if the phase is visible", async () => {
    findUniqueTaskMock.mockResolvedValue({
      visibility: "INTERNAL",
      deletedAt: null,
      phase: { visibility: "CLIENT_VISIBLE" },
    });
    await expect(isTaskClientVisible("task-1")).resolves.toBe(false);
  });

  it("is false (deny-by-default) when the task does not exist — ID probing returns false, not an error", async () => {
    findUniqueTaskMock.mockResolvedValue(null);
    await expect(isTaskClientVisible("nonexistent")).resolves.toBe(false);
  });

  it("is false for a soft-deleted task", async () => {
    findUniqueTaskMock.mockResolvedValue({
      visibility: "CLIENT_VISIBLE",
      deletedAt: new Date(),
      phase: { visibility: "CLIENT_VISIBLE" },
    });
    await expect(isTaskClientVisible("task-1")).resolves.toBe(false);
  });
});

describe("isFileClientVisible", () => {
  it("is true when the file is CLIENT_VISIBLE and no ancestor folder is INTERNAL", async () => {
    findUniqueFileMock.mockResolvedValue({
      visibility: "CLIENT_VISIBLE",
      deletedAt: null,
      folderId: "folder-1",
    });
    findUniqueFolderMock.mockResolvedValueOnce({ visibility: "CLIENT_VISIBLE", parentId: null });

    await expect(isFileClientVisible("file-1")).resolves.toBe(true);
  });

  it("is false when the file itself is INTERNAL", async () => {
    findUniqueFileMock.mockResolvedValue({ visibility: "INTERNAL", deletedAt: null, folderId: null });
    await expect(isFileClientVisible("file-1")).resolves.toBe(false);
  });

  it("is false when any ancestor folder in the chain is INTERNAL, even if the file itself is CLIENT_VISIBLE", async () => {
    findUniqueFileMock.mockResolvedValue({
      visibility: "CLIENT_VISIBLE",
      deletedAt: null,
      folderId: "folder-child",
    });
    // Walk up: child folder is CLIENT_VISIBLE, but its parent is INTERNAL.
    findUniqueFolderMock
      .mockResolvedValueOnce({ visibility: "CLIENT_VISIBLE", parentId: "folder-parent" })
      .mockResolvedValueOnce({ visibility: "INTERNAL", parentId: null });

    await expect(isFileClientVisible("file-1")).resolves.toBe(false);
  });

  it("is false (deny-by-default) when the file does not exist", async () => {
    findUniqueFileMock.mockResolvedValue(null);
    await expect(isFileClientVisible("nonexistent")).resolves.toBe(false);
  });
});

describe("assertClientCanAccessSubject", () => {
  it("always allows ADMIN regardless of visibility", async () => {
    const allowed = await assertClientCanAccessSubject(
      { kind: "task", id: "task-1", projectId: "project-1" },
      "ADMIN",
    );
    expect(allowed).toBe(true);
    expect(findUniqueTaskMock).not.toHaveBeenCalled();
  });

  it("delegates to isTaskClientVisible for CLIENT + task subject", async () => {
    findUniqueTaskMock.mockResolvedValue({
      visibility: "INTERNAL",
      deletedAt: null,
      phase: { visibility: "CLIENT_VISIBLE" },
    });
    const allowed = await assertClientCanAccessSubject(
      { kind: "task", id: "task-1", projectId: "project-1" },
      "CLIENT",
    );
    expect(allowed).toBe(false);
  });
});
