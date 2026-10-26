
import { Router } from "express";

import { ProjectController } from "../controllers/ProjectController";

import { createAuthMiddleware } from "../middlewares/authMiddleware";

import {
  requireRole,
  requirePasswordChanged,
} from "../middlewares/authorizationMiddleware";

import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createProjectRoutes(
  projectController: ProjectController,
  tokenService: ITokenService,
  userRepository: IUserRepository
): Router {
  const router = Router();

  // JWT Authentication
  const authMiddleware = createAuthMiddleware(
    tokenService,
    userRepository
  );

  // Authentication and password change check
  // apply to all project routes
  router.use(authMiddleware, requirePasswordChanged);

  // ==========================================
  // 1. CREATE PROJECT - ADMIN ONLY
  // ==========================================
  router.post(
    "/",
    requireRole("ADMIN"),
    projectController.createProject
  );

  // ==========================================
  // 2. GET ALL PROJECTS
  // ==========================================
  router.get(
    "/",
    requireRole("ADMIN", "TEAM_MEMBER"),
    projectController.getAllProjects
  );

  // ==========================================
  // 3. GET PROJECT BY ID
  // ==========================================
  router.get(
    "/:id",
    requireRole("ADMIN", "TEAM_MEMBER"),
    projectController.getProjectById
  );

  // ==========================================
  // 4. UPDATE PROJECT - ADMIN ONLY
  // ==========================================
  router.put(
    "/:id",
    requireRole("ADMIN"),
    projectController.updateProject
  );

  // ==========================================
  // 5. ARCHIVE PROJECT - ADMIN ONLY
  // ==========================================
  router.patch(
    "/:id/archive",
    requireRole("ADMIN"),
    projectController.archiveProject
  );

  // Only administrators may permanently delete an empty project.
  router.delete(
    "/:id",
    requireRole("ADMIN"),
    projectController.deleteProject
  );

  return router;
}
