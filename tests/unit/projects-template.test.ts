import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `applyTemplate` (src/features/projects/server/template.ts) — the core
 * of the creation wizard's "template selection + prune" step (spec/04-features.md §3 AC:
 * "applying the template creates phases, tasks, and the folder tree… pruning in the
 * wizard removes both tasks and their folders").
 *
 * `applyTemplate` takes a Prisma transaction client and reads the template through that
 * *same* client (`tx.projectTemplate.findUniqueOrThrow`, not the module-level `db`) so it
 * stays inside the caller's transaction — we fake just enough of a tx (a template lookup
 * plus create calls that record what they were asked to create) to assert on the shape of
 * the writes without a real database.
 */

vi.mock("@/lib/db", () => ({ db: {} }));

const { applyTemplate } = await import("@/features/projects/server/template");

interface FakeRecord {
  id: string;
  [key: string]: unknown;
}

function createFakeTx(template: unknown) {
  let idCounter = 0;
  const created: { model: string; data: Record<string, unknown> }[] = [];

  function record(model: string) {
    return {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter += 1;
        const row: FakeRecord = { id: `${model}-${idCounter}`, ...data };
        created.push({ model, data: row });
        return row;
      }),
    };
  }

  const tx = {
    projectTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue(template) },
    folder: record("folder"),
    phase: record("phase"),
    task: record("task"),
  };

  return { tx, created };
}

const TEMPLATE_FIXTURE = {
  id: "template-1",
  name: "Rodinný dom SK",
  phases: [
    {
      id: "phase-tmpl-1",
      key: "sk_house.brief_surveys",
      nameSk: "Zadanie a prieskumy",
      nameEn: "Brief & surveys",
      descriptionSk: "desc",
      descriptionEn: "desc",
      order: 1,
      weight: 5,
      tasks: [
        { id: "task-tmpl-1", titleSk: "Úvodné stretnutie", titleEn: "Client brief", order: 1, milestone: false, assigneeType: "ARCHITECT", defaultVisibility: "INTERNAL" },
        { id: "task-tmpl-2", titleSk: "Obhliadka pozemku", titleEn: "Site visit", order: 2, milestone: false, assigneeType: "ARCHITECT", defaultVisibility: "INTERNAL" },
      ],
    },
    {
      id: "phase-tmpl-2",
      key: "sk_house.professions",
      nameSk: "Profesie",
      nameEn: "Engineering professions",
      descriptionSk: "desc",
      descriptionEn: "desc",
      order: 2,
      weight: 20,
      tasks: [
        { id: "task-tmpl-3", titleSk: "Statika", titleEn: "Structural engineering", order: 1, milestone: false, assigneeType: "EXTERNAL", defaultVisibility: "INTERNAL" },
        { id: "task-tmpl-4", titleSk: "Vykurovanie", titleEn: "Heating", order: 2, milestone: false, assigneeType: "EXTERNAL", defaultVisibility: "INTERNAL" },
      ],
    },
  ],
};

describe("applyTemplate", () => {
  it("creates one phase per template phase, in order, with weight/status preserved", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    const result = await applyTemplate(
      { projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: [] },
      tx as never,
    );

    const phases = created.filter((c) => c.model === "phase");
    expect(phases).toHaveLength(2);
    expect(phases[0]!.data).toMatchObject({ name: "Zadanie a prieskumy", order: 1, weight: 5, status: "ACTIVE" });
    expect(phases[1]!.data).toMatchObject({ name: "Profesie", order: 2, weight: 20, status: "UPCOMING" });
    expect(result.phaseCount).toBe(2);
  });

  it("creates all tasks when nothing is pruned", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    const result = await applyTemplate(
      { projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: [] },
      tx as never,
    );

    const tasks = created.filter((c) => c.model === "task");
    expect(tasks).toHaveLength(4);
    expect(result.taskCount).toBe(4);
  });

  it("skips pruned tasks entirely — they are not created", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    const result = await applyTemplate(
      { projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: ["task-tmpl-2", "task-tmpl-4"] },
      tx as never,
    );

    const taskTitles = created.filter((c) => c.model === "task").map((c) => c.data.title);
    expect(taskTitles).toEqual(["Úvodné stretnutie", "Statika"]);
    expect(result.taskCount).toBe(2);
  });

  it("re-numbers the `order` of kept tasks within a phase after pruning (no gaps)", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    await applyTemplate(
      { projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: ["task-tmpl-1"] },
      tx as never,
    );

    const phase1Tasks = created.filter((c) => c.model === "task" && c.data.title === "Obhliadka pozemku");
    expect(phase1Tasks[0]!.data.order).toBe(1); // renumbered from 2 -> 1, not left as a gap
  });

  it("creates a phase folder for non-professions phases, and per-task sub-folders under 'Profesie' only for kept tasks", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    await applyTemplate(
      { projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: ["task-tmpl-4"] },
      tx as never,
    );

    const folders = created.filter((c) => c.model === "folder");
    const folderNames = folders.map((f) => f.data.name);

    // Phase 1 gets its own folder; the professions phase gets a "Profesie" root instead.
    expect(folderNames).toContain("Zadanie a prieskumy");
    expect(folderNames).toContain("Profesie");
    // Kept profession task gets a sub-folder…
    expect(folderNames).toContain("Statika");
    // …but the pruned one does not.
    expect(folderNames).not.toContain("Vykurovanie");
  });

  it("still creates the phase even when every one of its tasks is pruned", async () => {
    const { tx, created } = createFakeTx(TEMPLATE_FIXTURE);

    const result = await applyTemplate(
      {
        projectId: "project-1",
        templateId: "template-1",
        prunedTaskTemplateIds: ["task-tmpl-1", "task-tmpl-2"],
      },
      tx as never,
    );

    const phases = created.filter((c) => c.model === "phase");
    expect(phases).toHaveLength(2); // both phases still created
    expect(result.phaseCount).toBe(2);
    const phase1Tasks = created.filter(
      (c) => c.model === "task" && (c.data.title === "Úvodné stretnutie" || c.data.title === "Obhliadka pozemku"),
    );
    expect(phase1Tasks).toHaveLength(0);
  });

  it("does not create a 'Profesie' root folder for templates without a professions phase", async () => {
    const { tx, created } = createFakeTx({
      ...TEMPLATE_FIXTURE,
      phases: [TEMPLATE_FIXTURE.phases[0]],
    });

    await applyTemplate({ projectId: "project-1", templateId: "template-1", prunedTaskTemplateIds: [] }, tx as never);

    const folderNames = created.filter((c) => c.model === "folder").map((f) => f.data.name);
    expect(folderNames).not.toContain("Profesie");
  });
});
