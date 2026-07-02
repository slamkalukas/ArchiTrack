import { describe, expect, it } from "vitest";
import { toClientTaskDTO, toPhaseDTO, toTaskDTO } from "@/features/tasks/server/mappers";

function baseTask(overrides: Partial<Parameters<typeof toTaskDTO>[0]> = {}) {
  return {
    id: "task-1",
    phaseId: "phase-1",
    title: "Test task",
    description: null,
    status: "TODO" as const,
    order: 1,
    weight: 1,
    milestone: false,
    visibility: "INTERNAL" as const,
    assigneeType: "ARCHITECT" as const,
    contactId: null,
    dueDate: null,
    doneAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("toTaskDTO", () => {
  it("serializes dates to ISO strings and passes through core fields", () => {
    const dto = toTaskDTO(baseTask({ dueDate: new Date("2026-03-01T00:00:00.000Z") }));
    expect(dto.dueDate).toBe("2026-03-01T00:00:00.000Z");
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(dto.title).toBe("Test task");
  });

  it("surfaces the contact name and comment count when included", () => {
    const dto = toTaskDTO(
      baseTask({
        assigneeType: "EXTERNAL",
        contactId: "contact-1",
        contact: { name: "Ing. Statik" },
        _count: { comments: 3 },
      }),
    );
    expect(dto.contactName).toBe("Ing. Statik");
    expect(dto.commentCount).toBe(3);
  });

  it("defaults contactName to null when there is no contact", () => {
    const dto = toTaskDTO(baseTask());
    expect(dto.contactName).toBeNull();
  });
});

describe("toPhaseDTO", () => {
  it("computes progress from the phase's own tasks via phaseProgress/toPercent", () => {
    const phase = {
      id: "phase-1",
      projectId: "project-1",
      name: "Phase one",
      templateKey: null,
      order: 1,
      status: "ACTIVE" as const,
      weight: 10,
      description: null,
      visibility: "CLIENT_VISIBLE" as const,
      tasks: [baseTask({ id: "t1", status: "DONE" }), baseTask({ id: "t2", status: "TODO" })],
    };
    const dto = toPhaseDTO(phase);
    expect(dto.progress).toBe(50);
    expect(dto.tasks).toHaveLength(2);
  });

  it("returns 0 progress for a phase with no tasks", () => {
    const phase = {
      id: "phase-1",
      projectId: "project-1",
      name: "Empty phase",
      templateKey: null,
      order: 1,
      status: "UPCOMING" as const,
      weight: 10,
      description: null,
      visibility: "CLIENT_VISIBLE" as const,
      tasks: [],
    };
    expect(toPhaseDTO(phase).progress).toBe(0);
  });
});

describe("toClientTaskDTO", () => {
  it("strips internal-only fields (weight, assignee, contact) from the client-facing DTO", () => {
    const dto = toTaskDTO(
      baseTask({ assigneeType: "EXTERNAL", contactId: "c1", contact: { name: "Statik" }, weight: 7 }),
    );
    const clientDto = toClientTaskDTO(dto);
    expect(clientDto.weight).toBe(0);
    expect(clientDto.assigneeType).toBe("ARCHITECT");
    expect(clientDto.contactId).toBeNull();
    expect(clientDto.contactName).toBeNull();
    // Client-safe fields are preserved.
    expect(clientDto.title).toBe(dto.title);
    expect(clientDto.status).toBe(dto.status);
    expect(clientDto.dueDate).toBe(dto.dueDate);
  });
});
