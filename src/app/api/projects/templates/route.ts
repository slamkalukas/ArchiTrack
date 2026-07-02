import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { handleApiError } from "@/lib/api-error";
import { listTemplates, getTemplateForWizard } from "@/features/projects";

/**
 * GET /api/projects/templates — ADMIN only. Not in spec/05-api.md's table explicitly,
 * but the creation wizard (spec/04-features.md §3: "template selection… prune template
 * phases/tasks in step 2") needs to list templates and fetch one with full phase/task
 * detail for the pruning checkboxes. `?id=` returns the detail shape; omitted returns the
 * picker list.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const id = new URL(request.url).searchParams.get("id");

    if (id) {
      const template = await getTemplateForWizard(id);
      return NextResponse.json({ template });
    }

    const templates = await listTemplates();
    return NextResponse.json({ items: templates });
  } catch (error) {
    return handleApiError(error);
  }
}
