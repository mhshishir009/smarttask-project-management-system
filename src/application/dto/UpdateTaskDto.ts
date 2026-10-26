
import { TaskPriority } from "../../domain/entities/Task";

export interface UpdateTaskDto {
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueAt: string | null;
  expectedVersion: number;
}
