
import { Request, Response, NextFunction } from "express";

import { TaskService } from "../../application/services/TaskService";

import { ROLES } from "../middlewares/authorizationMiddleware";

import {
  TaskStatusActor,
  TaskFilters,
} from "../../domain/repositories/ITaskRepository";

export class TaskController {
  constructor(
    private readonly taskService: TaskService
  ) {}

  // ==========================================
  // VERIFIED ACTOR FROM AUTH MIDDLEWARE
  // ==========================================
  private getActor(
    res: Response
  ): TaskStatusActor | null {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return null;
    }

    const role =
      authUser.roleId === ROLES.ADMIN
        ? "ADMIN"
        : authUser.roleId === ROLES.TEAM_MEMBER
          ? "TEAM_MEMBER"
          : null;

    if (
      !role ||
      !Number.isSafeInteger(authUser.userId) ||
      authUser.userId <= 0
    ) {
      return null;
    }

    return {
      userId: authUser.userId,
      role,
    };
  }

  // ==========================================
  // 1. CREATE TASK
  // ==========================================
  createTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authUser = res.locals.authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const {
        projectId,
        title,
        description,
        assigneeId,
        priority,
        dueAt,
      } = req.body ?? {};

      const task = await this.taskService.createTask(
        {
          projectId,
          title,
          description,
          assigneeId,
          priority,
          dueAt,
        },
        authUser.userId
      );

      res.status(201).json({
        success: true,
        message: "Task created successfully",
        data: task,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 2. GET ALL TASKS
  // ADMIN ONLY (ROUTE PROTECTED)
  // ==========================================
  getAllTasks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tasks =
        await this.taskService.getAllTasks(this.parseTaskFilters(req.query));

      res.status(200).json({
        success: true,
        message: "Tasks retrieved successfully",
        data: tasks,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 3. GET TASKS BY PROJECT ID
  // ==========================================
  getTasksByProjectId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projectId = this.parseId(
        req.params.projectId
      );

      if (projectId === null) {
        this.badRequest(res, "Invalid project ID");
        return;
      }

      const actor = this.getActor(res);

      if (!actor) {
        res.status(403).json({
          success: false,
          message: "Task read access forbidden",
        });
        return;
      }

      // FIX: Pass both projectId and actor.
      const tasks =
        await this.taskService.getTasksByProjectId(
          projectId,
          actor
        );

      res.status(200).json({
        success: true,
        message: "Project tasks retrieved successfully",
        data: tasks,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 4. GET TASK BY ID
  // ==========================================
  getTaskById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const taskId = this.parseId(req.params.id);

      if (taskId === null) {
        this.badRequest(res, "Invalid task ID");
        return;
      }

      const actor = this.getActor(res);

      if (!actor) {
        res.status(403).json({
          success: false,
          message: "Task read access forbidden",
        });
        return;
      }

      // FIX: Pass both taskId and actor.
      const task =
        await this.taskService.getTaskById(
          taskId,
          actor
        );

      if (!task) {
        res.status(404).json({
          success: false,
          message: "Task not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Task retrieved successfully",
        data: task,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 5. UPDATE TASK
  // ADMIN ONLY (ROUTE PROTECTED)
  // ==========================================
  updateTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const taskId = this.parseId(req.params.id);

      if (taskId === null) {
        this.badRequest(res, "Invalid task ID");
        return;
      }

      const {
        title,
        description,
        priority,
        dueAt,
        expectedVersion,
      } = req.body ?? {};

      const task = await this.taskService.updateTask(
        taskId,
        {
          title,
          description,
          priority,
          dueAt,
          expectedVersion,
        }
      );

      res.status(200).json({
        success: true,
        message: "Task updated successfully",
        data: task,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 6. CHANGE TASK STATUS
  // ==========================================
  changeTaskStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authUser = res.locals.authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const taskId = this.parseId(req.params.id);

      if (taskId === null) {
        this.badRequest(res, "Invalid task ID");
        return;
      }

      const actor = this.getActor(res);

      if (!actor) {
        res.status(403).json({
          success: false,
          message: "Task status change forbidden",
        });
        return;
      }

      const {
        expectedVersion,
        status,
      } = req.body ?? {};

      const task =
        await this.taskService.changeTaskStatus(
          taskId,
          expectedVersion,
          status,
          actor.userId,
          actor.role
        );

      res.status(200).json({
        success: true,
        message: "Task status updated successfully",
        data: task,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 7. REASSIGN TASK
  // ADMIN ONLY (ROUTE PROTECTED)
  // ==========================================
  reassignTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const taskId = this.parseId(req.params.id);

      if (taskId === null) {
        this.badRequest(res, "Invalid task ID");
        return;
      }

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !Object.prototype.hasOwnProperty.call(
          body,
          "assigneeId"
        )
      ) {
        this.badRequest(
          res,
          "Assignee ID is required"
        );
        return;
      }

      const {
        expectedVersion,
        assigneeId,
      } = body;

      const task =
        await this.taskService.reassignTask(
          taskId,
          expectedVersion,
          assigneeId, res.locals?.authUser?.userId
        );

      res.status(200).json({
        success: true,
        message: "Task reassigned successfully",
        data: task,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // DELETE TASK - ADMIN ONLY (ROUTE PROTECTED)
  // ==========================================
  deleteTask = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const taskId = this.parseId(req.params.id);
      if (taskId === null) {
        this.badRequest(res, "Invalid task ID");
        return;
      }

      // Keep deletion consistent with existing task mutations by requiring expectedVersion.
      const deleted = await this.taskService.deleteTask(taskId, req.body?.expectedVersion);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Task not found" });
        return;
      }
      res.status(200).json({ success: true, message: "Task deleted successfully" });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // PARSE TASK LIST FILTERS
  // ==========================================
  private parseTaskFilters(query: Request["query"]): TaskFilters {
    const filters: TaskFilters = {};
    // Express's simple parser keeps bracket syntax as literal keys; reject it explicitly too.
    const invalidFilterMessages = {
      projectId: "Invalid project ID", assigneeId: "Invalid assignee ID",
      status: "Invalid task status", priority: "Invalid task priority",
    };
    for (const [field, message] of Object.entries(invalidFilterMessages)) {
      if (Object.keys(query).some(key => key.startsWith(`${field}[`))) {
        throw new Error(message);
      }
    }
    // Arrays, duplicate parameters, blank IDs and nested query objects are rejected.
    for (const field of ["projectId", "assigneeId"] as const) {
      if (query[field] !== undefined) {
        const value = query[field];
        const id = typeof value === "string" ? this.parseId(value) : null;
        if (id === null) {
          throw new Error(field === "projectId" ? "Invalid project ID" : "Invalid assignee ID");
        }
        filters[field] = id;
      }
    }
    if (query.status !== undefined) {
      const status = query.status;
      if (status !== "TODO" && status !== "IN_PROGRESS" && status !== "DONE") {
        throw new Error("Invalid task status");
      }
      filters.status = status;
    }
    if (query.priority !== undefined) {
      const priority = query.priority;
      if (priority !== "LOW" && priority !== "MEDIUM" && priority !== "HIGH") {
        throw new Error("Invalid task priority");
      }
      filters.priority = priority;
    }
    return filters;
  }

  // ==========================================
  // VALIDATE URL ID
  // ==========================================
  private parseId(
    value: string | string[] | undefined
  ): number | null {
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*$/.test(value)
    ) {
      return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id)
      ? id
      : null;
  }

  // ==========================================
  // BAD REQUEST RESPONSE
  // ==========================================
  private badRequest(
    res: Response,
    message: string
  ): void {
    res.status(400).json({
      success: false,
      message,
    });
  }

  // ==========================================
  // ERROR HANDLER
  // ==========================================
  private handleError(
    error: unknown,
    res: Response,
    next: NextFunction
  ): void {
    if (!(error instanceof Error)) {
      next(error);
      return;
    }

    // ==========================================
    // 400 BAD REQUEST
    // ==========================================
    const badRequestMessages = [
      "Invalid project ID",
      "Invalid task ID",
      "Invalid task creator",
      "Invalid actor user ID",
      "Invalid assignee ID",
      // Missing or null assignees are invalid for task creation.
      "Assignee ID is required",
      "Invalid expected version",
      "Invalid task title",
      "Invalid task description",
      "Invalid task priority",
      "Invalid task due date",
      "Invalid task status",
      "Invalid task status transition",
    ];

    if (
      badRequestMessages.includes(error.message)
    ) {
      this.badRequest(res, error.message);
      return;
    }

    // ==========================================
    // 403 FORBIDDEN
    // ==========================================
    const forbiddenMessages = [
      "Task status change forbidden",
      "Task read access forbidden",
    ];

    if (
      forbiddenMessages.includes(error.message)
    ) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error.message ===
      "Task creator not found or inactive"
    ) {
      res.status(403).json({
        success: false,
        message: "Task creator is not authorized",
      });
      return;
    }

    // ==========================================
    // 404 NOT FOUND
    // ==========================================
    const notFoundMessages = [
      "Project not found",
      "Task not found",
    ];

    if (
      notFoundMessages.includes(error.message)
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // ==========================================
    // 409 CONFLICT
    // ==========================================
    const conflictMessages = [
      "Task version conflict",
      "Archived project cannot be modified",
      "Project not found or archived",
      "Assignee not found or inactive",
    ];

    if (
      conflictMessages.includes(error.message)
    ) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Other unexpected errors
    next(error);
  }
}
