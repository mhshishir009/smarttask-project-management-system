
import {
  ITaskRepository,
  TaskActorRole,
  TaskStatusActor,
  TaskFilters,
} from "../../domain/repositories/ITaskRepository";

import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

import {
  Task,
  TaskStatus,
  TaskPriority,
} from "../../domain/entities/Task";

import { CreateTaskDto } from "../dto/CreateTaskDto";
import { UpdateTaskDto } from "../dto/UpdateTaskDto";
import { TaskDto } from "../dto/TaskDto";

export class TaskService {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository
  ) {}

  // ==========================================
  // 1. CREATE TASK
  // ==========================================
  async createTask(
    dto: CreateTaskDto,
    createdBy: number
  ): Promise<TaskDto> {
    this.validateId(dto.projectId, "project ID");
    this.validateId(createdBy, "task creator");

    const title = this.validateTitle(dto.title);

    const description = this.validateDescription(
      dto.description
    );

    const priority = this.validatePriority(
      dto.priority ?? "MEDIUM"
    );

    const dueAt = this.parseDueAt(dto.dueAt);

    // Reject unassigned creation even when an HTTP client bypasses the frontend form.
    const assigneeId = dto.assigneeId;
    if (assigneeId === undefined || assigneeId === null) {
      throw new Error("Assignee ID is required");
    }
    this.validateId(assigneeId, "assignee ID");

    const assignee = await this.userRepository.getUserById(assigneeId);
    if (!assignee || !assignee.isActive) {
      throw new Error("Assignee not found or inactive");
    }

    const project =
      await this.projectRepository.getProjectById(
        dto.projectId
      );

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.isArchived) {
      throw new Error(
        "Archived project cannot be modified"
      );
    }

    const creator =
      await this.userRepository.getUserById(
        createdBy
      );

    if (!creator || !creator.isActive) {
      throw new Error(
        "Task creator not found or inactive"
      );
    }

    const task = await this.taskRepository.createTask({
      projectId: dto.projectId,
      assigneeId,
      createdBy,
      title,
      description,
      status: "TODO",
      priority,
      dueAt,
    });

    return this.mapToDto(task);
  }

  // ==========================================
  // 2. GET ALL TASKS
  // ==========================================
  // ADMIN only, enforced by taskRoutes.ts
  async getAllTasks(filters: TaskFilters = {}): Promise<TaskDto[]> {
    // Validate again at the service boundary and forward only supported filter fields.
    const validatedFilters: TaskFilters = {};
    if (filters.projectId !== undefined) {
      this.validateId(filters.projectId, "project ID");
      validatedFilters.projectId = filters.projectId;
    }
    if (filters.assigneeId !== undefined) {
      this.validateId(filters.assigneeId, "assignee ID");
      validatedFilters.assigneeId = filters.assigneeId;
    }
    if (filters.status !== undefined) {
      if (!this.isTaskStatus(filters.status)) {
        throw new Error("Invalid task status");
      }
      validatedFilters.status = filters.status;
    }
    if (filters.priority !== undefined) {
      validatedFilters.priority = this.validatePriority(filters.priority);
    }
    const tasks =
      await this.taskRepository.getAllTasks(validatedFilters);

    return tasks.map((task) =>
      this.mapToDto(task)
    );
  }

  // ==========================================
  // 3. GET TASKS BY PROJECT ID
  // ==========================================
  async getTasksByProjectId(
    projectId: number,
    actor: TaskStatusActor
  ): Promise<TaskDto[]> {
    this.validateId(projectId, "project ID");
    this.validateReadActor(actor);

    const project =
      await this.projectRepository.getProjectById(
        projectId
      );

    if (!project) {
      throw new Error("Project not found");
    }

    const tasks =
      await this.taskRepository.getTasksByProjectId(
        projectId
      );

    // ADMIN sees all tasks in the project.
    if (actor.role === "ADMIN") {
      return tasks.map((task) =>
        this.mapToDto(task)
      );
    }

    // TEAM_MEMBER sees only assigned tasks.
    const assignedTasks = tasks.filter(
      (task) => task.assigneeId === actor.userId
    );

    return assignedTasks.map((task) =>
      this.mapToDto(task)
    );
  }

  // ==========================================
  // 4. GET TASK BY ID
  // ==========================================
  async getTaskById(
    taskId: number,
    actor: TaskStatusActor
  ): Promise<TaskDto | null> {
    this.validateId(taskId, "task ID");
    this.validateReadActor(actor);

    const task =
      await this.taskRepository.getTaskById(
        taskId
      );

    if (!task) {
      return null;
    }

    // ADMIN can view every task.
    if (actor.role === "ADMIN") {
      return this.mapToDto(task);
    }

    // TEAM_MEMBER cannot view another user's task.
    // Return null to avoid disclosing its existence.
    if (task.assigneeId !== actor.userId) {
      return null;
    }

    return this.mapToDto(task);
  }

  // ==========================================
  // 5. UPDATE TASK
  // ==========================================
  async updateTask(
    taskId: number,
    dto: UpdateTaskDto
  ): Promise<TaskDto> {
    this.validateId(taskId, "task ID");
    this.validateVersion(dto.expectedVersion);

    const title = this.validateTitle(dto.title);

    const description = this.validateDescription(
      dto.description
    );

    const priority = this.validatePriority(
      dto.priority
    );

    const dueAt = this.parseDueAt(dto.dueAt);

    const task =
      await this.getExistingTask(taskId);

    await this.ensureProjectActive(
      task.projectId
    );

    this.ensureVersionMatches(
      task.version,
      dto.expectedVersion
    );

    const updated =
      await this.taskRepository.updateTask(
        taskId,
        dto.expectedVersion,
        {
          title,
          description,
          priority,
          dueAt,
        }
      );

    if (!updated) {
      throw new Error(
        "Task version conflict"
      );
    }

    return this.mapToDto(updated);
  }

  // ==========================================
  // 6. CHANGE TASK STATUS
  // ==========================================
  async changeTaskStatus(
    taskId: number,
    expectedVersion: number,
    newStatus: TaskStatus,
    actorUserId: number,
    actorRole: TaskActorRole
  ): Promise<TaskDto> {
    this.validateId(taskId, "task ID");
    this.validateVersion(expectedVersion);

    this.validateId(
      actorUserId,
      "actor user ID"
    );

    if (
      actorRole !== "ADMIN" &&
      actorRole !== "TEAM_MEMBER"
    ) {
      throw new Error(
        "Task status change forbidden"
      );
    }

    if (!this.isTaskStatus(newStatus)) {
      throw new Error(
        "Invalid task status"
      );
    }

    const task =
      await this.getExistingTask(taskId);

    // TEAM_MEMBER can change only
    // their own assigned task.
    if (
      actorRole === "TEAM_MEMBER" &&
      task.assigneeId !== actorUserId
    ) {
      throw new Error(
        "Task status change forbidden"
      );
    }

    await this.ensureProjectActive(
      task.projectId
    );

    this.ensureVersionMatches(
      task.version,
      expectedVersion
    );

    // Allowed workflow:
    // TODO -> IN_PROGRESS -> DONE
    const allowedTransitions: Record<
      TaskStatus,
      TaskStatus[]
    > = {
      TODO: ["IN_PROGRESS"],
      IN_PROGRESS: ["DONE"],
      DONE: [],
    };

    if (
      !allowedTransitions[task.status].includes(
        newStatus
      )
    ) {
      throw new Error(
        "Invalid task status transition"
      );
    }

    // Repository checks authorization
    // and status again inside its transaction.
    const updated =
      await this.taskRepository.changeTaskStatus(
        taskId,
        expectedVersion,
        newStatus,
        {
          userId: actorUserId,
          role: actorRole,
        }
      );

    if (!updated) {
      throw new Error(
        "Task version conflict"
      );
    }

    return this.mapToDto(updated);
  }

  // ==========================================
  // 7. REASSIGN TASK
  // ==========================================
  async reassignTask(
    taskId: number,
    expectedVersion: number,
    assigneeId: number,
    actorId?: number
  ): Promise<TaskDto> {
    this.validateId(taskId, "task ID");
    this.validateVersion(expectedVersion);

    // Reassignment must preserve an owner just as task creation does.
    if (assigneeId === undefined || assigneeId === null) {
      throw new Error("Assignee ID is required");
    }
    this.validateId(assigneeId, "assignee ID");
    const assignee = await this.userRepository.getUserById(assigneeId);
    if (!assignee || !assignee.isActive) {
      throw new Error("Assignee not found or inactive");
    }

    const task =
      await this.getExistingTask(taskId);

    await this.ensureProjectActive(
      task.projectId
    );

    this.ensureVersionMatches(
      task.version,
      expectedVersion
    );

    const updated =
      await this.taskRepository.reassignTask(
        taskId,
        expectedVersion,
        assigneeId, ...(actorId === undefined ? [] : [actorId])
      );

    if (!updated) {
      throw new Error(
        "Task version conflict"
      );
    }

    return this.mapToDto(updated);
  }

  // ==========================================
  // DELETE TASK
  // ==========================================
  async deleteTask(taskId: number, expectedVersion: number): Promise<boolean> {
    this.validateId(taskId, "task ID");
    this.validateVersion(expectedVersion);
    // The repository checks the project and latest task version inside one transaction.
    return this.taskRepository.deleteTask(taskId, expectedVersion);
  }

  // ==========================================
  // READ AUTHORIZATION
  // ==========================================
  private validateReadActor(
    actor: TaskStatusActor
  ): void {
    if (
      !actor ||
      !Number.isSafeInteger(actor.userId) ||
      actor.userId <= 0 ||
      (
        actor.role !== "ADMIN" &&
        actor.role !== "TEAM_MEMBER"
      )
    ) {
      throw new Error(
        "Task read access forbidden"
      );
    }
  }

  // ==========================================
  // VALIDATE ID
  // ==========================================
  private validateId(
    value: number,
    field: string
  ): void {
    if (
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new Error(
        `Invalid ${field}`
      );
    }
  }

  // ==========================================
  // VALIDATE VERSION
  // ==========================================
  private validateVersion(
    version: number
  ): void {
    if (
      !Number.isSafeInteger(version) ||
      version < 1
    ) {
      throw new Error(
        "Invalid expected version"
      );
    }
  }

  // ==========================================
  // VALIDATE TITLE
  // ==========================================
  private validateTitle(
    value: string
  ): string {
    if (typeof value !== "string") {
      throw new Error(
        "Invalid task title"
      );
    }

    const title = value.trim();

    if (
      !title ||
      title.length > 200
    ) {
      throw new Error(
        "Invalid task title"
      );
    }

    return title;
  }

  // ==========================================
  // VALIDATE DESCRIPTION
  // ==========================================
  private validateDescription(
    value: string | null | undefined
  ): string | null {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error(
        "Invalid task description"
      );
    }

    return value.trim() || null;
  }

  // ==========================================
  // VALIDATE PRIORITY
  // ==========================================
  private validatePriority(
    value: TaskPriority
  ): TaskPriority {
    if (
      value !== "LOW" &&
      value !== "MEDIUM" &&
      value !== "HIGH"
    ) {
      throw new Error(
        "Invalid task priority"
      );
    }

    return value;
  }

  // ==========================================
  // VALIDATE STATUS
  // ==========================================
  private isTaskStatus(
    value: unknown
  ): value is TaskStatus {
    return (
      value === "TODO" ||
      value === "IN_PROGRESS" ||
      value === "DONE"
    );
  }

  
  // ==========================================
  // PARSE AND VALIDATE TASK DUE DATE
  // ==========================================
  private parseDueAt(
    value: string | null | undefined
  ): Date | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Invalid task due date");
    }

    // ISO 8601 with explicit timezone
    const isoPattern =
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/;

    const match = isoPattern.exec(value);

    if (!match) {
      throw new Error("Invalid task due date");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);

    // Validate year, month and time
    if (
      year < 1 ||
      year > 9999 ||
      month < 1 ||
      month > 12 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      throw new Error("Invalid task due date");
    }

    // Leap year calculation
    const isLeapYear =
      year % 4 === 0 &&
      (year % 100 !== 0 || year % 400 === 0);

    const daysInMonth = [
      31,
      isLeapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];

    // Reject impossible calendar dates
    if (
      day < 1 ||
      day > daysInMonth[month - 1]
    ) {
      throw new Error("Invalid task due date");
    }

    // Validate explicit timezone offset
    if (match[8] !== "Z") {
      const offsetHours = Number(match[10]);
      const offsetMinutes = Number(match[11]);

      if (
        offsetHours > 14 ||
        offsetMinutes > 59 ||
        (offsetHours === 14 && offsetMinutes !== 0)
      ) {
        throw new Error("Invalid task due date");
      }
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid task due date");
    }

    return date;
  }

  // ==========================================
  // GET EXISTING TASK
  // ==========================================
  private async getExistingTask(
    taskId: number
  ): Promise<Task> {
    const task =
      await this.taskRepository.getTaskById(
        taskId
      );

    if (!task) {
      throw new Error(
        "Task not found"
      );
    }

    return task;
  }

  // ==========================================
  // CHECK ACTIVE PROJECT
  // ==========================================
  private async ensureProjectActive(
    projectId: number
  ): Promise<void> {
    const project =
      await this.projectRepository.getProjectById(
        projectId
      );

    if (
      !project ||
      project.isArchived
    ) {
      throw new Error(
        "Archived project cannot be modified"
      );
    }
  }

  // ==========================================
  // CHECK EXPECTED VERSION
  // ==========================================
  private ensureVersionMatches(
    currentVersion: number,
    expectedVersion: number
  ): void {
    if (
      currentVersion !== expectedVersion
    ) {
      throw new Error(
        "Task version conflict"
      );
    }
  }

  // ==========================================
  // MAP TASK TO DTO
  // ==========================================
  private mapToDto(
    task: Task
  ): TaskDto {
    return {
      taskId: task.taskId,
      projectId: task.projectId,
      assigneeId: task.assigneeId,
      createdBy: task.createdBy,
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
