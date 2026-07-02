import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mkdirMock,
  findFirstFolderMock,
  findFirstFileMock,
  fileCreateMock,
  fileVersionCreateMock,
  transactionMock,
  sharpToFileMock,
  sharpResizeMock,
  sharpWebpMock,
  sharpMock,
} = vi.hoisted(() => {
  const sharpToFileMock = vi.fn().mockResolvedValue(undefined);
  const sharpWebpMock = vi.fn();
  const sharpResizeMock = vi.fn();
  const sharpMock = vi.fn();
  sharpWebpMock.mockReturnValue({ toFile: sharpToFileMock });
  sharpResizeMock.mockReturnValue({ webp: sharpWebpMock });
  sharpMock.mockReturnValue({ resize: sharpResizeMock });

  return {
    mkdirMock: vi.fn().mockResolvedValue(undefined),
    findFirstFolderMock: vi.fn().mockResolvedValue(null),
    findFirstFileMock: vi.fn(),
    fileCreateMock: vi.fn(),
    fileVersionCreateMock: vi.fn(),
    transactionMock: vi.fn(),
    sharpToFileMock,
    sharpResizeMock,
    sharpWebpMock,
    sharpMock,
  };
});

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  rm: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 123 }),
}));

vi.mock("node:fs", () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  })),
}));

vi.mock("node:stream/promises", () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sharp", () => ({ default: sharpMock }));

vi.mock("@/lib/db", () => ({
  db: {
    folder: { findFirst: findFirstFolderMock },
    file: { findFirst: findFirstFileMock },
    $transaction: transactionMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mkdirMock.mockResolvedValue(undefined);
  findFirstFolderMock.mockResolvedValue(null);
  sharpToFileMock.mockResolvedValue(undefined);
  sharpWebpMock.mockReturnValue({ toFile: sharpToFileMock });
  sharpResizeMock.mockReturnValue({ webp: sharpWebpMock });
  sharpMock.mockReturnValue({ resize: sharpResizeMock });

  transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      file: { findFirst: findFirstFileMock, create: fileCreateMock },
      fileVersion: { create: fileVersionCreateMock },
    };
    return fn(tx);
  });
});

const { saveUpload, UploadRejectedError } = await import("@/lib/uploads");

describe("saveUpload — versioning (spec/03-data-model.md §3.4)", () => {
  it("creates version 1 for a brand-new file name", async () => {
    findFirstFileMock.mockResolvedValueOnce(null);
    fileCreateMock.mockResolvedValueOnce({ id: "file-1" });
    fileVersionCreateMock.mockImplementationOnce(async ({ data }: { data: { version: number } }) => ({
      id: "version-1",
      fileId: "file-1",
      ...data,
    }));

    const result = await saveUpload("project-1", "root-folder-id", {
      name: "plan.pdf",
      type: "application/pdf",
      buffer: Buffer.from("hello world"),
      uploadedBy: "user-1",
    });

    expect(result.version).toBe(1);
    expect(fileCreateMock).toHaveBeenCalledTimes(1);
  });

  it("creates version 2 when a file with the same name already exists in the folder", async () => {
    findFirstFileMock.mockResolvedValueOnce({
      id: "file-1",
      versions: [{ version: 1 }],
    });
    fileVersionCreateMock.mockImplementationOnce(async ({ data }: { data: { version: number } }) => ({
      id: "version-2",
      fileId: "file-1",
      ...data,
    }));

    const result = await saveUpload("project-1", "root-folder-id", {
      name: "plan.pdf",
      type: "application/pdf",
      buffer: Buffer.from("updated contents"),
      uploadedBy: "user-1",
    });

    expect(result.version).toBe(2);
    expect(fileCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type before touching disk or DB", async () => {
    await expect(
      saveUpload("project-1", "root-folder-id", {
        name: "virus.exe",
        type: "application/octet-stream",
        buffer: Buffer.from("x"),
        uploadedBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(UploadRejectedError);

    expect(mkdirMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit before touching disk or DB", async () => {
    const prevLimit = process.env.MAX_UPLOAD_MB;
    process.env.MAX_UPLOAD_MB = "1";
    // 2 MB buffer, 1 MB limit.
    const bigBuffer = Buffer.alloc(2 * 1024 * 1024);

    await expect(
      saveUpload("project-1", "root-folder-id", {
        name: "big.pdf",
        type: "application/pdf",
        buffer: bigBuffer,
        uploadedBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(UploadRejectedError);

    expect(mkdirMock).not.toHaveBeenCalled();
    process.env.MAX_UPLOAD_MB = prevLimit;
  });

  it("generates a thumbnail for thumbnailable image types", async () => {
    findFirstFileMock.mockResolvedValueOnce(null);
    fileCreateMock.mockResolvedValueOnce({ id: "file-1" });
    fileVersionCreateMock.mockImplementationOnce(async ({ data }: { data: { version: number } }) => ({
      id: "version-1",
      fileId: "file-1",
      ...data,
    }));

    await saveUpload("project-1", "root-folder-id", {
      name: "photo.jpg",
      type: "image/jpeg",
      buffer: Buffer.from("fake-image-bytes"),
      uploadedBy: "user-1",
    });

    expect(sharpMock).toHaveBeenCalledTimes(1);
    expect(sharpToFileMock).toHaveBeenCalledTimes(1);
    const thumbPath = sharpToFileMock.mock.calls[0][0] as string;
    expect(thumbPath).toMatch(/\.thumb\.webp$/);
  });

  it("does not attempt thumbnailing for non-image types", async () => {
    findFirstFileMock.mockResolvedValueOnce(null);
    fileCreateMock.mockResolvedValueOnce({ id: "file-1" });
    fileVersionCreateMock.mockImplementationOnce(async ({ data }: { data: { version: number } }) => ({
      id: "version-1",
      fileId: "file-1",
      ...data,
    }));

    await saveUpload("project-1", "root-folder-id", {
      name: "report.pdf",
      type: "application/pdf",
      buffer: Buffer.from("%PDF-1.4"),
      uploadedBy: "user-1",
    });

    expect(sharpMock).not.toHaveBeenCalled();
  });
});
