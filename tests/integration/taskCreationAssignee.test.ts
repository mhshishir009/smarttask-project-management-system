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

// Exercise assigned creation over HTTP without creating real database tasks.
describe("Task creation requires an active assignee", () => {
  let server: Server;
  let baseUrl: string;
  let createTask: ReturnType<typeof vi.fn>;
  const valid = { projectId: 6, assigneeId: 2, title: "Assigned task", priority: "MEDIUM" };

  beforeEach(async () => {
    createTask = vi.fn(async data => ({ ...data, taskId: 10, version: 1,
      createdAt: new Date(), updatedAt: new Date() }));
    const tasks = { createTask } as unknown as ITaskRepository;
    const projects = { getProjectById: vi.fn(async () => ({ projectId: 6, isArchived: false })) } as unknown as IProjectRepository;
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

  const post = async (body: unknown, token: string | null = "admin") => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  it("creates a task for an active assignee and retains existing defaults", async () => {
    const result = await post({ projectId: 6, assigneeId: 2, title: "Assigned task" });
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ assigneeId: 2, status: "TODO", priority: "MEDIUM", version: 1 });
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: 2, createdBy: 1 }));
  });

  it("rejects an omitted assignee without inserting a task", async () => {
    const result = await post({ projectId: 6, title: "No assignee" });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe("Assignee ID is required");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("rejects a null assignee without inserting a task", async () => {
    const result = await post({ ...valid, assigneeId: null });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe("Assignee ID is required");
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "2", "", false, {}, [], 9007199254740992])("rejects invalid assignee %j", async assigneeId => {
    const result = await post({ ...valid, assigneeId });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe("Invalid assignee ID");
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([[4, "inactive"], [999999, "missing"]])("rejects assignee %s (%s)", async assigneeId => {
    const result = await post({ ...valid, assigneeId });
    expect(result.status).toBe(409);
    expect(result.body.message).toBe("Assignee not found or inactive");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("maps the transactional active-assignee recheck failure to 409", async () => {
    createTask.mockRejectedValueOnce(new Error("Assignee not found or inactive"));
    expect((await post(valid)).status).toBe(409);
  });

  it.each([[null, 401], ["member", 403]])("preserves creation access control for token %s", async (token, status) => {
    expect((await post(valid, token)).status).toBe(status);
    expect(createTask).not.toHaveBeenCalled();
  });
});
