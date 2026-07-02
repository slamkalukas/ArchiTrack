import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Template application: creates phases, tasks, and the folder tree from a
 * `ProjectTemplate` (spec/04-features.md §3 AC, spec/01-domain-analysis.md §2.3).
 *
 * Folder tree rules mirrored from `prisma/seed.ts` (the reference implementation for the
 * demo project):
 *   - one folder per phase (client-visible name from the template), except the
 *     "professions" phase which instead gets sub-folders per task under a "Profesie" root,
 *   - pruning a task removes it from the created set; if pruning empties out a
 *     profession's would-be folder, that folder is simply never created (rather than
 *     tracking phase folders that end up with zero tasks — a phase folder with no
 *     documents yet is still useful as a destination, so phase folders are always
 *     created even if all their tasks were pruned).
 */

const PROFESSIONS_TEMPLATE_KEY = "sk_house.professions";

export interface ApplyTemplateInput {
  projectId: string;
  templateId: string;
  /** TaskTemplate ids to skip (wizard step 2 pruning checkboxes). */
  prunedTaskTemplateIds: string[];
}

export async function applyTemplate(
  { projectId, templateId, prunedTaskTemplateIds }: ApplyTemplateInput,
  tx: Prisma.TransactionClient,
): Promise<{ phaseCount: number; taskCount: number }> {
  const template = await tx.projectTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { phases: { include: { tasks: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  });

  const pruned = new Set(prunedTaskTemplateIds);
  let taskCount = 0;

  const professionsFolder =
    template.phases.some((p) => p.key === PROFESSIONS_TEMPLATE_KEY)
      ? await tx.folder.create({
          data: { projectId, name: "Profesie", order: 4, visibility: "INTERNAL" },
        })
      : null;

  for (const [phaseIndex, phaseTemplate] of template.phases.entries()) {
    const keptTasks = phaseTemplate.tasks.filter((task) => !pruned.has(task.id));
    const isProfessionsPhase = phaseTemplate.key === PROFESSIONS_TEMPLATE_KEY;

    const phase = await tx.phase.create({
      data: {
        projectId,
        name: phaseTemplate.nameSk,
        templateKey: phaseTemplate.key,
        order: phaseIndex + 1,
        weight: phaseTemplate.weight,
        description: phaseTemplate.descriptionSk,
        status: phaseIndex === 0 ? "ACTIVE" : "UPCOMING",
        visibility: "CLIENT_VISIBLE",
      },
    });

    // Phase folder (not for the professions phase, which uses per-task sub-folders instead).
    if (!isProfessionsPhase) {
      await tx.folder.create({
        data: {
          projectId,
          name: phaseTemplate.nameSk,
          order: phaseIndex + 1,
          visibility: "INTERNAL",
        },
      });
    }

    for (const [taskIndex, taskTemplate] of keptTasks.entries()) {
      await tx.task.create({
        data: {
          phaseId: phase.id,
          title: taskTemplate.titleSk,
          order: taskIndex + 1,
          milestone: taskTemplate.milestone,
          assigneeType: taskTemplate.assigneeType,
          visibility: taskTemplate.defaultVisibility,
        },
      });
      taskCount += 1;

      if (isProfessionsPhase && professionsFolder) {
        await tx.folder.create({
          data: {
            projectId,
            parentId: professionsFolder.id,
            name: taskTemplate.titleSk,
            order: taskIndex + 1,
            visibility: "INTERNAL",
          },
        });
      }
    }
  }

  return { phaseCount: template.phases.length, taskCount };
}

/** System folders every project gets regardless of template (spec/03-data-model.md, prisma/seed.ts). */
export async function createSystemFolders(projectId: string, tx: Prisma.TransactionClient): Promise<void> {
  await tx.folder.create({
    data: {
      projectId,
      name: "Od klienta",
      order: 100,
      systemKey: "from_client",
      visibility: "CLIENT_VISIBLE",
    },
  });
  await tx.folder.create({
    data: {
      projectId,
      name: "Chat",
      order: 101,
      systemKey: "chat",
      visibility: "CLIENT_VISIBLE",
    },
  });
}

/** For the wizard's step-2 pruning UI: full template shape with phases/tasks. */
export async function getTemplateForWizard(templateId: string) {
  return db.projectTemplate.findUnique({
    where: { id: templateId },
    include: {
      phases: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export async function listTemplates() {
  return db.projectTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
