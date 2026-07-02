import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { assertSameOrigin } from "@/lib/csrf";
import { runDailyDigest } from "@/features/notifications/server/digest";

/**
 * POST /api/notifications/digest — not in spec/05-api.md's table (internal/ops route).
 * Triggers the daily digest email run (spec/04-features.md §9: "daily digest at 07:00
 * server time"). No in-process scheduler exists in this codebase (spec/02-architecture.md
 * §7 only wires host cron for backups), so this route exists for a host `cron` entry
 * (e.g. `curl -X POST -u admin-session ...` or a future WP-8 scheduler) to call at 07:00.
 * ADMIN-only for now — deliberately conservative until an ops-specific auth mechanism
 * (shared secret) is introduced by WP-8/deployment tooling.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireRole("ADMIN");
    const result = await runDailyDigest();
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
