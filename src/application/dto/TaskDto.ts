
import {
  TaskStatus,
  TaskPriority,
} from "../../domain/entities/Task";

export interface TaskDto {
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
