import { describe, expect, it } from "vitest";
import { filterPhasesForClient, isTaskClientVisible } from "@/features/tasks/server/visibility";

describe("isTaskClientVisible", () => {
  it("is visible only when both the task and its phase are CLIENT_VISIBLE", () => {
    expect(isTaskClientVisible("CLIENT_VISIBLE", "CLIENT_VISIBLE")).toBe(true);
  });

  it("is hidden when the task itself is INTERNAL, even in a client-visible phase", () => {
    expect(isTaskClientVisible("INTERNAL", "CLIENT_VISIBLE")).toBe(false);
  });

  it("is hidden when the phase is INTERNAL, even if the task itself is CLIENT_VISIBLE", () => {
    expect(isTaskClientVisible("CLIENT_VISIBLE", "INTERNAL")).toBe(false);
  });

  it("is hidden when both are INTERNAL", () => {
    expect(isTaskClientVisible("INTERNAL", "INTERNAL")).toBe(false);
  });
});

describe("filterPhasesForClient", () => {
  it("drops INTERNAL phases entirely", () => {
    const phases = [
      { visibility: "INTERNAL" as const, tasks: [{ id: "t1", visibility: "CLIENT_VISIBLE" as const }] },
      { visibility: "CLIENT_VISIBLE" as const, tasks: [] },
    ];
    const result = filterPhasesForClient(phases);
    expect(result).toHaveLength(1);
    expect(result[0]!.visibility).toBe("CLIENT_VISIBLE");
  });

  it("within a visible phase, keeps only CLIENT_VISIBLE tasks", () => {
    const phases = [
      {
        visibility: "CLIENT_VISIBLE" as const,
        tasks: [
          { id: "t1", visibility: "CLIENT_VISIBLE" as const },
          { id: "t2", visibility: "INTERNAL" as const },
        ],
      },
    ];
    const result = filterPhasesForClient(phases);
    expect(result[0]!.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("never leaks an internal task even indirectly via a visible phase with many tasks", () => {
    const phases = [
      {
        visibility: "CLIENT_VISIBLE" as const,
        tasks: Array.from({ length: 5 }, (_, i) => ({
          id: `t${i}`,
          visibility: i % 2 === 0 ? ("CLIENT_VISIBLE" as const) : ("INTERNAL" as const),
        })),
      },
    ];
    const result = filterPhasesForClient(phases);
    expect(result[0]!.tasks.every((t) => t.visibility === "CLIENT_VISIBLE")).toBe(true);
    expect(result[0]!.tasks).toHaveLength(3);
  });

  it("returns an empty array for an all-internal phase list", () => {
    const phases = [{ visibility: "INTERNAL" as const, tasks: [] }];
    expect(filterPhasesForClient(phases)).toEqual([]);
  });
});
