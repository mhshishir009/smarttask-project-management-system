import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../../src/domain/entities/Task";

const db = vi.hoisted(() => {
  const query = vi.fn();
  const create = vi.fn(data => data);
  const save = vi.fn(async data => ({ ...data, taskId: "10", createdAt: new Date(), updatedAt: new Date() }));
  const getRepository = vi.fn(() => ({ create, save }));
  const manager = { query, getRepository };
  return { query, create, save, getRepository,
    transaction: vi.fn(async callback => callback(manager)) };
});
vi.mock("../../../src/infrastructure/database/data-source", () => ({
  AppDataSource: { transaction: db.transaction, getRepository: db.getRepository },
}));
vi.mock("../../../src/infrastructure/database/entities/TaskOrmEntity", () => ({
  TaskOrmEntity: class TaskOrmEntity {},
}));
import { TaskRepository } from "../../../src/infrastructure/repositories/TaskRepository";

// Verify the persistence boundary rejects unassigned creation and rechecks active users under lock.
describe("TaskRepository assigned creation", () => {
  const task: Omit<Task, "taskId" | "version" | "createdAt" | "updatedAt"> = {
    projectId: 6, assigneeId: 2, createdBy: 1, title: "Assigned task", description: null,
    status: "TODO", priority: "MEDIUM", dueAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockReset();
  });

  it.each([null, undefined, 0, -1, 1.5, "2"])("rejects invalid assignee %j even when the service is bypassed", async assigneeId => {
    await expect(new TaskRepository().createTask({ ...task, assigneeId } as typeof task)).rejects.toThrow("Invalid assignee ID");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.save).not.toHaveBeenCalled();
  });

  it("locks the active assignee before saving the new task", async () => {
    db.query.mockResolvedValueOnce([{ id: "6" }]).mockResolvedValueOnce([{ id: "2" }]);
    expect(await new TaskRepository().createTask(task)).toMatchObject({ assigneeId: 2, version: 1 });
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringMatching(/is_active = TRUE\s+FOR UPDATE/), [2]);
    expect(db.query.mock.invocationCallOrder[1]).toBeLessThan(db.save.mock.invocationCallOrder[0]);
  });

  it.each([null, undefined, 0, -1, 1.5, "2"])("also blocks invalid reassignment %j at the repository boundary", async assigneeId => {
    await expect(new TaskRepository().reassignTask(10, 1, assigneeId as number)).rejects.toThrow("Invalid assignee ID");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("does not save if the assignee became inactive after service validation", async () => {
    db.query.mockResolvedValueOnce([{ id: "6" }]).mockResolvedValueOnce([]);
    await expect(new TaskRepository().createTask(task)).rejects.toThrow("Assignee not found or inactive");
    expect(db.save).not.toHaveBeenCalled();
  });
});
