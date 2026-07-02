"use client";

import type { CreatePhaseInput, CreateTaskInput, PhaseDTO, TaskDTO, UpdatePhaseInput, UpdateTaskInput } from "@/features/tasks/schemas";

/** Thin fetch wrappers for the phases/tasks API (spec/05-api.md §3), used by client components. */

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchPhases(projectId: string): Promise<PhaseDTO[]> {
  const res = await fetch(`/api/projects/${projectId}/phases`, { cache: "no-store" });
  const data = await parseOrThrow<{ items: PhaseDTO[] }>(res);
  return data.items;
}

export async function createPhaseApi(projectId: string, input: CreatePhaseInput): Promise<PhaseDTO> {
  const res = await fetch(`/api/projects/${projectId}/phases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<PhaseDTO>(res);
}

export async function updatePhaseApi(phaseId: string, input: UpdatePhaseInput): Promise<PhaseDTO> {
  const res = await fetch(`/api/phases/${phaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<PhaseDTO>(res);
}

export async function deletePhaseApi(phaseId: string): Promise<void> {
  const res = await fetch(`/api/phases/${phaseId}`, { method: "DELETE" });
  await parseOrThrow<{ ok: true }>(res);
}

export async function createTaskApi(phaseId: string, input: CreateTaskInput): Promise<TaskDTO> {
  const res = await fetch(`/api/phases/${phaseId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<TaskDTO>(res);
}

export async function updateTaskApi(taskId: string, input: UpdateTaskInput): Promise<TaskDTO> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<TaskDTO>(res);
}

export async function deleteTaskApi(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  await parseOrThrow<{ ok: true }>(res);
}

export interface ReorderMoveInput {
  taskId: string;
  status: TaskDTO["status"];
  order: number;
}

export async function reorderTasksApi(moves: ReorderMoveInput[]): Promise<void> {
  const res = await fetch(`/api/tasks/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moves }),
  });
  await parseOrThrow<{ ok: true }>(res);
}
