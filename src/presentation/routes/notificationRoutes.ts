import { Router, Request, Response, NextFunction } from "express";
import { ITokenService } from "../../application/interfaces/ITokenService";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { NotificationRepository } from "../../infrastructure/repositories/NotificationRepository";
import { createAuthMiddleware } from "../middlewares/authMiddleware";
import { requirePasswordChanged, requireRole, ROLES } from "../middlewares/authorizationMiddleware";

export function createNotificationRoutes(repository: NotificationRepository, tokens: ITokenService, users: IUserRepository) {
  const router = Router();
  router.use(createAuthMiddleware(tokens, users), requirePasswordChanged, requireRole("ADMIN", "TEAM_MEMBER"));
  const positiveId = (value: unknown) => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = req.query.before === undefined ? undefined : positiveId(req.query.before);
      if (before === null) {res.status(400).json({success: false, message: "Invalid notification cursor"}); return;}
      const actor = res.locals.authUser;
      res.json({success: true, data: await repository.list(actor.userId, actor.roleId === ROLES.ADMIN ? "ADMIN" : "TEAM_MEMBER", before)});
    } catch (error) {next(error);}
  });
  router.patch("/read-all", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.body?.throughId;
      if (!Number.isSafeInteger(id) || id <= 0) {res.status(400).json({success: false, message: "Invalid notification snapshot"}); return;}
      await repository.markAllRead(res.locals.authUser.userId, id);
      res.json({success: true});
    } catch (error) {next(error);}
  });
  router.patch("/:id/read", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = positiveId(req.params.id);
      if (id === null) {res.status(400).json({success: false, message: "Invalid notification ID"}); return;}
      if (!await repository.markRead(res.locals.authUser.userId, id)) {res.status(404).json({success: false, message: "Notification not found"}); return;}
      res.json({success: true});
    } catch (error) {next(error);}
  });
  return router;
}
