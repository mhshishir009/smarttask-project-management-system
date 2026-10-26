import { Request, Response, NextFunction } from "express";
import { DiscussionService } from "../../application/services/DiscussionService";
import { DiscussionActor, DiscussionError } from "../../domain/entities/ProjectMessage";
import { ROLES } from "../middlewares/authorizationMiddleware";

export class DiscussionController {
  constructor(private readonly service: DiscussionService) {}

  private id(value: unknown, label: string): number {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new DiscussionError(`Invalid ${label}`, "INVALID_INPUT");
    }
    return Number(value);
  }

  private actor(res: Response): DiscussionActor {
    const user = res.locals.authUser;
    if (!user || ![ROLES.ADMIN, ROLES.TEAM_MEMBER].includes(user.roleId)) throw new DiscussionError("Discussion access denied", "FORBIDDEN");
    return {userId: user.userId, role: user.roleId === ROLES.ADMIN ? "ADMIN" : "TEAM_MEMBER"};
  }

  private error(error: unknown, res: Response, next: NextFunction) {
    if (error instanceof DiscussionError) {
      const statuses = {INVALID_INPUT: 400, FORBIDDEN: 403, NOT_FOUND: 404, ARCHIVED: 409};
      res.status(statuses[error.code]).json({success: false, message: error.message});
    } else next(error);
  }

  listMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = await this.service.listMessages(this.id(req.params.projectId, "project ID"), this.actor(res),
        req.query.before === undefined ? undefined : this.id(req.query.before, "message cursor"));
      res.status(200).json({success: true, data: page});
    } catch (error) { this.error(error, res, next); }
  };

  addMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const message = await this.service.addMessage(this.id(req.params.projectId, "project ID"), this.actor(res), req.body?.body);
      res.status(201).json({success: true, message: "Message sent", data: message});
    } catch (error) { this.error(error, res, next); }
  };
}
