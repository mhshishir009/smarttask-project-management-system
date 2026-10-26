import { describe, expect, it } from "vitest";
import { notificationTarget, type NotificationItem } from "../../../frontend/src/services/notifications";

describe("Notification destinations respect role and current access", () => {
  const base: NotificationItem = {notificationId: 1, kind: "TASK_ASSIGNED", message: "Update", projectId: 8, taskId: 9, createdAt: "2026-10-26T08:00:00Z", readAt: null, canOpen: true};
  it("takes admins and members to their authorized task page", () => {
    expect(notificationTarget(base, "ADMIN")).toBe("/tasks?workspaceTask=9");
    expect(notificationTarget(base, "TEAM_MEMBER")).toBe("/my-tasks?workspaceTask=9");
  });
  it("opens project-specific discussion directly", () => {
    expect(notificationTarget({...base, kind: "DISCUSSION_MESSAGE", taskId: null}, "TEAM_MEMBER")).toBe("/projects?workspaceProject=8&discussion=8");
  });
  it("opens project creation/archive targets", () => {
    expect(notificationTarget({...base, kind: "PROJECT_ARCHIVED", taskId: null}, "ADMIN")).toBe("/projects?workspaceProject=8");
  });
  it("does not navigate to deleted or inaccessible resources", () => {
    expect(notificationTarget({...base, canOpen: false}, "TEAM_MEMBER")).toBeNull();
    expect(notificationTarget({...base, projectId: null, taskId: null}, "ADMIN")).toBeNull();
  });
});
