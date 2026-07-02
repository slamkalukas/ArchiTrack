import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError, apiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import { updateContactSchema } from "@/features/projects";

/** PATCH /api/contacts/:id — ADMIN only (spec/05-api.md §2). */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const existing = await db.contact.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing) {
      return apiError(404, "not_found", "Not found");
    }
    const { user } = await requireProjectAccess(existing.projectId, "ADMIN");
    const body = updateContactSchema.parse(await request.json());

    const contact = await db.$transaction(async (tx) => {
      const updated = await tx.contact.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.email !== undefined ? { email: body.email || null } : {}),
          ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
          ...(body.note !== undefined ? { note: body.note || null } : {}),
        },
      });
      await logActivity(
        { projectId: existing.projectId, actorId: user.id, action: "contact.updated", entityId: id },
        tx,
      );
      return updated;
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/contacts/:id — ADMIN only. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await context.params;

    const existing = await db.contact.findUnique({ where: { id }, select: { projectId: true } });
    if (!existing) {
      return apiError(404, "not_found", "Not found");
    }
    const { user } = await requireProjectAccess(existing.projectId, "ADMIN");

    await db.$transaction(async (tx) => {
      await tx.contact.delete({ where: { id } });
      await logActivity(
        { projectId: existing.projectId, actorId: user.id, action: "contact.deleted", entityId: id },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return apiError(
        409,
        "contact_in_use",
        "This contact is still assigned to a task and cannot be deleted.",
      );
    }
    return handleApiError(error);
  }
}
