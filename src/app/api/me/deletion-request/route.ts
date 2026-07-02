import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { requestAccountDeletion } from "@/features/portal/server/gdpr";

/**
 * POST /api/me/deletion-request — spec/04-features.md §12 GDPR account-deletion flow.
 * There is no self-service hard-delete in v1 (admin performs deactivate/anonymize per
 * spec/05-api.md §8's `POST /api/users/:id/deactivate|anonymize`); this route lets a
 * client formally request it, emailing every ADMIN so they can action it.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await requestAccountDeletion(user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
