import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({get: vi.fn()}));
vi.mock("../../../frontend/src/services/api", () => ({default: api}));
import { searchWorkspace } from "../../../frontend/src/services/workspaceSearch";

describe("Workspace header search", () => {
  const projects = [{projectId: 6, name: "Bright project", description: "Release planning"}];
  const tasks = [{taskId: 10, title: "Bright task", description: "Fix login", assigneeId: 2},
    {taskId: 11, title: "Bright private task", description: null, assigneeId: 3}];
  const users = [{userId: 2, fullName: "Bright Member", email: "member@example.test"}];
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(async (path: string) => ({data: {data:
      path === "/projects" ? projects : path === "/users" ? users : tasks }}));
  });

  it("searches all three authorized resource types for administrators", async () => {
    const results = await searchWorkspace(" BRIGHT ", "ADMIN", 1);
    expect(results.map(item => item.kind)).toEqual(["project", "task", "task", "user"]);
    expect(results[0].href).toBe("/projects?workspaceProject=6");
    expect(results[1].href).toBe("/tasks?workspaceTask=10");
    expect(results[3].href).toBe("/users?workspaceUser=2");
  });

  it("uses only permitted member APIs and filters tasks by the current assignee", async () => {
    const results = await searchWorkspace("bright", "TEAM_MEMBER", 2);
    expect(results.map(item => item.kind)).toEqual(["project", "task"]);
    expect(results[1].href).toBe("/my-tasks?workspaceTask=10");
    expect(api.get.mock.calls.map(call => call[0])).toEqual(["/projects", "/tasks/project/6"]);
    expect(results.some(item => item.kind === "user" || item.id === 11)).toBe(false);
  });

  it.each(["", " ", "b"])("does not request data for a short query %j", async query => {
    expect(await searchWorkspace(query, "ADMIN", 1)).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });

  it.each([["release", "project"], ["LOGIN", "task"], ["member@example", "user"], ["#10", "task"]])("matches %s in names, descriptions, emails or IDs", async (query, kind) => {
    const results = await searchWorkspace(query, "ADMIN", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(item => item.kind === kind)).toBe(true);
  });

  it("returns an empty list when no record matches", async () => {
    expect(await searchWorkspace("no-such-item", "ADMIN", 1)).toEqual([]);
  });

  it("passes cancellation to every request", async () => {
    const controller = new AbortController();
    await searchWorkspace("bright", "ADMIN", 1, controller.signal);
    for (const call of api.get.mock.calls) expect(call[1]).toEqual({signal: controller.signal});
  });

  it("surfaces failed requests instead of reporting no results", async () => {
    api.get.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(searchWorkspace("bright", "ADMIN", 1)).rejects.toThrow("Network unavailable");
  });

  it("rejects malformed responses", async () => {
    api.get.mockResolvedValueOnce({data: {data: null}});
    await expect(searchWorkspace("bright", "ADMIN", 1)).rejects.toThrow("Unexpected search response");
  });
});
