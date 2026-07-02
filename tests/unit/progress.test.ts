import { describe, expect, it } from "vitest";
import { phaseProgress, projectProgress, toPercent, type ProgressPhase } from "@/lib/progress";

describe("phaseProgress", () => {
  it("returns 0 for a phase with no tasks", () => {
    expect(phaseProgress([])).toBe(0);
  });

  it("returns 1 when all tasks are done (equal weights)", () => {
    const tasks = [
      { status: "DONE" as const, weight: 1 },
      { status: "DONE" as const, weight: 1 },
    ];
    expect(phaseProgress(tasks)).toBe(1);
  });

  it("returns 0 when no tasks are done", () => {
    const tasks = [
      { status: "TODO" as const, weight: 1 },
      { status: "IN_PROGRESS" as const, weight: 1 },
    ];
    expect(phaseProgress(tasks)).toBe(0);
  });

  it("computes weighted fraction of done tasks", () => {
    const tasks = [
      { status: "DONE" as const, weight: 3 },
      { status: "TODO" as const, weight: 1 },
    ];
    // 3 / (3+1) = 0.75
    expect(phaseProgress(tasks)).toBeCloseTo(0.75);
  });

  it("treats default weight of 1 for each task in a mixed set", () => {
    const tasks = [
      { status: "DONE" as const, weight: 1 },
      { status: "TODO" as const, weight: 1 },
      { status: "IN_PROGRESS" as const, weight: 1 },
      { status: "DONE" as const, weight: 1 },
    ];
    expect(phaseProgress(tasks)).toBeCloseTo(0.5);
  });

  it("ignores tasks with non-positive weight in the denominator", () => {
    const tasks = [
      { status: "DONE" as const, weight: 1 },
      { status: "TODO" as const, weight: 0 },
    ];
    expect(phaseProgress(tasks)).toBe(1);
  });
});

describe("projectProgress", () => {
  it("returns 0 for a project with no phases", () => {
    expect(projectProgress([])).toBe(0);
  });

  it("excludes SKIPPED phases from the weighted average", () => {
    const phases: ProgressPhase[] = [
      { status: "DONE", weight: 10, tasks: [{ status: "DONE", weight: 1 }] },
      { status: "SKIPPED", weight: 90, tasks: [] },
    ];
    // Only the DONE phase counts, and it's fully done => 1
    expect(projectProgress(phases)).toBe(1);
  });

  it("treats a DONE phase as 100% regardless of its tasks", () => {
    const phases: ProgressPhase[] = [
      { status: "DONE", weight: 10, tasks: [] }, // no tasks tracked, still counts as done
    ];
    expect(projectProgress(phases)).toBe(1);
  });

  it("computes the weighted average across active/upcoming phases", () => {
    const phases: ProgressPhase[] = [
      {
        status: "DONE",
        weight: 5,
        tasks: [{ status: "DONE", weight: 1 }],
      },
      {
        status: "ACTIVE",
        weight: 15,
        tasks: [
          { status: "DONE", weight: 1 },
          { status: "TODO", weight: 1 },
        ],
      },
      {
        status: "UPCOMING",
        weight: 80,
        tasks: [{ status: "TODO", weight: 1 }],
      },
    ];
    // (5*1 + 15*0.5 + 80*0) / (5+15+80) = 12.5 / 100 = 0.125
    expect(projectProgress(phases)).toBeCloseTo(0.125);
  });

  it("matches the default phase weights from the Rodinný dom SK template (5/15/15/20/15/20/10)", () => {
    const weights = [5, 15, 15, 20, 15, 20, 10];
    const phases: ProgressPhase[] = weights.map((weight, index) => ({
      status: index === 0 ? "DONE" : "UPCOMING",
      weight,
      tasks: index === 0 ? [{ status: "DONE", weight: 1 }] : [],
    }));
    // Only phase 1 (weight 5) is done => 5/100 = 0.05
    expect(projectProgress(phases)).toBeCloseTo(0.05);
  });
});

describe("toPercent", () => {
  it("rounds a 0..1 fraction to a 0..100 integer", () => {
    expect(toPercent(0)).toBe(0);
    expect(toPercent(1)).toBe(100);
    expect(toPercent(0.125)).toBe(13); // rounds to nearest int
    expect(toPercent(0.124)).toBe(12);
  });

  it("clamps out-of-range input", () => {
    expect(toPercent(-0.5)).toBe(0);
    expect(toPercent(1.5)).toBe(100);
  });
});
