import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { updateMyLocaleSchema } from "@/features/projects";

/**
 * PATCH /api/me/locale — minimal dedicated locale-persistence route.
 * Not separately tabulated in spec/05-api.md §8 (which lists a general `PATCH /api/me`),
 * but WP-2's `LocaleSwitcher` (`src/components/shared/locale-switcher.tsx`) already calls
 * this exact path + body shape as a "best-effort" persistence call documented as owned by
 * "the settings feature work package" — i.e. WP-3, per spec/07-agent-workplan.md's
 * explicit callout. Kept as a tiny dedicated endpoint (rather than routing through the
 * general `/api/me` PATCH) so the fire-and-forget call from the switcher stays a single
 * cheap field update.
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { locale } = updateMyLocaleSchema.parse(await request.json());

    await db.user.update({ where: { id: user.id }, data: { locale } });

    return NextResponse.json({ ok: true, locale });
  } catch (error) {
    return handleApiError(error);
  }
}
