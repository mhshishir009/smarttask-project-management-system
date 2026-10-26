import { DiscussionActor, DiscussionPage, ProjectMessage } from "../entities/ProjectMessage";

export interface IDiscussionRepository {
  listMessages(projectId: number, actor: DiscussionActor, before?: number): Promise<DiscussionPage>;
  addMessage(projectId: number, actor: DiscussionActor, body: string): Promise<ProjectMessage>;
}
