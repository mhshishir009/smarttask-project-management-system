
import { EntityManager, Repository } from "typeorm";

import { AppDataSource } from "../database/data-source";
import { TaskOrmEntity } from "../database/entities/TaskOrmEntity";

import {
  Task,
  TaskStatus,
} from "../../domain/entities/Task";

import { ITaskRepository, TaskFilters } from "../../domain/repositories/ITaskRepository";
import { NotificationWriter } from "./NotificationWriter";

type TaskActorRole = "ADMIN" | "TEAM_MEMBER";

type TaskStatusActor = {
  userId: number;
  role: TaskActorRole;
};

export class TaskRepository implements ITaskRepository {
  private readonly repository: Repository<TaskOrmEntity>;

  constructor(private readonly notifications?: NotificationWriter) {
    this.repository = AppDataSource.getRepository(TaskOrmEntity);
  }

  // ==========================================
  // 1. CREATE TASK
  // ==========================================
  async createTask(
    task: Omit<
      Task,
      "taskId" | "version" | "createdAt" | "updatedAt"
    >
  ): Promise<Task> {
    // Enforce assigned creation at the persistence boundary as well as in the service.
    const assigneeId = task.assigneeId;
    if (!Number.isSafeInteger(assigneeId) || assigneeId === null || assigneeId <= 0) {
      throw new Error("Invalid assignee ID");
    }
    return AppDataSource.transaction(async (manager) => {
      const projects: Array<{ id: string }> =
        await manager.query(
          `
          SELECT id
          FROM projects
          WHERE id = $1
            AND is_archived = FALSE
          FOR UPDATE
          `,
          [task.projectId]
        );

      if (projects.length === 0) {
        throw new Error("Project not found or archived");
      }

      // Recheck under a user-row lock so concurrent deactivation cannot bypass validation.
      await this.ensureActiveAssignee(manager, assigneeId);

      const repository =
        manager.getRepository(TaskOrmEntity);

      const newTask = repository.create({
        projectId: task.projectId,
        assigneeId,
        createdBy: task.createdBy,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt,
        version: 1,
      });

      const savedTask = await repository.save(newTask);

      await this.notifications?.record(manager, {kind: "TASK_ASSIGNED", key: `task:${savedTask.taskId}:assigned`,
        actorId: task.createdBy, projectId: task.projectId, taskId: Number(savedTask.taskId), assigneeId});

      return this.mapToDomain(savedTask);
    });
  }

  // ==========================================
  // 2. GET ALL TASKS
  // ==========================================
  async getAllTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const tasks = await this.repository.find({
      // TypeORM binds filter values; one where object applies all supplied criteria with AND.
      where: filters,
      order: { taskId: "ASC" },
    });

