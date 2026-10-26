import api from "./api";
import type { UserRole } from "../context/AuthContext";

export interface WorkspaceResult {
  kind: "project" | "task" | "user";
  id: number;
  label: string;
  href: string;
}
interface Project { projectId: number; name: string; description?: string | null }
interface Task { taskId: number; title: string; description?: string | null; assigneeId: number | null }
interface User { userId: number; fullName: string; email: string }

function list<T>(response: {data?: {data?: unknown}}): T[] {
  if (!Array.isArray(response.data?.data)) throw new Error("Unexpected search response.");
  return response.data.data as T[];
}

// Reuse protected APIs. Members never query admin-only task/user lists.
export async function searchWorkspace(query: string, role: UserRole, userId: number, signal?: AbortSignal): Promise<WorkspaceResult[]> {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const matches = (...values: Array<string | number | null | undefined>) => values.some(value => String(value ?? "").toLowerCase().includes(term));
  let projects: Project[];
  let tasks: Task[];
  let users: User[] = [];
  if (role === "ADMIN") {
    const responses = await Promise.all([api.get("/projects", {signal}), api.get("/tasks", {signal}), api.get("/users", {signal})]);
    projects = list<Project>(responses[0]); tasks = list<Task>(responses[1]); users = list<User>(responses[2]);
  } else {
    projects = list<Project>(await api.get("/projects", {signal}));
    const responses = await Promise.all(projects.map(project => api.get(`/tasks/project/${project.projectId}`, {signal})));
    tasks = responses.flatMap(response => list<Task>(response)).filter(task => task.assigneeId === userId);
  }
  // Group limits keep one record type from hiding all matches from another type.
  return [
    ...projects.filter(project => matches(project.name, project.description, project.projectId, `#${project.projectId}`)).slice(0, 4).map(project => ({
      kind: "project" as const, id: project.projectId, label: project.name, href: `/projects?workspaceProject=${project.projectId}`,
    })),
    ...tasks.filter(task => matches(task.title, task.description, task.taskId, `#${task.taskId}`)).slice(0, 4).map(task => ({
      kind: "task" as const, id: task.taskId, label: task.title, href: `${role === "ADMIN" ? "/tasks" : "/my-tasks"}?workspaceTask=${task.taskId}`,
    })),
    ...users.filter(user => matches(user.fullName, user.email, user.userId, `#${user.userId}`)).slice(0, 4).map(user => ({
      kind: "user" as const, id: user.userId, label: user.fullName, href: `/users?workspaceUser=${user.userId}`,
    })),
  ];
}
