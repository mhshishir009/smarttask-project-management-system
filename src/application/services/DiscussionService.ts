import { DiscussionActor, DiscussionError } from "../../domain/entities/ProjectMessage";
import { IDiscussionRepository } from "../../domain/repositories/IDiscussionRepository";

export class DiscussionService {
  constructor(private readonly repository: IDiscussionRepository) {}

  private validate(projectId: number, actor: DiscussionActor) {
    if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new DiscussionError("Invalid project ID", "INVALID_INPUT");
    if (!actor || !Number.isSafeInteger(actor.userId) || actor.userId <= 0 || !["ADMIN", "TEAM_MEMBER"].includes(actor.role)) {
      throw new DiscussionError("Discussion access denied", "FORBIDDEN");
    }
  }

  listMessages(projectId: number, actor: DiscussionActor, before?: number) {
    this.validate(projectId, actor);
    if (before !== undefined && (!Number.isSafeInteger(before) || before <= 0)) throw new DiscussionError("Invalid message cursor", "INVALID_INPUT");
    return this.repository.listMessages(projectId, actor, before);
  }

  addMessage(projectId: number, actor: DiscussionActor, value: unknown) {
    this.validate(projectId, actor);
    if (typeof value !== "string" || !value.trim() || value.length > 2000) {
      throw new DiscussionError("Message must contain 1 to 2000 characters", "INVALID_INPUT");
    }
    // Author identity comes only from the authenticated actor, never request body fields.
    return this.repository.addMessage(projectId, actor, value.trim());
  }
}
