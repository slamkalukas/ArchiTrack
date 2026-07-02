import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueFolderMock, findManyFolderMock } = vi.hoisted(() => ({
  findUniqueFolderMock: vi.fn(),
  findManyFolderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    folder: { findUnique: findUniqueFolderMock, findMany: findManyFolderMock },
  },
}));

const { isFolderChainVisible, isFileVisibleToClient, visibleFolderIdSet } = await import(
  "@/features/files/server/visibility"
);

beforeEach(() => {
  findUniqueFolderMock.mockReset();
  findManyFolderMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("isFolderChainVisible", () => {
  it("is true for root-level (no folder)", async () => {
    await expect(isFolderChainVisible(null)).resolves.toBe(true);
  });

  it("is true when a folder and all its ancestors are CLIENT_VISIBLE", async () => {
    findUniqueFolderMock
      .mockResolvedValueOnce({ visibility: "CLIENT_VISIBLE", parentId: "parent-1" })
      .mockResolvedValueOnce({ visibility: "CLIENT_VISIBLE", parentId: null });

    await expect(isFolderChainVisible("child-1")).resolves.toBe(true);
  });

  it("is false when the folder itself is INTERNAL", async () => {
    findUniqueFolderMock.mockResolvedValueOnce({ visibility: "INTERNAL", parentId: null });
    await expect(isFolderChainVisible("folder-1")).resolves.toBe(false);
  });

  it("is false when an ancestor is INTERNAL even if the folder itself is CLIENT_VISIBLE", async () => {
    findUniqueFolderMock
      .mockResolvedValueOnce({ visibility: "CLIENT_VISIBLE", parentId: "parent-1" })
      .mockResolvedValueOnce({ visibility: "INTERNAL", parentId: null });

    await expect(isFolderChainVisible("child-1")).resolves.toBe(false);
  });

  it("is false (deny-by-default) when a folder in the chain no longer exists", async () => {
    findUniqueFolderMock.mockResolvedValueOnce(null);
    await expect(isFolderChainVisible("missing")).resolves.toBe(false);
  });
});

describe("isFileVisibleToClient", () => {
  it("is false when the file's own visibility is INTERNAL, regardless of folder", async () => {
    await expect(
      isFileVisibleToClient({ visibility: "INTERNAL", folderId: null }),
    ).resolves.toBe(false);
    expect(findUniqueFolderMock).not.toHaveBeenCalled();
  });

  it("is true for a CLIENT_VISIBLE root file", async () => {
    await expect(
      isFileVisibleToClient({ visibility: "CLIENT_VISIBLE", folderId: null }),
    ).resolves.toBe(true);
  });

  it("is false when the file is CLIENT_VISIBLE but its folder is INTERNAL", async () => {
    findUniqueFolderMock.mockResolvedValueOnce({ visibility: "INTERNAL", parentId: null });
    await expect(
      isFileVisibleToClient({ visibility: "CLIENT_VISIBLE", folderId: "folder-1" }),
    ).resolves.toBe(false);
  });
});

describe("visibleFolderIdSet", () => {
  it("excludes a folder whose ancestor chain contains an INTERNAL folder", async () => {
    findManyFolderMock.mockResolvedValueOnce([
      { id: "profesie", parentId: null, visibility: "INTERNAL" },
      { id: "statika", parentId: "profesie", visibility: "CLIENT_VISIBLE" },
      { id: "od-klienta", parentId: null, visibility: "CLIENT_VISIBLE" },
    ]);

    const visible = await visibleFolderIdSet("project-1");
    expect(visible.has("od-klienta")).toBe(true);
    expect(visible.has("profesie")).toBe(false);
    // "statika" is CLIENT_VISIBLE itself but its parent "profesie" is INTERNAL — must be excluded.
    expect(visible.has("statika")).toBe(false);
  });

  it("does not infinite-loop on a (defensively impossible) cycle", async () => {
    findManyFolderMock.mockResolvedValueOnce([
      { id: "a", parentId: "b", visibility: "CLIENT_VISIBLE" },
      { id: "b", parentId: "a", visibility: "CLIENT_VISIBLE" },
    ]);

    const visible = await visibleFolderIdSet("project-1");
    expect(visible.size).toBe(0);
  });
});
