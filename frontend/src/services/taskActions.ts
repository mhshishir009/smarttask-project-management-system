import api from "./api";

export interface TaskFilterSelection {
  projectId: string;
  assigneeId: string;
  status: "ALL" | "TODO" | "IN_PROGRESS" | "DONE";
  priority: "ALL" | "LOW" | "MEDIUM" | "HIGH";
}

// Omit empty/ALL selections: the backend expects real IDs and exact enum values.
export function getTaskFilterParams(filters: TaskFilterSelection) {
  const params: Record<string, string | number> = {};
  for (const key of ["projectId", "assigneeId"] as const) {
    if (filters[key] !== "") {
      const id = Number(filters[key]);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid task filter ID.");
      params[key] = id;
    }
  }
  if (filters.status !== "ALL") params.status = filters.status;
  if (filters.priority !== "ALL") params.priority = filters.priority;
  return params;
}

export function getFilteredTasks(filters: TaskFilterSelection, signal?: AbortSignal) {
  return api.get("/tasks", { params: getTaskFilterParams(filters), signal });
}

export function deleteTask(taskId: number, expectedVersion: number) {
  // Axios sends DELETE bodies through `data`; this preserves optimistic concurrency.
  return api.delete(`/tasks/${taskId}`, { data: { expectedVersion } });
}

export function requireActiveAssignee(value: string, users: Array<{userId: number; isActive?: boolean}>) {
  const id = Number(value);
  if (!value || !Number.isSafeInteger(id) || id <= 0) throw new Error("Please select an active assignee.");
  if (!users.some(user => user.userId === id && user.isActive === true)) {
    throw new Error("Selected assignee is unavailable. Refresh the user options and try again.");
  }
  return id;
}

export function reassignTask(taskId: number, expectedVersion: number, value: string, users: Array<{userId: number; isActive?: boolean}>) {
  // Validate before sending: clearing the selection must never remove the task's owner.
  const assigneeId = requireActiveAssignee(value, users);
  return api.patch(`/tasks/${taskId}/assign`, { expectedVersion, assigneeId });
}
