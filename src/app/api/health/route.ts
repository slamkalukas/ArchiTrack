import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health — public. Used by the Docker Compose healthcheck
 * (spec/02-architecture.md §7). Reports app liveness and DB reachability.
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    console.error("[health] db check failed", error);
  }

  const ok = dbOk;
  return NextResponse.json({ ok, db: dbOk }, { status: ok ? 200 : 503 });
}
