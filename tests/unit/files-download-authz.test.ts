import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstFileMock, findUniqueFolderMock } = vi.hoisted(() => ({
  findFirstFileMock: vi.fn(),
  findUniqueFolderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    file: { findFirst: findFirstFileMock },
    folder: { findUnique: findUniqueFolderMock },
  },
}));

vi.mock("@/lib/uploads", () => ({
  deleteStoredFile: vi.fn(),
}));

vi.mock("@/lib/authz", () => {
  class AuthzError extends Error {
    status: 401 | 403 | 404;
    constructor(status: 401 | 403 | 404, message: string) {
      super(message);
      this.name = "AuthzError";
      this.status = status;
    }
  }
  return { AuthzError };
});

const { authorizeDownload } = await import("@/features/files/server/files");

const BASE_FILE = {
  id: "file-1",
  projectId: "project-1",
  folderId: null,
  name: "zmluva.pdf",
  visibility: "INTERNAL",
  versions: [
    { version: 1, storageKey: "key-1", mimeType: "application/pdf", size: 100 },
    { version: 2, storageKey: "key-2", mimeType: "application/pdf", size: 200 },
  ],
};

beforeEach(() => {
  findFirstFileMock.mockReset();
  findUniqueFolderMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("authorizeDownload — SECURITY CRITICAL (spec/02-architecture.md §4.2)", () => {
  it("ADMIN can download an INTERNAL file", async () => {
    findFirstFileMock.mockResolvedValueOnce({ ...BASE_FILE, versions: [BASE_FILE.versions[1]] });

    const result = await authorizeDownload("file-1", "project-1", "ADMIN");
    expect(result.storageKey).toBe("key-2");
    expect(result.fileName).toBe("zmluva.pdf");
  });

  it("CLIENT is denied (404) for an INTERNAL file, even though it exists and they're a project member", async () => {
    findFirstFileMock.mockResolvedValueOnce({ ...BASE_FILE, versions: [BASE_FILE.versions[1]] });

    await expect(authorizeDownload("file-1", "project-1", "CLIENT")).rejects.toMatchObject({ status: 404 });
  });

  it("CLIENT can download a CLIENT_VISIBLE root file", async () => {
    findFirstFileMock.mockResolvedValueOnce({
      ...BASE_FILE,
      visibility: "CLIENT_VISIBLE",
      versions: [BASE_FILE.versions[1]],
    });

    const result = await authorizeDownload("file-1", "project-1", "CLIENT");
    expect(result.storageKey).toBe("key-2");
  });

  it("CLIENT is denied when the file is CLIENT_VISIBLE but sits inside an INTERNAL folder", async () => {
    findFirstFileMock.mockResolvedValueOnce({
      ...BASE_FILE,
      visibility: "CLIENT_VISIBLE",
      folderId: "profesie",
      versions: [BASE_FILE.versions[1]],
    });
    findUniqueFolderMock.mockResolvedValueOnce({ visibility: "INTERNAL", parentId: null });

    await expect(authorizeDownload("file-1", "project-1", "CLIENT")).rejects.toMatchObject({ status: 404 });
  });

  it("CLIENT is denied even for an older version of a file that is currently CLIENT_VISIBLE if visibility check fails", async () => {
    // Defends "never see an INTERNAL file even via version history" (spec/04-features.md §5 AC).
    findFirstFileMock.mockResolvedValueOnce({
      ...BASE_FILE,
      visibility: "INTERNAL",
      versions: [BASE_FILE.versions[0]],
    });

    await expect(authorizeDownload("file-1", "project-1", "CLIENT", 1)).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when the file does not exist in this project (no existence leak)", async () => {
    findFirstFileMock.mockResolvedValueOnce(null);
    await expect(authorizeDownload("missing", "project-1", "ADMIN")).rejects.toMatchObject({ status: 404 });
  });

  it("throws 404 when the requested version does not exist", async () => {
    findFirstFileMock.mockResolvedValueOnce({ ...BASE_FILE, versions: [] });
    await expect(authorizeDownload("file-1", "project-1", "ADMIN", 99)).rejects.toMatchObject({ status: 404 });
  });

  it("defaults to the latest version when none is specified", async () => {
    findFirstFileMock.mockImplementationOnce(async (args: { include?: { versions?: unknown } }) => {
      // Simulate Prisma applying the `orderBy desc, take 1` from the real query shape.
      expect(args.include?.versions).toBeDefined();
      return { ...BASE_FILE, versions: [BASE_FILE.versions[1]] };
    });

    const result = await authorizeDownload("file-1", "project-1", "ADMIN");
    expect(result.storageKey).toBe("key-2");
  });
});
