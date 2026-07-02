import { describe, expect, it } from "vitest";
import { resolveActiveProject, buildMilestones } from "@/features/portal/server/selectors";
import type { PortalProjectSummary } from "@/features/portal/types";

function project(id: string, name = id): PortalProjectSummary {
  return {
    id,
    name,
    slug: id,
    locationText: null,
    description: null,
    coverImageUrl: null,
    progress: 0,
    currentPhase: null,
  };
}

describe("resolveActiveProject", () => {
  it("returns null when the user has no projects", () => {
    expect(resolveActiveProject([], "anything")).toBeNull();
  });

  it("defaults to the first project when no id is requested", () => {
    const projects = [project("a"), project("b")];
    expect(resolveActiveProject(projects)?.id).toBe("a");
  });

  it("returns the requested project when it belongs to the user", () => {
    const projects = [project("a"), project("b"), project("c")];
    expect(resolveActiveProject(projects, "b")?.id).toBe("b");
  });

  it("falls back to the first project when the requested id is not the user's own", () => {
    const projects = [project("a"), project("b")];
    // Guards against a CLIENT probing another project's id via ?project= (spec/05-api.md
    // "404 not 403" posture) — silently falls back rather than leaking whether it exists.
    expect(resolveActiveProject(projects, "someone-elses-project")?.id).toBe("a");
  });
});

describe("buildMilestones", () => {
  it("returns an empty list when no task is flagged as a milestone", () => {
    const phases = [
      { tasks: [{ id: "t1", title: "Regular task", milestone: false, status: "TODO" as const, dueDate: null }] },
    ];
    expect(buildMilestones(phases)).toEqual([]);
  });

  it("collects milestone tasks across phases in order, marking done ones", () => {
    const phases = [
      {
        tasks: [
          { id: "t1", title: "Study approved", milestone: true, status: "DONE" as const, dueDate: "2026-01-10" },
          { id: "t2", title: "Regular task", milestone: false, status: "TODO" as const, dueDate: null },
        ],
      },
      {
        tasks: [
          { id: "t3", title: "Permit issued", milestone: true, status: "TODO" as const, dueDate: "2026-06-01" },
        ],
      },
    ];

    expect(buildMilestones(phases)).toEqual([
      { id: "t1", label: "Study approved", date: "2026-01-10", done: true },
      { id: "t3", label: "Permit issued", date: "2026-06-01", done: false },
    ]);
  });

  it("falls back to doneAt when a milestone has no dueDate", () => {
    const phases = [
      {
        tasks: [
          {
            id: "t1",
            title: "Approved",
            milestone: true,
            status: "DONE" as const,
            dueDate: null,
            doneAt: "2026-02-01",
          },
        ],
      },
    ];
    expect(buildMilestones(phases)[0]).toEqual({ id: "t1", label: "Approved", date: "2026-02-01", done: true });
  });
});
