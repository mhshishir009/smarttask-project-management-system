import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskFilters } from "../../../src/domain/repositories/ITaskRepository";

const db = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("../../../src/infrastructure/database/data-source", () => ({
  AppDataSource: { getRepository: () => ({ find: db.find }) },
}));
vi.mock("../../../src/infrastructure/database/entities/TaskOrmEntity", () => ({
  TaskOrmEntity: class TaskOrmEntity {},
}));
import { TaskRepository } from "../../../src/infrastructure/repositories/TaskRepository";

// Check actual ORM options so filtering happens in the DB, not after loading every task.
describe("TaskRepository filtering", () => {
  beforeEach(() => {
    db.find.mockReset();
    db.find.mockResolvedValue([]);
  });

  it.each<TaskFilters>([{}, {projectId: 6}, {assigneeId: 4}, {status: "TODO"}, {priority: "HIGH"},
    {projectId: 6, assigneeId: 4, status: "TODO", priority: "MEDIUM"}])("uses one bound where object for %j", async filters => {
    expect(await new TaskRepository().getAllTasks(filters)).toEqual([]);
    expect(db.find).toHaveBeenCalledWith({where: filters, order: {taskId: "ASC"}});
  });

  it("keeps unfiltered calls working", async () => {
    await new TaskRepository().getAllTasks();
    expect(db.find).toHaveBeenCalledWith({where: {}, order: {taskId: "ASC"}});
  });

  it("retains numeric mapping of database bigint IDs in filtered responses", async () => {
    db.find.mockResolvedValueOnce([{taskId: "10", projectId: "6", assigneeId: "4", createdBy: "1",
      title: "Filtered task", status: "TODO", priority: "MEDIUM", version: 1}]);
    expect(await new TaskRepository().getAllTasks({projectId: 6})).toEqual([
      expect.objectContaining({taskId: 10, projectId: 6, assigneeId: 4, createdBy: 1}),
    ]);
  });
});
