import type { NextRequest } from "next/server";
import { handleCreateComment, handleListComments } from "@/features/comments/server/route-helpers";

/** GET/POST /api/files/:id/comments — spec/05-api.md §6. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleListComments("file", id);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleCreateComment(request, "file", id);
}
