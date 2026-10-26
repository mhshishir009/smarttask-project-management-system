import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DiscussionService } from "../../src/application/services/DiscussionService";
import { DiscussionController } from "../../src/presentation/controllers/DiscussionController";
import { createDiscussionRoutes } from "../../src/presentation/routes/discussionRoutes";
import { createProjectRoutes } from "../../src/presentation/routes/projectRoutes";
import type { ProjectController } from "../../src/presentation/controllers/ProjectController";
import type { IDiscussionRepository } from "../../src/domain/repositories/IDiscussionRepository";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";
import { DiscussionError } from "../../src/domain/entities/ProjectMessage";

// Real HTTP guards/controller/service with an isolated repository; no live data writes.
describe("Project discussion HTTP integration", () => {
  let server: Server, base: string;
  let add: ReturnType<typeof vi.fn>, list: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    add = vi.fn(async (projectId, actor, body) => ({messageId: 1, projectId, authorId: actor.userId, authorName: "Test user", body, createdAt: new Date()}));
    list = vi.fn(async () => ({messages: [], nextBefore: null, isArchived: false}));
    const users = {getUserById: vi.fn(async id => ({userId: id, roleId: id === 2 ? 2 : 1, isActive: id !== 4, authVersion: 0, mustChangePassword: id === 3}))} as unknown as IUserRepository;
    const tokens = {verifyToken: vi.fn(token => {
      const id = {admin: 1, member: 2, temporary: 3, inactive: 4}[token];
      if (!id) throw new Error("Invalid token");
      return {userId: id, roleId: id === 2 ? 2 : 1, authVersion: 0, mustChangePassword: id === 3};
    })} as unknown as ITokenService;
    const app = express(); app.use(express.json());
    const unused = (_req, res) => res.status(418).end();
    // Preserve the application's router order to catch accidental route shadowing.
    app.use("/api/projects", createProjectRoutes({createProject: unused, getAllProjects: unused, getProjectById: unused, updateProject: unused, archiveProject: unused, deleteProject: unused} as unknown as ProjectController, tokens, users));
    app.use("/api/projects", createDiscussionRoutes(new DiscussionController(new DiscussionService({addMessage: add, listMessages: list} as IDiscussionRepository)), tokens, users));
    app.use((_err, _req, res, _next) => res.status(500).json({message: "Internal server error"}));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/projects`;
  });
  afterEach(async () => {await new Promise<void>(resolve => server.close(() => resolve()));});
  const request = async (method = "GET", path = "6/messages", body?: unknown, token: string | null = "admin") => {
    const response = await fetch(`${base}/${path}`, {method, headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
    return {status: response.status, body: await response.json()};
  };
  it("lists messages through existing project routers and forwards the cursor", async () => {
    expect((await request("GET", "6/messages?before=40")).status).toBe(200);
    expect(list).toHaveBeenCalledWith(6, {userId: 1, role: "ADMIN"}, 40);
  });
  it("sends trimmed text and ignores client author/project spoofing", async () => {
    const result = await request("POST", "6/messages", {body: "  Hello team  ", authorId: 1, projectId: 99}, "member");
    expect(result.status).toBe(201);
    expect(add).toHaveBeenCalledWith(6, {userId: 2, role: "TEAM_MEMBER"}, "Hello team");
    expect(result.body.data.authorId).toBe(2);
  });
  it.each([null, 123, {}, "", "  \n ", "a".repeat(2001)])("rejects invalid message payload %#", async body => {
    expect((await request("POST", "6/messages", {body})).status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });
  it("accepts the message length boundary", async () => {
    expect((await request("POST", "6/messages", {body: "a".repeat(2000)})).status).toBe(201);
  });
  it.each(["0/messages", "01/messages", "9007199254740992/messages", "6/messages?before=0", "6/messages?before=1&before=2", "6/messages?before=abc"])("rejects malformed IDs/cursors %s", async path => {
    expect((await request("GET", path)).status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
  it.each([[null, 401], ["invalid", 401], ["inactive", 401], ["temporary", 403]])("blocks unauthorized session %s", async (token, status) => {
    expect((await request("POST", "6/messages", {body: "Hi"}, token as string | null)).status).toBe(status);
    expect(add).not.toHaveBeenCalled();
  });
  it.each([["FORBIDDEN", 403], ["NOT_FOUND", 404], ["ARCHIVED", 409]] as const)("maps %s without reporting success", async (code, status) => {
    add.mockRejectedValueOnce(new DiscussionError("Discussion restricted", code));
    expect((await request("POST", "6/messages", {body: "Hi"})).status).toBe(status);
  });
  it("hides unexpected database errors", async () => {
    list.mockRejectedValueOnce(new Error("Private connection details"));
    expect(await request()).toEqual({status: 500, body: {message: "Internal server error"}});
  });
});
