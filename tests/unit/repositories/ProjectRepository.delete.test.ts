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
vi.mock("../../../src/infrastructure/database/entities/ProjectOrmEntity", () => ({
  ProjectOrmEntity: class ProjectOrmEntity {},
}));

import { ProjectRepository } from "../../../src/infrastructure/repositories/ProjectRepository";

// Verify the actual repository's transaction and dependency safeguards with a mock DB manager.
describe("ProjectRepository deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockReset();
    db.remove.mockReset();
    db.remove.mockResolvedValue({ affected: 1 });
  });

  it("locks the parent before checking tasks and deleting within the transaction", async () => {
    db.query.mockResolvedValueOnce([{ id: "7" }]).mockResolvedValueOnce([]);
    expect(await new ProjectRepository().deleteProject(7)).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenNthCalledWith(1, "SELECT id FROM projects WHERE id = $1 FOR UPDATE", [7]);
    expect(db.query).toHaveBeenNthCalledWith(2, "SELECT id FROM tasks WHERE project_id = $1 LIMIT 1", [7]);
    expect(db.remove).toHaveBeenCalledWith({ projectId: 7 });
    expect(db.query.mock.invocationCallOrder[1]).toBeLessThan(db.remove.mock.invocationCallOrder[0]);
  });

  it("returns false without deleting when the project is missing", async () => {
    db.query.mockResolvedValueOnce([]);
    expect(await new ProjectRepository().deleteProject(7)).toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.remove).not.toHaveBeenCalled();
  });

  it("preserves any project with tasks, including completed tasks", async () => {
    db.query.mockResolvedValueOnce([{ id: "7" }]).mockResolvedValueOnce([{ id: "10" }]);
    await expect(new ProjectRepository().deleteProject(7)).rejects.toThrow("Cannot delete project with tasks");
    expect(db.remove).not.toHaveBeenCalled();
  });

  it.each([false, true])("translates a task foreign key violation into a conflict (wrapped: %s)", async wrapped => {
    db.query.mockResolvedValueOnce([{ id: "7" }]).mockResolvedValueOnce([]);
    const conflict = { code: "23503", constraint: "fk_tasks_project" };
    db.remove.mockRejectedValueOnce(wrapped ? { driverError: conflict } : conflict);
    await expect(new ProjectRepository().deleteProject(7)).rejects.toThrow("Cannot delete project with tasks");
  });

  it("propagates unexpected failures instead of reporting successful deletion", async () => {
    db.query.mockResolvedValueOnce([{ id: "7" }]).mockResolvedValueOnce([]);
    const error = new Error("Database unavailable");
    db.remove.mockRejectedValueOnce(error);
    await expect(new ProjectRepository().deleteProject(7)).rejects.toBe(error);
  });

  it("translates the discussion history foreign key into a clear conflict", async () => {
    db.query.mockResolvedValueOnce([{id: "7"}]).mockResolvedValueOnce([]);
    db.remove.mockRejectedValueOnce({driverError: {code: "23503", constraint: "fk_project_messages_project"}});
    await expect(new ProjectRepository().deleteProject(7)).rejects.toThrow("Cannot delete project with discussion messages");
  });
});
