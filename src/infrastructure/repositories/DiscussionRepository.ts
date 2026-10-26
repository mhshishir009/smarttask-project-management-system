import { EntityManager } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { DiscussionActor, DiscussionError, DiscussionPage, ProjectMessage } from "../../domain/entities/ProjectMessage";
import { IDiscussionRepository } from "../../domain/repositories/IDiscussionRepository";
import { NotificationWriter } from "./NotificationWriter";

interface MessageRow { id: string; project_id: string; author_id: string; body: string; created_at: Date; author_name: string }

export class DiscussionRepository implements IDiscussionRepository {
  constructor(private readonly notifications?: NotificationWriter) {}
  private async authorize(manager: EntityManager, projectId: number, actor: DiscussionActor, write: boolean) {
    // Parent-first locking matches task assignment, archive and project deletion operations.
    const projects: Array<{is_archived: boolean}> = await manager.query(
      `SELECT is_archived FROM projects WHERE id = $1 ${write ? "FOR UPDATE" : "FOR SHARE"}`, [projectId]);
    if (!projects.length) throw new DiscussionError("Project not found", "NOT_FOUND");
    const users: Array<{full_name: string; role_code: string}> = await manager.query(
      `SELECT u.full_name, r.code AS role_code FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE FOR SHARE OF u`, [actor.userId]);
    if (!users.length || users[0].role_code !== actor.role) throw new DiscussionError("Discussion access denied", "FORBIDDEN");
    if (actor.role !== "ADMIN") {
      if (actor.role !== "TEAM_MEMBER") throw new DiscussionError("Discussion access denied", "FORBIDDEN");
      const assignments: unknown[] = await manager.query("SELECT id FROM tasks WHERE project_id = $1 AND assignee_id = $2 LIMIT 1", [projectId, actor.userId]);
      if (!assignments.length) throw new DiscussionError("Discussion access requires an assigned task in this project", "FORBIDDEN");
    }
    if (write && projects[0].is_archived) throw new DiscussionError("Archived project discussions are read-only", "ARCHIVED");
    return {isArchived: projects[0].is_archived, authorName: users[0].full_name};
  }

  private map(row: MessageRow): ProjectMessage {
    const ids = [row.id, row.project_id, row.author_id].map(Number);
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Discussion numeric value is out of range");
    return {messageId: ids[0], projectId: ids[1], authorId: ids[2], authorName: row.author_name, body: row.body, createdAt: row.created_at};
  }

  listMessages(projectId: number, actor: DiscussionActor, before?: number): Promise<DiscussionPage> {
    return AppDataSource.transaction(async manager => {
      const access = await this.authorize(manager, projectId, actor, false);
      // Stable cursor pagination avoids losing messages when newer messages arrive.
      const rows: MessageRow[] = await manager.query(
        `SELECT m.id, m.project_id, m.author_id, m.body, m.created_at, u.full_name AS author_name
         FROM project_messages m JOIN users u ON u.id = m.author_id
         WHERE m.project_id = $1 AND ($2::bigint IS NULL OR m.id < $2)
         ORDER BY m.id DESC LIMIT 51`, [projectId, before ?? null]);
      const hasMore = rows.length > 50;
      const messages = rows.slice(0, 50).reverse().map(row => this.map(row));
      return {messages, nextBefore: hasMore ? messages[0].messageId : null, isArchived: access.isArchived};
    });
  }

  addMessage(projectId: number, actor: DiscussionActor, body: string): Promise<ProjectMessage> {
    return AppDataSource.transaction(async manager => {
      const access = await this.authorize(manager, projectId, actor, true);
      const rows: MessageRow[] = await manager.query(
        "INSERT INTO project_messages (project_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, project_id, author_id, body, created_at",
        [projectId, actor.userId, body]);
      await this.notifications?.record(manager, {kind: "DISCUSSION_MESSAGE", key: `discussion:${rows[0].id}`,
        actorId: actor.userId, projectId});
      return this.map({...rows[0], author_name: access.authorName});
    });
  }
}
