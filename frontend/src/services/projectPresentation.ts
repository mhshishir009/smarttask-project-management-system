export interface ProjectOverviewTask {
  projectId: number;
  assigneeId: number | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
}

// Presentation metrics come only from authorized task data, never sample project metadata.
export function getProjectTaskSummary(projectId: number, tasks: ProjectOverviewTask[]) {
  const scoped = tasks.filter(task => task.projectId === projectId);
  const completed = scoped.filter(task => task.status === "DONE").length;
  const priorities = ["HIGH", "MEDIUM", "LOW"] as const;
  const priority = priorities.find(value => scoped.some(task => task.priority === value)) ?? null;
  const deadlines = scoped.filter(task => task.status !== "DONE" && task.dueAt && Number.isFinite(Date.parse(task.dueAt)))
    .map(task => task.dueAt as string).sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    total: scoped.length,
    completed,
    progress: scoped.length ? Math.round(completed / scoped.length * 100) : 0,
    assignees: new Set(scoped.map(task => task.assigneeId).filter(id => id !== null)).size,
    priority,
    nextDue: deadlines[0] ?? null,
    status: scoped.length && completed === scoped.length ? "Completed" : scoped.some(task => task.status !== "TODO") ? "In progress" : "Not started",
  };
}

export type ProjectTaskSummary = ReturnType<typeof getProjectTaskSummary>;
