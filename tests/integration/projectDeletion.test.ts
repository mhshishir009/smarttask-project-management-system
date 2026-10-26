import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ProjectService } from "../../src/application/services/ProjectService";
import { ProjectController } from "../../src/presentation/controllers/ProjectController";
import { createProjectRoutes } from "../../src/presentation/routes/projectRoutes";
import type { IProjectRepository } from "../../src/domain/repositories/IProjectRepository";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { ITaskRepository } from "../../src/domain/repositories/ITaskRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";

// Use real project routes, guards, controller and service; never delete live database data.
describe("Project deletion API", () => {
  let server: Server;
  let baseUrl: string;
  let deleteProject: ReturnType<typeof vi.fn>;
  let exists: boolean;

  beforeEach(async () => {
    exists = true;
    deleteProject = vi.fn(async () => {
      const found = exists;
      exists = false;
      return found;
    });
    const projects = {
      deleteProject,
      getProjectById: vi.fn(async () => exists ? {
        projectId: 1, name: "Delete test", description: null, createdBy: 1,
        isArchived: false, createdAt: new Date(), updatedAt: new Date(),
      } : null),
    } as unknown as IProjectRepository;
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
    const service = new ProjectService(projects, users, {} as ITaskRepository);
    const app = express();
    app.use(express.json());
    app.use("/api/projects", createProjectRoutes(new ProjectController(service), tokens, users));
    app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, message: "Internal server error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/projects`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  const request = async (id: string, token: string | null = "admin", method = "DELETE") => {
    const response = await fetch(`${baseUrl}/${id}`, {
      method, headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: response.status, body: await response.json() };
  };

  it("lets an admin delete an empty project and returns 404 on subsequent reads or deletes", async () => {
    expect((await request("1", "admin", "GET")).status).toBe(200);
    const result = await request("1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, message: "Project deleted successfully" });
    expect(deleteProject).toHaveBeenCalledWith(1);
    expect((await request("1", "admin", "GET")).status).toBe(404);
    expect((await request("1")).status).toBe(404);
  });

  it("returns 409 and preserves a project when its repository reports dependent tasks", async () => {
    deleteProject.mockRejectedValueOnce(new Error("Cannot delete project with tasks"));
    const result = await request("1");
    expect(result.status).toBe(409);
    expect(result.body.message).toBe("Cannot delete project with tasks");
    expect(exists).toBe(true);
    expect((await request("1", "admin", "GET")).status).toBe(200);
  });

  it("returns 404 when the project does not exist", async () => {
    deleteProject.mockResolvedValueOnce(false);
    expect((await request("999999")).status).toBe(404);
  });

  it("preserves discussion history when project deletion is attempted", async () => {
    deleteProject.mockRejectedValueOnce(new Error("Cannot delete project with discussion messages"));
    expect((await request("1")).status).toBe(409);
    expect(exists).toBe(true);
  });

  it.each(["0", "-1", "abc", "1.5", "01", "9007199254740992"])("rejects invalid project ID %s", async id => {
    expect((await request(id)).status).toBe(400);
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", null, 401],
    ["invalid token", "invalid", 401],
    ["team member", "member", 403],
    ["password change required", "temporary", 403],
    ["inactive user", "inactive", 401],
  ])("blocks %s before calling the repository", async (_name, token, status) => {
    expect((await request("1", token)).status).toBe(status);
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it("does not expose unexpected database errors", async () => {
    deleteProject.mockRejectedValueOnce(new Error("Private database details"));
    const result = await request("1");
    expect(result.status).toBe(500);
    expect(result.body.message).toBe("Internal server error");
  });
});