    return tasks.map((task) => this.mapToDomain(task));
  }

  // ==========================================
  // 3. GET TASKS BY PROJECT ID
  // ==========================================
  async getTasksByProjectId(
    projectId: number
  ): Promise<Task[]> {
    const tasks = await this.repository.find({
      where: { projectId },
      order: { taskId: "ASC" },
    });

    return tasks.map((task) => this.mapToDomain(task));
  }

  // ==========================================
  // 4. GET TASK BY ID
  // ==========================================
  async getTaskById(
    taskId: number
  ): Promise<Task | null> {
    const task = await this.repository.findOneBy({
      taskId,
    });

    return task ? this.mapToDomain(task) : null;
  }

  // ==========================================
  // 5. UPDATE TASK
  // ==========================================
  async updateTask(
    taskId: number,
    expectedVersion: number,
    data: Pick<
      Task,
      "title" | "description" | "priority" | "dueAt"
    >
  ): Promise<Task | null> {
    return this.updateWithVersion(
      taskId,
      expectedVersion,
      {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueAt: data.dueAt,
      }
    );
  }

  // ==========================================
  // 6. CHANGE TASK STATUS
  // ==========================================
  async changeTaskStatus(
    taskId: number,
    expectedVersion: number,
    status: TaskStatus,
    actor: TaskStatusActor
  ): Promise<Task | null> {
    // Fail closed until the Service passes
    // the verified authenticated actor.
    if (!actor) {
      throw new Error("Task status change forbidden");
    }

    if (
      actor.role !== "ADMIN" &&
      actor.role !== "TEAM_MEMBER"
    ) {
      throw new Error("Task status change forbidden");
    }

    if (
      !Number.isSafeInteger(actor.userId) ||
      actor.userId <= 0
    ) {
      throw new Error("Task status change forbidden");
    }

    if (
      status !== "TODO" &&
      status !== "IN_PROGRESS" &&
      status !== "DONE"
    ) {
      throw new Error("Invalid task status");
    }

    return this.updateWithVersion(
      taskId,
      expectedVersion,
      { status },
      undefined,
      actor,
      status
    );
  }

  // ==========================================
  // 7. REASSIGN TASK
  // ==========================================
  async reassignTask(
    taskId: number,
    expectedVersion: number,
    assigneeId: number,
    actorId?: number
  ): Promise<Task | null> {
    // Block null/invalid reassignment even when a caller bypasses the service.
    if (!Number.isSafeInteger(assigneeId) || assigneeId <= 0) {
      throw new Error("Invalid assignee ID");
    }
    return this.updateWithVersion(
      taskId,
      expectedVersion,
      { assigneeId },
      assigneeId,
      undefined,
      undefined,
      actorId
    );
  }

  // ==========================================
  // DELETE TASK
  // ==========================================
  async deleteTask(taskId: number, expectedVersion: number): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const taskRows: Array<{ project_id: string }> = await manager.query(
        "SELECT project_id FROM tasks WHERE id = $1",
        [taskId]
      );
      if (taskRows.length === 0) {
        return false;
      }

      // Use the same parent-then-task lock order as task updates and project deletion.
      const projects: Array<{ id: string; is_archived: boolean }> = await manager.query(
        "SELECT id, is_archived FROM projects WHERE id = $1 FOR UPDATE",
        [taskRows[0].project_id]
      );
      if (projects.length === 0) {
        return false;
      }
      if (projects[0].is_archived) {
        throw new Error("Archived project cannot be modified");
      }

      const lockedTasks: Array<{ id: string; version: number }> = await manager.query(
        "SELECT id, version FROM tasks WHERE id = $1 AND project_id = $2 FOR UPDATE",
        [taskId, taskRows[0].project_id]
      );
      if (lockedTasks.length === 0) {
        return false;
      }
      // A stale screen must not delete work that another request has just changed.
      if (lockedTasks[0].version !== expectedVersion) {
        throw new Error("Task version conflict");
      }

      const result = await manager.getRepository(TaskOrmEntity).delete({
        taskId,
        projectId: Number(taskRows[0].project_id),
        version: expectedVersion,
      });
      return result.affected === 1;
    });
  }

  // ==========================================
  // SHARED TRANSACTIONAL UPDATE
  // ==========================================
  private async updateWithVersion(
    taskId: number,
    expectedVersion: number,
    changes: Partial<TaskOrmEntity>,
    newAssigneeId?: number | null,
    actor?: TaskStatusActor,
    requestedStatus?: TaskStatus,
    reassignmentActorId?: number
  ): Promise<Task | null> {
    return AppDataSource.transaction(async (manager) => {
      const repository =
        manager.getRepository(TaskOrmEntity);

      // Find the task's parent project.
      const taskRows: Array<{ project_id: string }> =
        await manager.query(
          `
          SELECT project_id
          FROM tasks
          WHERE id = $1
          `,
          [taskId]
        );

      if (taskRows.length === 0) {
        return null;
      }

      // Lock parent project first.
      const projects: Array<{ id: string }> =
        await manager.query(
          `
          SELECT id
          FROM projects
          WHERE id = $1
            AND is_archived = FALSE
          FOR UPDATE
          `,
          [taskRows[0].project_id]
        );

      if (projects.length === 0) {
        throw new Error(
          "Archived project cannot be modified"
        );
      }

      // Lock task after project to serialize
      // status changes and reassignment.
      const lockedTasks: Array<{
        id: string;
        assignee_id: string | null;
        status: TaskStatus;
        version: number;
      }> = await manager.query(
        `
        SELECT id, assignee_id, status, version
        FROM tasks
        WHERE id = $1
          AND project_id = $2
        FOR UPDATE
        `,
        [taskId, taskRows[0].project_id]
      );

      if (lockedTasks.length === 0) {
        return null;
      }

      const currentTask = lockedTasks[0];

      // Optimistic concurrency check.
      if (currentTask.version !== expectedVersion) {
        return null;
      }

      // Authorization inside the transaction.
      if (actor) {
        if (actor.role === "TEAM_MEMBER") {
          if (
            currentTask.assignee_id === null ||
            Number(currentTask.assignee_id) !== actor.userId
          ) {
            throw new Error(
              "Task status change forbidden"
            );
          }
        }

        if (
          actor.role !== "ADMIN" &&
          actor.role !== "TEAM_MEMBER"
        ) {
          throw new Error(
            "Task status change forbidden"
          );
        }
      }

      // Validate status transition against
      // the latest locked database row.
      if (requestedStatus !== undefined) {
        const allowedTransitions: Record<
          TaskStatus,
          TaskStatus[]
        > = {
          TODO: ["IN_PROGRESS"],
          IN_PROGRESS: ["DONE"],
          DONE: [],
        };

        if (
          !allowedTransitions[currentTask.status]?.includes(
            requestedStatus
          )
        ) {
          throw new Error(
            "Invalid task status transition"
          );
        }
      }

      // Verify new assignee within transaction.
      if (
        newAssigneeId !== undefined &&
        newAssigneeId !== null
      ) {
        await this.ensureActiveAssignee(
          manager,
          newAssigneeId
        );
      }

      const result = await repository
        .createQueryBuilder()
        .update(TaskOrmEntity)
        .set({
          ...changes,
          version: () => '"version" + 1',
          updatedAt: () => "CURRENT_TIMESTAMP",
        })
        .where("id = :taskId", { taskId })
        .andWhere("version = :expectedVersion", {
          expectedVersion,
        })
        .andWhere("project_id = :projectId", {
          projectId: taskRows[0].project_id,
        })
        .execute();

      if (result.affected !== 1) {
        return null;
      }

      const updatedTask = await repository.findOneBy({
        taskId,
      });

      // Emit once from the successful locked version; stale/failed updates emit nothing.
      if (updatedTask && this.notifications) {
        const projectId = Number(taskRows[0].project_id);
        if (requestedStatus !== undefined && actor) {
          await this.notifications.record(manager, {kind: "TASK_STATUS_CHANGED", key: `task:${taskId}:status:${updatedTask.version}`,
            projectId, taskId, actorId: actor.userId, assigneeId: updatedTask.assigneeId, status: requestedStatus});
        } else if (newAssigneeId !== undefined && Number(currentTask.assignee_id) !== newAssigneeId) {
          await this.notifications.record(manager, {kind: "TASK_REASSIGNED", key: `task:${taskId}:reassigned:${updatedTask.version}`,
            projectId, taskId, actorId: reassignmentActorId!, assigneeId: newAssigneeId,
            previousAssigneeId: currentTask.assignee_id === null ? null : Number(currentTask.assignee_id)});
        }
      }

      return updatedTask
        ? this.mapToDomain(updatedTask)
        : null;
    });
  }

  // ==========================================
  // ACTIVE ASSIGNEE VERIFICATION
  // ==========================================
  private async ensureActiveAssignee(
    manager: EntityManager,
    assigneeId: number
  ): Promise<void> {
    const users: Array<{ id: string }> =
      await manager.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
          AND is_active = TRUE
        FOR UPDATE
        `,
        [assigneeId]
      );

    if (users.length === 0) {
      throw new Error(
        "Assignee not found or inactive"
      );
    }
  }

  // ==========================================
  // MAP ORM ENTITY TO DOMAIN ENTITY
  // ==========================================
  private mapToDomain(
    task: TaskOrmEntity
  ): Task {
    const taskId = Number(task.taskId);
    const projectId = Number(task.projectId);
    const createdBy = Number(task.createdBy);

    const assigneeId =
      task.assigneeId === null ||
      task.assigneeId === undefined
        ? null
        : Number(task.assigneeId);

    if (
      !Number.isSafeInteger(taskId) ||
      taskId <= 0 ||
      !Number.isSafeInteger(projectId) ||
      projectId <= 0 ||
      !Number.isSafeInteger(createdBy) ||
      createdBy <= 0 ||
      (
        assigneeId !== null &&
        (
          !Number.isSafeInteger(assigneeId) ||
          assigneeId <= 0
        )
      )
    ) {
      throw new Error(
        "Task numeric value is out of range"
      );
    }

    return {
      taskId,
      projectId,
      assigneeId,
      createdBy,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt,
      version: task.version,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
