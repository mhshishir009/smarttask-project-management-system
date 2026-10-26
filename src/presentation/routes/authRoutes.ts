
import { Router } from "express";

import { AuthController } from "../controllers/AuthController";
import { createAuthMiddleware } from "../middlewares/authMiddleware";

import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createAuthRoutes(
  authController: AuthController,
  tokenService: ITokenService,
  userRepository: IUserRepository
): Router {
  const router = Router();

  const authMiddleware = createAuthMiddleware(
    tokenService,
    userRepository
  );

  // Public signup requires no existing session; the service assigns TEAM_MEMBER.
  router.post("/register", authController.register);

  // Public Login API
  router.post(
    "/login",
    authController.login
  );

  // JWT-Protected Change Password API
  router.post(
    "/change-password",
    authMiddleware,
    authController.changePassword
  );

  return router;
}
