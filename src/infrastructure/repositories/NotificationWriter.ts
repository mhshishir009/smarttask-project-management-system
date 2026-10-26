import { EntityManager } from "typeorm";

export type NotificationKind = "PROJECT_CREATED" | "PROJECT_ARCHIVED" | "TASK_ASSIGNED" | "TASK_REASSIGNED" | "TASK_STATUS_CHANGED" | "DISCUSSION_MESSAGE";
export interface NotificationEvent {
  kind: NotificationKind;
  key: string;
  actorId: number;
  projectId: number;
  taskId?: number;
  assigneeId?: number | null;
  previousAssigneeId?: number | null;
  status?: string;
}

// Called only after successful writes, with their transaction manager. Failures roll back both.
export class NotificationWriter {
  async record(manager: EntityManager, event: NotificationEvent): Promise<void> {
    if (!Number.isSafeInteger(event.actorId) || event.actorId <= 0) throw new Error("Notification actor is required");
    const context = await manager.query(`SELECT p.name AS project_name, a.full_name AS actor_name,
      t.title AS task_title, old_user.full_name AS old_name, new_user.full_name AS new_name
      FROM projects p JOIN users a ON a.id = $2
      LEFT JOIN tasks t ON t.id = $3 AND t.project_id = p.id
      LEFT JOIN users old_user ON old_user.id = $4
      LEFT JOIN users new_user ON new_user.id = $5 WHERE p.id = $1`,
      [event.projectId, event.actorId, event.taskId ?? null, event.previousAssigneeId ?? null, event.assigneeId ?? null]);
    if (!context.length) throw new Error("Notification context unavailable");
    const row = context[0];
    let message: string;
    switch (event.kind) {
      case "PROJECT_CREATED": message = `${row.actor_name} created project “${row.project_name}”.`; break;
      case "PROJECT_ARCHIVED": message = `${row.actor_name} archived project “${row.project_name}”.`; break;
      case "TASK_ASSIGNED": message = `${row.actor_name} created and assigned task “${row.task_title}” to ${row.new_name}.`; break;
      case "TASK_REASSIGNED": message = `${row.actor_name} reassigned “${row.task_title}” from ${row.old_name ?? "Unassigned"} to ${row.new_name}.`; break;
      case "TASK_STATUS_CHANGED": message = `${row.actor_name} marked “${row.task_title}” as ${{TODO: "To Do", IN_PROGRESS: "In Progress", DONE: "Completed"}[event.status ?? ""] ?? event.status}.`; break;
      case "DISCUSSION_MESSAGE": message = `${row.actor_name} posted in “${row.project_name}” discussion.`; break;
    }
    let members = [event.assigneeId, event.previousAssigneeId].filter((id): id is number => typeof id === "number");
    if (event.kind === "PROJECT_ARCHIVED" || event.kind === "DISCUSSION_MESSAGE") {
      const assignments = await manager.query("SELECT DISTINCT assignee_id FROM tasks WHERE project_id = $1 AND assignee_id IS NOT NULL", [event.projectId]);
      members = assignments.map((assignment: {assignee_id: string}) => Number(assignment.assignee_id));
    }
    // INSERT ... SELECT deduplicates admins who are also assignees; event keys protect retries.
    await manager.query(`INSERT INTO notifications(recipient_id,event_key,kind,message,project_id,task_id,read_at)
      SELECT u.id,$1,$2,$3,$4,$5,CASE WHEN u.id = $6 THEN NOW() ELSE NULL END
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.is_active = TRUE AND (r.code = 'ADMIN' OR (r.code = 'TEAM_MEMBER' AND u.id = ANY($7::bigint[])))
      ON CONFLICT (recipient_id,event_key) DO NOTHING`,
      [event.key, event.kind, message, event.projectId, event.taskId ?? null, event.actorId, members]);
  }
}
