import { describe, expect, it } from "vitest";
import { buildReorderWrites, type ReorderMove, type TaskStatusValue } from "@/features/tasks/server/reorder";

function statusMap(entries: Array<[string, TaskStatusValue]>): Map<string, TaskStatusValue> {
  return new Map(entries);
}

describe("buildReorderWrites", () => {
  it("throws when moves is empty", () => {
    expect(() => buildReorderWrites([], new Map())).toThrow();
  });

  it("throws on duplicate taskId within a batch", () => {
    const moves: ReorderMove[] = [
      { taskId: "t1", status: "TODO", order: 1 },
      { taskId: "t1", status: "IN_PROGRESS", order: 1 },
    ];
    expect(() => buildReorderWrites(moves, statusMap([["t1", "TODO"]]))).toThrow(/duplicate/);
  });

  it("renumbers a single column densely from 1, preserving requested relative order", () => {
    const moves: ReorderMove[] = [
      { taskId: "t1", status: "TODO", order: 5 },
      { taskId: "t2", status: "TODO", order: 2 },
      { taskId: "t3", status: "TODO", order: 10 },
    ];
    const current = statusMap([
      ["t1", "TODO"],
      ["t2", "TODO"],
      ["t3", "TODO"],
    ]);
    const writes = buildReorderWrites(moves, current);
    const byId = new Map(writes.map((w) => [w.taskId, w]));
    expect(byId.get("t2")!.order).toBe(1);
    expect(byId.get("t1")!.order).toBe(2);
    expect(byId.get("t3")!.order).toBe(3);
  });

  it("renumbers each destination column independently", () => {
    const moves: ReorderMove[] = [
      { taskId: "t1", status: "TODO", order: 1 },
      { taskId: "t2", status: "DONE", order: 1 },
      { taskId: "t3", status: "DONE", order: 2 },
    ];
    const current = statusMap([
      ["t1", "TODO"],
      ["t2", "TODO"],
      ["t3", "IN_PROGRESS"],
    ]);
    const writes = buildReorderWrites(moves, current);
    const todoWrites = writes.filter((w) => w.status === "TODO");
    const doneWrites = writes.filter((w) => w.status === "DONE");
    expect(todoWrites.map((w) => w.order)).toEqual([1]);
    expect(doneWrites.map((w) => w.order).sort()).toEqual([1, 2]);
  });

  it("sets doneAt='now' when a task enters the DONE column", () => {
    const moves: ReorderMove[] = [{ taskId: "t1", status: "DONE", order: 1 }];
    const current = statusMap([["t1", "TODO"]]);
    const writes = buildReorderWrites(moves, current);
    expect(writes[0]!.doneAt).toBe("now");
  });

  it("sets doneAt='clear' when a task leaves the DONE column", () => {
    const moves: ReorderMove[] = [{ taskId: "t1", status: "IN_PROGRESS", order: 1 }];
    const current = statusMap([["t1", "DONE"]]);
    const writes = buildReorderWrites(moves, current);
    expect(writes[0]!.doneAt).toBe("clear");
  });

  it("leaves doneAt untouched when the status column doesn't change relative to DONE-ness", () => {
    const moves: ReorderMove[] = [
      { taskId: "t1", status: "TODO", order: 2 },
      { taskId: "t2", status: "DONE", order: 1 },
    ];
    const current = statusMap([
      ["t1", "TODO"],
      ["t2", "DONE"],
    ]);
    const writes = buildReorderWrites(moves, current);
    const byId = new Map(writes.map((w) => [w.taskId, w]));
    expect(byId.get("t1")!.doneAt).toBe("unchanged");
    expect(byId.get("t2")!.doneAt).toBe("unchanged");
  });

  it("handles a task with unknown prior status (not in the map) as not previously done", () => {
    const moves: ReorderMove[] = [{ taskId: "new-task", status: "DONE", order: 1 }];
    const writes = buildReorderWrites(moves, new Map());
    expect(writes[0]!.doneAt).toBe("now");
  });
});
