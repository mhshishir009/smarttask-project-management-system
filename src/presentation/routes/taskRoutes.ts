
import { Router } from "express";

import { TaskController } from "../controllers/TaskController";
import { createAuthMiddleware } from "../middlewares/authMiddleware";

import {
  requireRole,
  requirePasswordChanged,
} from "../middlewares/authorizationMiddleware";

import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createTaskRoutes(
  taskController: TaskController,
  tokenService: ITokenService,
  userRepository: IUserRepository
): Router {
  const router = Router();

  // ==========================================
  // JWT AUTHENTICATION
  // ==========================================
  const authMiddleware = createAuthMiddleware(
    tokenService,
    userRepository
  );

  // Protect all Task APIs
  router.use(
    authMiddleware,
    requirePasswordChanged
  );

  // ==========================================
  // 1. CREATE TASK - ADMIN ONLY
  // ==========================================
  router.post(
    "/",
    requireRole("ADMIN"),
    taskController.createTask
  );

  // ==========================================
  // 2. GET ALL TASKS - ADMIN ONLY
  // ==========================================
  router.get(
    "/",
    requireRole("ADMIN"),
    taskController.getAllTasks
  );

  // ==========================================
  // 3. GET TASKS BY PROJECT
  // ==========================================
  router.get(
    "/project/:projectId",
    requireRole("ADMIN", "TEAM_MEMBER"),
    taskController.getTasksByProjectId
  );

  // ==========================================
  // 4. GET TASK BY ID
  // ==========================================
  router.get(
    "/:id",
    requireRole("ADMIN", "TEAM_MEMBER"),
    taskController.getTaskById
  );

  // ==========================================
  // 5. UPDATE TASK - ADMIN ONLY
  // ==========================================
  router.put(
    "/:id",
    requireRole("ADMIN"),
    taskController.updateTask
  );

  // ==========================================
  // 6. CHANGE TASK STATUS - ADMIN ONLY FOR NOW
  // ==========================================
  router.patch(
  "/:id/status",
  requireRole("ADMIN", "TEAM_MEMBER"),
  taskController.changeTaskStatus
);

  // ==========================================
  // 7. REASSIGN TASK - ADMIN ONLY
  // ==========================================
  router.patch(
    "/:id/assign",
    requireRole("ADMIN"),
    taskController.reassignTask
  );

  // Authentication and password-change checks above also protect this admin-only deletion.
  router.delete(
    "/:id",
    requireRole("ADMIN"),
    taskController.deleteTask
  );

  return router;
}
