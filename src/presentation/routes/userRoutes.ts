
import { Router } from "express";

import { UserController } from "../controllers/UserController";

import { createAuthMiddleware } from "../middlewares/authMiddleware";

import {
  requireRole,
  requirePasswordChanged,
} from "../middlewares/authorizationMiddleware";

import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createUserRoutes(
  userController: UserController,
  tokenService: ITokenService,
  userRepository: IUserRepository
): Router {
  const router = Router();

  // JWT Authentication Middleware
  const authMiddleware = createAuthMiddleware(
    tokenService,
    userRepository
  );

  // Apply security to every User API
  router.use(
    authMiddleware,
    requirePasswordChanged,
    requireRole("ADMIN")
  );

  // ==========================================
  // 1. CREATE USER
  // POST /api/users
  // ==========================================
  router.post("/", userController.createUser);

  // ==========================================
  // 2. GET ALL USERS
  // GET /api/users
  // ==========================================
  router.get("/", userController.getAllUsers);

  // ==========================================
  // 3. GET USER BY ID
  // GET /api/users/:id
  // ==========================================
  router.get("/:id", userController.getUserById);

  // ==========================================
  // 4. UPDATE USER
  // PUT /api/users/:id
  // ==========================================
  router.put("/:id", userController.updateUser);

  // ==========================================
  // 5. DEACTIVATE USER
  // PATCH /api/users/:id/deactivate
  // ==========================================
  router.patch(
    "/:id/deactivate",
    userController.deactivateUser
  );

  return router;
}
