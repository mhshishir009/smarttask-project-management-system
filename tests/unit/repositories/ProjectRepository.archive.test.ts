import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserRepository } from "../../../src/domain/repositories/IUserRepository";
import type { ITaskRepository } from "../../../src/domain/repositories/ITaskRepository";

const db = vi.hoisted(() => {
  const query = vi.fn();
  const update = vi.fn();
  const findOneBy = vi.fn();
  const getRepository = vi.fn(() => ({ update, findOneBy }));
  const manager = { query, getRepository };
  return { query, update, findOneBy,
    transaction: vi.fn(async callback => callback(manager)), getRepository };
});
vi.mock("../../../src/infrastructure/database/data-source", () => ({
  AppDataSource: { transaction: db.transaction, getRepository: db.getRepository },
}));
vi.mock("../../../src/infrastructure/database/entities/ProjectOrmEntity", () => ({
  ProjectOrmEntity: class ProjectOrmEntity {},
}));
import { ProjectRepository } from "../../../src/infrastructure/repositories/ProjectRepository";
import { ProjectService } from "../../../src/application/services/ProjectService";
import { ProjectController } from "../../../src/presentation/controllers/ProjectController";
import type { Request, Response } from "express";

// Real archive repository logic with a mock transaction manager; no live DB changes.
describe("Project archive transactional task check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockReset();
    db.update.mockReset();
    db.findOneBy.mockReset();
    db.update.mockResolvedValue({ affected: 1 });
    db.findOneBy.mockResolvedValue({projectId: "6", createdBy: "1", isArchived: false});
  });

  it("checks incomplete tasks after the project lock and before updating within one transaction", async () => {
    db.query.mockResolvedValueOnce([{ id: "6" }]).mockResolvedValueOnce([]);
    expect(await new ProjectRepository().archiveProject(6)).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringMatching(/FROM projects[\s\S]+FOR UPDATE/), [6]);
    expect(db.query).toHaveBeenNthCalledWith(2,
      "SELECT id FROM tasks WHERE project_id = $1 AND status <> $2 LIMIT 1", [6, "DONE"]);
    expect(db.query.mock.invocationCallOrder[1]).toBeLessThan(db.update.mock.invocationCallOrder[0]);
    expect(db.update).toHaveBeenCalledWith({projectId: 6, isArchived: false}, {isArchived: true});
  });

  it.each(["TODO", "IN_PROGRESS"])("blocks archiving when a %s task exists", async status => {
    db.query.mockResolvedValueOnce([{id: "6"}]).mockResolvedValueOnce([{id: "10", status}]);
    await expect(new ProjectRepository().archiveProject(6)).rejects.toThrow("Cannot archive project with incomplete tasks");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns false without updating if the project is unavailable after locking", async () => {
    db.query.mockResolvedValueOnce([]);
    expect(await new ProjectRepository().archiveProject(6)).toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a task introduced while waiting for the project lock", async () => {
    let releaseLock!: () => void;
    let notifyWaiting!: () => void;
    let incompleteTaskCommitted = false;
    const waiting = new Promise<void>(resolve => { notifyWaiting = resolve; });
    const lock = new Promise<void>(resolve => { releaseLock = resolve; });
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM projects")) {
        notifyWaiting();
        await lock;
        return [{id: "6"}];
      }
      return incompleteTaskCommitted ? [{id: "10"}] : [];
    });
    const archive = new ProjectRepository().archiveProject(6);
    const assertion = expect(archive).rejects.toThrow("Cannot archive project with incomplete tasks");
    await waiting;
    expect(db.query).toHaveBeenCalledTimes(1);
    // Simulate a task transaction committing before the archive acquires the parent lock.
    incompleteTaskCommitted = true;
    releaseLock();
    await assertion;
    expect(db.update).not.toHaveBeenCalled();
  });

  it("maps a late repository conflict to HTTP 409 even after the service precheck passed", async () => {
    db.query.mockResolvedValueOnce([{id: "6"}]).mockResolvedValueOnce([{id: "10"}]);
    const tasks = {getTasksByProjectId: vi.fn(async () => [])} as unknown as ITaskRepository;
    const service = new ProjectService(new ProjectRepository(), {} as IUserRepository, tasks);
    const controller = new ProjectController(service);
    const res = {status: vi.fn().mockReturnThis(), json: vi.fn()} as unknown as Response;
    const next = vi.fn();
    await controller.archiveProject({params: {id: "6"}} as unknown as Request, res, next);
    expect(tasks.getTasksByProjectId).toHaveBeenCalledWith(6);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({success: false, message: "Cannot archive project with incomplete tasks"});
    expect(next).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("archives when the locked check finds no incomplete tasks", async () => {
    db.query.mockResolvedValueOnce([{id: "6"}]).mockResolvedValueOnce([]);
    const tasks = {getTasksByProjectId: vi.fn(async () => [{status: "DONE"}])} as unknown as ITaskRepository;
    const service = new ProjectService(new ProjectRepository(), {} as IUserRepository, tasks);
    expect(await service.archiveProject(6)).toBe(true);
  });

  it("does not report success when the update affects no project", async () => {
    db.query.mockResolvedValueOnce([{id: "6"}]).mockResolvedValueOnce([]);
    db.update.mockResolvedValueOnce({affected: 0});
    expect(await new ProjectRepository().archiveProject(6)).toBe(false);
  });

  it("does not update when the task check fails unexpectedly", async () => {
    db.query.mockResolvedValueOnce([{id: "6"}]).mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(new ProjectRepository().archiveProject(6)).rejects.toThrow("Database unavailable");
    expect(db.update).not.toHaveBeenCalled();
  });
});
