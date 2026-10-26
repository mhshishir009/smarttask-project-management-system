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

// Real routes, guards, controller and service; task storage stays in memory for these tests.
describe("Task deletion API", () => {
  let server: Server;
  let baseUrl: string;
  let deleteTask: ReturnType<typeof vi.fn>;
  let exists: boolean;

  beforeEach(async () => {
    exists = true;
    deleteTask = vi.fn(async () => {
      const found = exists;
      exists = false;
      return found;
    });
    const tasks = {
      deleteTask,
      getTaskById: vi.fn(async () => exists ? {
        taskId: 1, projectId: 1, assigneeId: 2, createdBy: 1, title: "Delete test",
        description: null, status: "TODO", priority: "MEDIUM", dueAt: null,
        version: 3, createdAt: new Date(), updatedAt: new Date(),
      } : null),
    } as unknown as ITaskRepository;
    const users = {
      getUserById: vi.fn(async (id: number) => ({ userId: id, roleId: id === 2 ? 2 : 1,
        authVersion: 0, mustChangePassword: id === 3, isActive: id !== 4 })),
    } as unknown as IUserRepository;
    const tokens = {
      verifyToken: vi.fn((token: string) => {
        const id = { admin: 1, member: 2, temporary: 3, inactive: 4 }[token];
        if (!id) throw new Error("Invalid token");
        return { userId: id, roleId: id === 2 ? 2 : 1, authVersion: 0, mustChangePassword: id === 3 };
      }),
    } as unknown as ITokenService;
    const service = new TaskService(tasks, {} as IProjectRepository, users);
    const app = express();
    app.use(express.json());
    app.use("/api/tasks", createTaskRoutes(new TaskController(service), tokens, users));
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

  const request = async (id: string, token: string | null = "admin", body: unknown = { expectedVersion: 3 }, method = "DELETE") => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}/${id}`, {
      method, headers, body: method === "GET" || body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  it("lets an admin delete a task and returns 404 on subsequent reads and deletes", async () => {
    const before = await request("1", "admin", undefined, "GET");
    expect(before.status).toBe(200);
    expect(before.body.data.version).toBe(3);
    const result = await request("1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, message: "Task deleted successfully" });
    expect(deleteTask).toHaveBeenCalledWith(1, 3);
    expect((await request("1", "admin", undefined, "GET")).status).toBe(404);
    expect((await request("1")).status).toBe(404);
  });

  it.each(["Task version conflict", "Archived project cannot be modified"])("returns 409 for %s and preserves the task", async message => {
    deleteTask.mockRejectedValueOnce(new Error(message));
    const result = await request("1");
    expect(result.status).toBe(409);
    expect(result.body.message).toBe(message);
    expect(exists).toBe(true);
  });

  it("returns 404 for a missing task", async () => {
    deleteTask.mockResolvedValueOnce(false);
    expect((await request("999999")).status).toBe(404);
  });

  it.each(["0", "-1", "abc", "1.5", "01", "9007199254740992"])("rejects invalid task ID %s", async id => {
    expect((await request(id)).status).toBe(400);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}], ["null", { expectedVersion: null }], ["string", { expectedVersion: "3" }],
    ["zero", { expectedVersion: 0 }], ["negative", { expectedVersion: -1 }],
    ["fraction", { expectedVersion: 1.5 }], ["unsafe integer", { expectedVersion: 9007199254740992 }],
    ["array", []],
  ])("rejects %s expectedVersion before calling the repository", async (_name, body) => {
    expect((await request("1", "admin", body)).status).toBe(400);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", null, 401], ["invalid token", "invalid", 401],
    ["team member, even the assignee", "member", 403],
    ["password change required", "temporary", 403], ["inactive user", "inactive", 401],
  ])("blocks %s", async (_name, token, status) => {
    expect((await request("1", token)).status).toBe(status);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it("does not expose unexpected database errors", async () => {
    deleteTask.mockRejectedValueOnce(new Error("Private database details"));
    const result = await request("1");
    expect(result.status).toBe(500);
    expect(result.body.message).toBe("Internal server error");
  });
});
