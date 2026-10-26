import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TaskService } from "../../src/application/services/TaskService";
import { TaskController } from "../../src/presentation/controllers/TaskController";
import { createTaskRoutes } from "../../src/presentation/routes/taskRoutes";
import type { IProjectRepository } from "../../src/domain/repositories/IProjectRepository";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { ITaskRepository } from "../../src/domain/repositories/ITaskRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";

// Exercise reassignment over HTTP without creating real database tasks.
describe("Task reassignment requires an active assignee", () => {
  let server: Server;
  let baseUrl: string;
  let reassignTask: ReturnType<typeof vi.fn>;
  let getTaskById: ReturnType<typeof vi.fn>;
  let archived: boolean;
  const valid = { expectedVersion: 1, assigneeId: 2 };

  beforeEach(async () => {
    archived = false;
    const task = { taskId: 10, projectId: 6, assigneeId: 1, createdBy: 1, title: "Owned task",
      description: null, status: "TODO", priority: "MEDIUM", dueAt: null, version: 1,
      createdAt: new Date(), updatedAt: new Date() };
    reassignTask = vi.fn(async (_id: number, _version: number, assigneeId: number) => ({ ...task, assigneeId, version: 2 }));
    getTaskById = vi.fn(async () => task);
    const tasks = { reassignTask, getTaskById } as unknown as ITaskRepository;
    const projects = { getProjectById: vi.fn(async () => ({projectId: 6, isArchived: archived})) } as unknown as IProjectRepository;
    const users = { getUserById: vi.fn(async (id: number) => [1, 2, 4].includes(id)
      ? { userId: id, roleId: id === 1 ? 1 : 2, authVersion: 0, mustChangePassword: false, isActive: id !== 4 }
      : null) } as unknown as IUserRepository;
    const tokens = { verifyToken: vi.fn((token: string) => {
      const userId = token === "admin" ? 1 : token === "member" ? 2 : 0;
      if (!userId) throw new Error("Invalid token");
      return { userId, roleId: userId === 1 ? 1 : 2, authVersion: 0, mustChangePassword: false };
    }) } as unknown as ITokenService;
    const app = express();
    app.use(express.json());
    app.use("/api/tasks", createTaskRoutes(new TaskController(new TaskService(tasks, projects, users)), tokens, users));
    app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, message: "Internal server error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tasks`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  const patch = async (body: unknown, token: string | null = "admin") => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(baseUrl + "/10/assign", { method: "PATCH", headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  it("reassigns to an active user while keeping the existing version check", async () => {
    const result = await patch(valid);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({assigneeId: 2, version: 2});
    expect(reassignTask).toHaveBeenCalledWith(10, 1, 2, 1);
  });

  it.each([{body: {expectedVersion: 1}}, {body: {...valid, assigneeId: null}}])("rejects missing/null assignees %j", async ({body}) => {
    const result = await patch(body);
    expect(result.status).toBe(400);
    expect(result.body.message).toBe("Assignee ID is required");
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "2", "", false, {}, [], 9007199254740992])("rejects invalid assignee %j", async assigneeId => {
    const result = await patch({...valid, assigneeId});
    expect(result.status).toBe(400);
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it.each([4, 999999])("rejects inactive or nonexistent assignee %s", async assigneeId => {
    const result = await patch({...valid, assigneeId});
    expect(result.status).toBe(409);
    expect(result.body.message).toBe("Assignee not found or inactive");
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it("rejects stale versions without changing the assignee", async () => {
    expect((await patch({...valid, expectedVersion: 2})).status).toBe(409);
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it("rejects archived projects", async () => {
    archived = true;
    expect((await patch(valid)).status).toBe(409);
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it("returns 404 when the task no longer exists", async () => {
    getTaskById.mockResolvedValueOnce(null);
    expect((await patch(valid)).status).toBe(404);
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it.each([[null, 401], ["member", 403]])("preserves reassignment access control for token %s", async (token, status) => {
    expect((await patch(valid, token)).status).toBe(status);
    expect(reassignTask).not.toHaveBeenCalled();
  });

  it("returns 409 if the assignee becomes inactive inside the repository transaction", async () => {
    reassignTask.mockRejectedValueOnce(new Error("Assignee not found or inactive"));
    expect((await patch(valid)).status).toBe(409);
  });
});
