
import { Router } from "express";

import { RoleController } from "../controllers/RoleController";

import { createAuthMiddleware } from "../middlewares/authMiddleware";

import { requirePasswordChanged } from "../middlewares/authorizationMiddleware";

import { ITokenService } from "../../application/interfaces/ITokenService";

import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createRoleRoutes(
  roleController: RoleController,
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

  // All role endpoints require authentication
  // and completed mandatory password change.

  router.use(
    authMiddleware,
    requirePasswordChanged
  );

  // ==========================================
  // GET ALL ROLES
  // GET /api/roles
  // ==========================================

  router.get(
    "/",
    roleController.getAllRoles
  );

  // ==========================================
  // GET ROLE BY CODE
  // GET /api/roles/code/:code
  // ==========================================

  router.get(
    "/code/:code",
    roleController.getRoleByCode
  );

  // ==========================================
  // GET ROLE BY ID
  // GET /api/roles/:id
  // ==========================================

  router.get(
    "/:id",
    roleController.getRoleById
  );

  return router;
}
