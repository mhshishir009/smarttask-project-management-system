import type { UserRole } from "../context/AuthContext";
export interface NotificationItem {
  notificationId: number;
  kind: string;
  message: string;
  projectId: number | null;
  taskId: number | null;
  createdAt: string;
  readAt: string | null;
  canOpen: boolean;
}
export interface NotificationPage {notifications: NotificationItem[]; unreadCount: number; nextBefore: number | null}

// Only internal, role-appropriate destinations are constructed from server target IDs.
export function notificationTarget(item: NotificationItem, role: UserRole): string | null {
  if (!item.canOpen) return null;
  if (item.kind.startsWith("TASK_") && item.taskId) return `${role === "ADMIN" ? "/tasks" : "/my-tasks"}?workspaceTask=${item.taskId}`;
  if (item.kind === "DISCUSSION_MESSAGE" && item.projectId) return `/projects?workspaceProject=${item.projectId}&discussion=${item.projectId}`;
  return item.projectId ? `/projects?workspaceProject=${item.projectId}` : null;
}
