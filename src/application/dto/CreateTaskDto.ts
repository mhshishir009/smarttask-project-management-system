
import { TaskPriority } from "../../domain/entities/Task";

export interface CreateTaskDto {
  projectId: number;
  title: string;
  description?: string | null;
  // New tasks must be assigned to an existing active user.
  assigneeId: number;
  priority?: TaskPriority;
  dueAt?: string | null;
}
