import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TaskService } from "../../src/application/services/TaskService";
import { TaskController } from "../../src/presentation/controllers/TaskController";
import { createTaskRoutes } from "../../src/presentation/routes/taskRoutes";
import type { IProjectRepository } from "../../src/domain/repositories/IProjectRepository";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { ITaskRepository, TaskFilters } from "../../src/domain/repositories/ITaskRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";
import type { Task } from "../../src/domain/entities/Task";

// Real HTTP validation and authorization with synthetic task storage.
describe("Task filtering API", () => {
  let server: Server;
  let baseUrl: string;
  let getAllTasks: ReturnType<typeof vi.fn>;
  const now = new Date();
  const task = (taskId: number, projectId: number, assigneeId: number, status: Task["status"], priority: Task["priority"]): Task => ({
    taskId, projectId, assigneeId, status, priority, createdBy: 1, title: `Task ${taskId}`,
    description: null, dueAt: null, version: 1, createdAt: now, updatedAt: now,
  });
  const records = [task(1, 6, 4, "TODO", "MEDIUM"), task(2, 6, 2, "IN_PROGRESS", "HIGH"),
    task(3, 7, 4, "DONE", "LOW"), task(4, 7, 2, "TODO", "HIGH")];

  beforeEach(async () => {
    getAllTasks = vi.fn(async (filters: TaskFilters = {}) => records.filter(record =>
      Object.entries(filters).every(([key, value]) => record[key as keyof Task] === value)));
    const users = { getUserById: vi.fn(async (id: number) => ({userId: id, roleId: id === 1 ? 1 : 2,
      authVersion: 0, mustChangePassword: false, isActive: true})) } as unknown as IUserRepository;
    const tokens = { verifyToken: vi.fn((token: string) => {
      if (token !== "admin" && token !== "member") throw new Error("Invalid token");
      const userId = token === "admin" ? 1 : 2;
      return {userId, roleId: userId, authVersion: 0, mustChangePassword: false};
    }) } as unknown as ITokenService;
    const service = new TaskService({ getAllTasks } as unknown as ITaskRepository, {} as IProjectRepository, users);
    const app = express();
    app.use("/api/tasks", createTaskRoutes(new TaskController(service), tokens, users));
    app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, message: "Internal server error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tasks`;
  });
  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const get = async (query: string, token: string | null = "admin") => {
    const response = await fetch(baseUrl + query, {headers: token ? {Authorization: `Bearer ${token}`} : {}});
    return { status: response.status, body: await response.json() };
  };

  it.each([
    ["", [1, 2, 3, 4]], ["?projectId=6", [1, 2]], ["?assigneeId=4", [1, 3]],
    ["?status=TODO", [1, 4]], ["?status=IN_PROGRESS", [2]], ["?status=DONE", [3]],
    ["?priority=LOW", [3]], ["?priority=MEDIUM", [1]], ["?priority=HIGH", [2, 4]],
    ["?projectId=6&status=TODO&priority=MEDIUM&assigneeId=4", [1]],
    ["?projectId=6&priority=HIGH&assigneeId=4", []], ["?projectId=999999", []],
  ])("returns matching tasks for %s", async (query, ids) => {
    const result = await get(query);
    expect(result.status).toBe(200);
    expect(result.body.data.map((item: Task) => item.taskId)).toEqual(ids);
  });

  it.each([
    "?projectId=0", "?projectId=-1", "?projectId=1.5", "?projectId=abc", "?projectId=",
    "?projectId=9007199254740992", "?assigneeId=null", "?assigneeId=0", "?assigneeId=",
    "?status=COMPLETED", "?status=", "?priority=URGENT", "?priority=",
    "?projectId=6&projectId=7", "?assigneeId=2&assigneeId=4",
    "?status=TODO&status=DONE", "?priority=LOW&priority=HIGH", "?projectId[id]=6",
    "?projectId=6%20OR%201=1",
  ])("rejects invalid filters %s without querying task storage", async query => {
    expect((await get(query)).status).toBe(400);
    expect(getAllTasks).not.toHaveBeenCalled();
  });

  it.each([[null, 401], ["invalid", 401], ["member", 403]])("preserves admin list access for token %s", async (token, status) => {
    expect((await get("?assigneeId=2", token)).status).toBe(status);
    expect(getAllTasks).not.toHaveBeenCalled();
  });

  it("preserves numeric ID types and forwards only supported filter fields", async () => {
    expect((await get("?projectId=6&assigneeId=4&status=TODO&priority=MEDIUM&role=ADMIN")).status).toBe(200);
    expect(getAllTasks).toHaveBeenCalledWith({projectId: 6, assigneeId: 4, status: "TODO", priority: "MEDIUM"});
  });
});
