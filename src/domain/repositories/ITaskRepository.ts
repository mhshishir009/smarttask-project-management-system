
import { Task, TaskStatus, TaskPriority } from "../entities/Task";

// Optional filters combine with AND; omitting them preserves the existing task list.
export interface TaskFilters {
  projectId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: number;
}

// ==========================================
// Authenticated Actor Information
// ==========================================
export type TaskActorRole = "ADMIN" | "TEAM_MEMBER";

export interface TaskStatusActor {
  userId: number;
  role: TaskActorRole;
}

// ==========================================
// TASK REPOSITORY INTERFACE
// ==========================================
export interface ITaskRepository {

  // 1. Create a new task
  createTask(
    task: Omit<
      Task,
      "taskId" | "version" | "createdAt" | "updatedAt"
    >
  ): Promise<Task>;

  // 2. Get all tasks
  getAllTasks(filters?: TaskFilters): Promise<Task[]>;

  // 3. Get tasks under a specific project
  getTasksByProjectId(
    projectId: number
  ): Promise<Task[]>;

  // 4. Get task by ID
  getTaskById(
    taskId: number
  ): Promise<Task | null>;

  // 5. Update task information
  updateTask(
    taskId: number,
    expectedVersion: number,
    data: Pick<
      Task,
      "title" | "description" | "priority" | "dueAt"
    >
  ): Promise<Task | null>;

  // 6. Change task status with authorization
  changeTaskStatus(
    taskId: number,
    expectedVersion: number,
    status: TaskStatus,
    actor: TaskStatusActor
  ): Promise<Task | null>;

  // 7. Reassign task to another user
  reassignTask(
    taskId: number,
    expectedVersion: number,
    assigneeId: number,
    actorId?: number
  ): Promise<Task | null>;

  // Delete against the latest version while preserving the project's archive restriction.
  deleteTask(taskId: number, expectedVersion: number): Promise<boolean>;
}
