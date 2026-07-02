import { describe, expect, it } from "vitest";
import {
  createPhaseSchema,
  createTaskSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "@/features/tasks/schemas";

describe("createPhaseSchema", () => {
  it("applies defaults for weight and visibility", () => {
    const parsed = createPhaseSchema.parse({ name: "Zadanie" });
    expect(parsed.weight).toBe(10);
    expect(parsed.visibility).toBe("CLIENT_VISIBLE");
  });

  it("rejects an empty name", () => {
    expect(() => createPhaseSchema.parse({ name: "" })).toThrow();
  });
});

describe("createTaskSchema", () => {
  it("defaults status to TODO, visibility to INTERNAL, weight to 1", () => {
    const parsed = createTaskSchema.parse({ title: "Obhliadka pozemku" });
    expect(parsed.status).toBe("TODO");
    expect(parsed.visibility).toBe("INTERNAL");
    expect(parsed.weight).toBe(1);
    expect(parsed.milestone).toBe(false);
    expect(parsed.assigneeType).toBe("ARCHITECT");
  });

  it("rejects an empty title", () => {
    expect(() => createTaskSchema.parse({ title: "" })).toThrow();
  });

  it("rejects a negative weight", () => {
    expect(() => createTaskSchema.parse({ title: "x", weight: -1 })).toThrow();
  });

  it("accepts a valid ISO datetime for dueDate", () => {
    const parsed = createTaskSchema.parse({ title: "x", dueDate: "2026-08-01T00:00:00.000Z" });
    expect(parsed.dueDate).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rejects a malformed dueDate", () => {
    expect(() => createTaskSchema.parse({ title: "x", dueDate: "not-a-date" })).toThrow();
  });
});

describe("updateTaskSchema", () => {
  it("allows a partial { status, order } payload for drag & drop", () => {
    const parsed = updateTaskSchema.parse({ status: "DONE", order: 2 });
    expect(parsed).toEqual({ status: "DONE", order: 2 });
  });

  it("allows an empty object (no-op update)", () => {
    expect(() => updateTaskSchema.parse({})).not.toThrow();
  });
});

describe("reorderTasksSchema", () => {
  it("requires at least one move", () => {
    expect(() => reorderTasksSchema.parse({ moves: [] })).toThrow();
  });

  it("parses a valid batch", () => {
    const parsed = reorderTasksSchema.parse({
      moves: [
        { taskId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", status: "TODO", order: 1 },
        { taskId: "3fa85f64-5717-4562-b3fc-2c963f66afa7", status: "DONE", order: 1 },
      ],
    });
    expect(parsed.moves).toHaveLength(2);
  });

  it("rejects a non-uuid taskId", () => {
    expect(() =>
      reorderTasksSchema.parse({ moves: [{ taskId: "not-a-uuid", status: "TODO", order: 1 }] }),
    ).toThrow();
  });

  it("rejects order below 1", () => {
    expect(() =>
      reorderTasksSchema.parse({
        moves: [{ taskId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", status: "TODO", order: 0 }],
      }),
    ).toThrow();
  });
});
