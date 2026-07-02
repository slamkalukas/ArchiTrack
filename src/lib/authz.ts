import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * Thrown by `requireProjectAccess` / `requireRole` when the caller is not authenticated
 * or not authorized. Route handlers should catch this (or let it bubble to a shared
 * wrapper) and respond 404 for "exists but you may not know it exists" per
 * spec/05-api.md, or 401 when there is no session at all.
 */
export class AuthzError extends Error {
  status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = "AuthzError";
    this.status = status;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: "sk" | "en";
}

/**
 * Resolve the current session user, or throw a 401 AuthzError.
 * Single choke point — every authenticated route handler should call this (directly or
 * via `requireProjectAccess`) rather than reading the session ad hoc.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    throw new AuthzError(401, "Not authenticated");
  }
  return user as SessionUser;
}

/**
 * Require the current user to have the given global role (e.g. ADMIN-only endpoints
 * that are not scoped to a single project, such as project creation).
 */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    throw new AuthzError(404, "Not found");
  }
  return user;
}

/**
 * The single authorization choke point for project-scoped resources
 * (spec/02-architecture.md §4.1). Verifies:
 *   - the caller is authenticated,
 *   - ADMIN always has access to every project,
 *   - CLIENT must have a ProjectMember row for this exact project,
 *   - an optional `role` further restricts to that role only (e.g. ADMIN-only mutations).
 *
 * Always throws 404 (never 403) on denial so a CLIENT probing another project's id
 * cannot distinguish "exists but not yours" from "does not exist".
 */
export async function requireProjectAccess(
  projectId: string,
  role?: Role,
): Promise<{ user: SessionUser }> {
  const user = await requireUser();

  if (role && user.role !== role) {
    throw new AuthzError(404, "Not found");
  }

  if (user.role === "ADMIN") {
    const exists = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!exists) {
      throw new AuthzError(404, "Not found");
    }
    return { user };
  }

  const membership = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { projectId: true },
  });

  if (!membership) {
    throw new AuthzError(404, "Not found");
  }

  return { user };
}

/** True if the given project id is one the current user may access (no throw). */
export async function hasProjectAccess(projectId: string): Promise<boolean> {
  try {
    await requireProjectAccess(projectId);
    return true;
  } catch {
    return false;
  }
}
