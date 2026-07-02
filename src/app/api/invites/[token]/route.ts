import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, apiError } from "@/lib/api-error";

/**
 * GET /api/invites/:token — public.
 * Not explicitly listed in spec/05-api.md §1's table, but spec/06-ui-ux.md §3.1 requires
 * the invite screen to show the project name ("Boli ste pozvaní do projektu RD
 * Novákovci") and spec/07-agent-workplan.md tells WP-3 to add this "if spec/05-api.md
 * defines one" — the *behavior* is specified even though the route wasn't tabulated, and
 * WP-2 left the client-side hook ready (`auth.invite.description` with a `{projectName}`
 * placeholder). Deliberately minimal: only the info needed to render that heading, no
 * project internals, and the same status semantics as the accept endpoint so the UI can
 * reuse its existing invalid/expired/used copy.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;

    const invite = await db.invite.findUnique({
      where: { token },
      select: {
        usedAt: true,
        expiresAt: true,
        user: {
          select: {
            locale: true,
            memberships: {
              take: 1,
              orderBy: { addedAt: "asc" },
              select: { project: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!invite) {
      return apiError(404, "invite_invalid", "This invite is not valid.");
    }
    if (invite.usedAt) {
      return apiError(409, "invite_used", "This invite has already been used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return apiError(410, "invite_expired", "This invite has expired.");
    }

    return NextResponse.json({
      projectName: invite.user.memberships[0]?.project.name ?? null,
      locale: invite.user.locale,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
