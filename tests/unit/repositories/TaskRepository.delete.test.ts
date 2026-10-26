import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const query = vi.fn();
  const remove = vi.fn();
  const getRepository = vi.fn(() => ({ delete: remove }));
  const manager = { query, getRepository };
  return { query, remove, getRepository,
    transaction: vi.fn(async callback => callback(manager)) };
});
vi.mock("../../../src/infrastructure/database/data-source", () => ({
  AppDataSource: { transaction: db.transaction, getRepository: db.getRepository },
}));
vi.mock("../../../src/infrastructure/database/entities/TaskOrmEntity", () => ({
  TaskOrmEntity: class TaskOrmEntity {},
}));
import { TaskRepository } from "../../../src/infrastructure/repositories/TaskRepository";

// Exercise the repository's deletion safeguards without touching live tasks.
describe("TaskRepository deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockReset();
    db.remove.mockReset();
    db.remove.mockResolvedValue({ affected: 1 });
  });

  const existingTask = (version = 3) => {
    db.query.mockResolvedValueOnce([{ project_id: "7" }])
      .mockResolvedValueOnce([{ id: "7", is_archived: false }])
      .mockResolvedValueOnce([{ id: "10", version }]);
  };

  it("locks parent then task and deletes only the matching task, project and version", async () => {
    existingTask();
    expect(await new TaskRepository().deleteTask(10, 3)).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenNthCalledWith(2,
      "SELECT id, is_archived FROM projects WHERE id = $1 FOR UPDATE", ["7"]);
    expect(db.query).toHaveBeenNthCalledWith(3,
      "SELECT id, version FROM tasks WHERE id = $1 AND project_id = $2 FOR UPDATE", [10, "7"]);
    expect(db.remove).toHaveBeenCalledWith({ taskId: 10, projectId: 7, version: 3 });
    expect(db.query.mock.invocationCallOrder[2]).toBeLessThan(db.remove.mock.invocationCallOrder[0]);
  });

  it("does not delete a task changed since the caller read it", async () => {
    existingTask(4);
    await expect(new TaskRepository().deleteTask(10, 3)).rejects.toThrow("Task version conflict");
    expect(db.remove).not.toHaveBeenCalled();
  });

  it("preserves tasks in archived projects", async () => {
    db.query.mockResolvedValueOnce([{ project_id: "7" }])
      .mockResolvedValueOnce([{ id: "7", is_archived: true }]);
    await expect(new TaskRepository().deleteTask(10, 3)).rejects.toThrow("Archived project cannot be modified");
    expect(db.remove).not.toHaveBeenCalled();
  });

  it.each(["task", "project", "task after obtaining the parent lock"])("returns false when %s disappeared", async missing => {
    if (missing === "task") db.query.mockResolvedValueOnce([]);
    else if (missing === "project") db.query.mockResolvedValueOnce([{ project_id: "7" }]).mockResolvedValueOnce([]);
    else db.query.mockResolvedValueOnce([{ project_id: "7" }])
      .mockResolvedValueOnce([{ id: "7", is_archived: false }]).mockResolvedValueOnce([]);
    expect(await new TaskRepository().deleteTask(10, 3)).toBe(false);
    expect(db.remove).not.toHaveBeenCalled();
  });

  it("does not report success if no row was deleted", async () => {
    existingTask();
    db.remove.mockResolvedValueOnce({ affected: 0 });
    expect(await new TaskRepository().deleteTask(10, 3)).toBe(false);
  });

  it("propagates database failures", async () => {
    existingTask();
    const error = new Error("Database unavailable");
    db.remove.mockRejectedValueOnce(error);
    await expect(new TaskRepository().deleteTask(10, 3)).rejects.toBe(error);
  });
});
