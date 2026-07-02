import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findUniqueProjectMock, findUniqueMemberMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueProjectMock: vi.fn(),
  findUniqueMemberMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: { findUnique: findUniqueProjectMock },
    projectMember: { findUnique: findUniqueMemberMock },
  },
}));

const { AuthzError, requireProjectAccess, requireRole, requireUser, hasProjectAccess } = await import(
  "@/lib/authz"
);

const ADMIN_USER = { id: "admin-1", email: "admin@architrack.local", name: "Admin", role: "ADMIN", locale: "sk" };
const CLIENT_USER = { id: "client-1", email: "client@architrack.local", name: "Client", role: "CLIENT", locale: "sk" };

beforeEach(() => {
  authMock.mockReset();
  findUniqueProjectMock.mockReset();
  findUniqueMemberMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("throws a 401 AuthzError when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("returns the session user when authenticated", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    await expect(requireUser()).resolves.toEqual(ADMIN_USER);
  });
});

describe("requireRole", () => {
  it("throws a 404 AuthzError when the role does not match (never 403 — don't leak existence)", async () => {
    authMock.mockResolvedValue({ user: CLIENT_USER });
    await expect(requireRole("ADMIN")).rejects.toMatchObject({ status: 404 });
  });

  it("returns the user when the role matches", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    await expect(requireRole("ADMIN")).resolves.toEqual(ADMIN_USER);
  });
});

describe("requireProjectAccess", () => {
  it("throws 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireProjectAccess("project-1")).rejects.toMatchObject({ status: 401 });
  });

  it("grants ADMIN access to any existing project", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    findUniqueProjectMock.mockResolvedValue({ id: "project-1" });

    await expect(requireProjectAccess("project-1")).resolves.toEqual({ user: ADMIN_USER });
    expect(findUniqueMemberMock).not.toHaveBeenCalled();
  });

  it("throws 404 when ADMIN requests a non-existent project", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    findUniqueProjectMock.mockResolvedValue(null);

    await expect(requireProjectAccess("missing-project")).rejects.toMatchObject({ status: 404 });
  });

  it("grants CLIENT access only when a ProjectMember row exists", async () => {
    authMock.mockResolvedValue({ user: CLIENT_USER });
    findUniqueMemberMock.mockResolvedValue({ projectId: "project-1" });

    await expect(requireProjectAccess("project-1")).resolves.toEqual({ user: CLIENT_USER });
  });

  it("throws 404 (not 403) when CLIENT is not a member — deny-by-default, no existence leak", async () => {
    authMock.mockResolvedValue({ user: CLIENT_USER });
    findUniqueMemberMock.mockResolvedValue(null);

    await expect(requireProjectAccess("other-project")).rejects.toMatchObject({ status: 404 });
    expect(findUniqueProjectMock).not.toHaveBeenCalled();
  });

  it("throws 404 when an explicit role restriction is violated, before checking membership", async () => {
    authMock.mockResolvedValue({ user: CLIENT_USER });

    await expect(requireProjectAccess("project-1", "ADMIN")).rejects.toMatchObject({ status: 404 });
    expect(findUniqueMemberMock).not.toHaveBeenCalled();
    expect(findUniqueProjectMock).not.toHaveBeenCalled();
  });

  it("allows ADMIN through an explicit ADMIN role restriction", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    findUniqueProjectMock.mockResolvedValue({ id: "project-1" });

    await expect(requireProjectAccess("project-1", "ADMIN")).resolves.toEqual({ user: ADMIN_USER });
  });
});

describe("hasProjectAccess", () => {
  it("returns true instead of throwing when access is granted", async () => {
    authMock.mockResolvedValue({ user: ADMIN_USER });
    findUniqueProjectMock.mockResolvedValue({ id: "project-1" });

    await expect(hasProjectAccess("project-1")).resolves.toBe(true);
  });

  it("returns false instead of throwing when access is denied", async () => {
    authMock.mockResolvedValue({ user: CLIENT_USER });
    findUniqueMemberMock.mockResolvedValue(null);

    await expect(hasProjectAccess("project-1")).resolves.toBe(false);
  });
});

describe("AuthzError", () => {
  it("carries the HTTP status it was constructed with", () => {
    const error = new AuthzError(404, "Not found");
    expect(error.status).toBe(404);
    expect(error.name).toBe("AuthzError");
    expect(error.message).toBe("Not found");
  });
});
