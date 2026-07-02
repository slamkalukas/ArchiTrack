import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireProjectAccess } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity";
import { assertSameOrigin } from "@/lib/csrf";
import { createContactSchema } from "@/features/projects";

/** GET /api/projects/:id/contacts — ADMIN only (spec/05-api.md §2). External parties: statik, geodet, úrady. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params;
    await requireProjectAccess(projectId, "ADMIN");

    const contacts = await db.contact.findMany({ where: { projectId }, orderBy: { name: "asc" } });
    return NextResponse.json({ items: contacts });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/projects/:id/contacts — ADMIN only. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id: projectId } = await context.params;
    const { user } = await requireProjectAccess(projectId, "ADMIN");
    const body = createContactSchema.parse(await request.json());

    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          projectId,
          name: body.name,
          role: body.role,
          email: body.email || null,
          phone: body.phone || null,
          note: body.note || null,
        },
      });
      await logActivity({ projectId, actorId: user.id, action: "contact.created", entityId: created.id }, tx);
      return created;
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
