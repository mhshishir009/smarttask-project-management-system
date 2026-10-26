
export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE";

export type TaskPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface Task {
  taskId: number;
  projectId: number;
  assigneeId: number | null;
  createdBy: number;

  title: string;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority;

  dueAt: Date | null;
  version: number;

  createdAt: Date;
  updatedAt: Date;
}
