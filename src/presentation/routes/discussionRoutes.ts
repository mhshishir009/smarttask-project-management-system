import { Router } from "express";
import { DiscussionController } from "../controllers/DiscussionController";
import { createAuthMiddleware } from "../middlewares/authMiddleware";
import { requirePasswordChanged, requireRole } from "../middlewares/authorizationMiddleware";
import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export function createDiscussionRoutes(controller: DiscussionController, tokens: ITokenService, users: IUserRepository): Router {
  const router = Router();
  router.use(createAuthMiddleware(tokens, users), requirePasswordChanged, requireRole("ADMIN", "TEAM_MEMBER"));
  router.get("/:projectId/messages", controller.listMessages);
  router.post("/:projectId/messages", controller.addMessage);
  return router;
}
