import { AppDataSource } from "../database/data-source";

export class NotificationRepository {
  async list(userId: number, role: string, before?: number) {
    // Current permissions decide navigation; historical notifications grant no extra access.
    return AppDataSource.transaction("REPEATABLE READ", async manager => {
      const rows = await manager.query(`SELECT n.*,
        CASE WHEN n.kind LIKE 'TASK_%' THEN t.id IS NOT NULL AND ($2 = 'ADMIN' OR t.assignee_id = $1)
          WHEN n.kind = 'DISCUSSION_MESSAGE' THEN p.id IS NOT NULL AND ($2 = 'ADMIN' OR EXISTS
            (SELECT 1 FROM tasks assigned WHERE assigned.project_id = p.id AND assigned.assignee_id = $1))
          ELSE p.id IS NOT NULL AND ($2 = 'ADMIN' OR EXISTS
            (SELECT 1 FROM tasks assigned WHERE assigned.project_id = p.id AND assigned.assignee_id = $1)) END AS can_open
        FROM notifications n LEFT JOIN projects p ON p.id = n.project_id LEFT JOIN tasks t ON t.id = n.task_id
        WHERE n.recipient_id = $1 AND ($3::bigint IS NULL OR n.id < $3) ORDER BY n.id DESC LIMIT 31`, [userId, role, before ?? null]);
      const counts = await manager.query("SELECT COUNT(*)::int AS unread_count FROM notifications WHERE recipient_id = $1 AND read_at IS NULL", [userId]);
      const notifications = rows.slice(0, 30).map((row: Record<string, any>) => ({
        notificationId: Number(row.id), kind: row.kind, message: row.message,
        projectId: row.project_id === null ? null : Number(row.project_id), taskId: row.task_id === null ? null : Number(row.task_id),
        createdAt: row.created_at, readAt: row.read_at, canOpen: row.can_open,
      }));
      return {notifications, unreadCount: counts[0].unread_count, nextBefore: rows.length > 30 ? notifications[29].notificationId : null};
    });
  }

  async markRead(userId: number, id: number): Promise<boolean> {
    const rows = await AppDataSource.query("UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND recipient_id = $2 RETURNING id", [id, userId]);
    return rows[0].length > 0;
  }
  async markAllRead(userId: number, throughId: number): Promise<void> {
    // A bounded snapshot keeps messages arriving after the click unread.
    await AppDataSource.query("UPDATE notifications SET read_at = NOW() WHERE recipient_id = $1 AND id <= $2 AND read_at IS NULL", [userId, throughId]);
  }
}
