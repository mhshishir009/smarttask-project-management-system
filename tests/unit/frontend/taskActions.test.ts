import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../../frontend/src/services/api", () => ({ default: api }));
import { deleteTask, getFilteredTasks, getTaskFilterParams, requireActiveAssignee, reassignTask } from "../../../frontend/src/services/taskActions";

describe("Frontend task API integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("omits All/empty filters instead of sending values rejected by the backend", () => {
    expect(getTaskFilterParams({projectId: "", assigneeId: "", status: "ALL", priority: "ALL"})).toEqual({});
  });

  it("combines all four backend filters and passes cancellation to Axios", () => {
    const controller = new AbortController();
    getFilteredTasks({projectId: "6", assigneeId: "4", status: "TODO", priority: "MEDIUM"}, controller.signal);
    expect(api.get).toHaveBeenCalledWith("/tasks", {params: {projectId: 6, assigneeId: 4, status: "TODO", priority: "MEDIUM"}, signal: controller.signal});
  });

  it.each(["0", "-1", "abc", "1.5", "9007199254740992"])("rejects invalid filter ID %s", projectId => {
    expect(() => getTaskFilterParams({projectId, assigneeId: "", status: "ALL", priority: "ALL"})).toThrow("Invalid task filter ID");
  });

  it("sends the displayed version as an Axios DELETE body", async () => {
    api.delete.mockResolvedValueOnce({data: {success: true}});
    await deleteTask(10, 3);
    expect(api.delete).toHaveBeenCalledWith("/tasks/10", {data: {expectedVersion: 3}});
  });

  it("propagates version conflicts without retrying a destructive request", async () => {
    const conflict = {response: {status: 409}};
    api.delete.mockRejectedValueOnce(conflict);
    await expect(deleteTask(10, 3)).rejects.toBe(conflict);
    expect(api.delete).toHaveBeenCalledTimes(1);
  });

  it.each(["", "0", "-1", "bad", "1.5"])("blocks invalid assignee selection %s", value => {
    expect(() => requireActiveAssignee(value, [])).toThrow("Please select an active assignee");
  });

  it("accepts an active user and returns the numeric ID required by the backend", () => {
    expect(requireActiveAssignee("4", [{userId: 4, isActive: true}])).toBe(4);
  });

  it("sends an active assignee and the current version during reassignment", async () => {
    await reassignTask(10, 3, "4", [{userId: 4, isActive: true}]);
    expect(api.patch).toHaveBeenCalledWith("/tasks/10/assign", {expectedVersion: 3, assigneeId: 4});
  });

  it("blocks empty reassignment before any API request", () => {
    expect(() => reassignTask(10, 3, "", [{userId: 4, isActive: true}])).toThrow("Please select an active assignee");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("blocks inactive reassignment before any API request", () => {
    expect(() => reassignTask(10, 3, "4", [{userId: 4, isActive: false}])).toThrow("Selected assignee is unavailable");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it.each([{users: [{userId: 4, isActive: false}]}, {users: [{userId: 4}]}, {users: [{userId: 5, isActive: true}]}, {users: []}])("rejects unavailable or inactive assignees %j", ({users}) => {
    expect(() => requireActiveAssignee("4", users)).toThrow("Selected assignee is unavailable");
  });
});
