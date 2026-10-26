// Run after npm run build. Exact migrations + real repositories in pg_temp; always rolled back.
require("dotenv").config({quiet: true});
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {AppDataSource: db} = require("../../dist/infrastructure/database/data-source");
const {NotificationWriter} = require("../../dist/infrastructure/repositories/NotificationWriter");
const {NotificationRepository} = require("../../dist/infrastructure/repositories/NotificationRepository");
const {ProjectRepository} = require("../../dist/infrastructure/repositories/ProjectRepository");
const {TaskRepository} = require("../../dist/infrastructure/repositories/TaskRepository");
const {DiscussionRepository} = require("../../dist/infrastructure/repositories/DiscussionRepository");

async function main() {
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  const original = {transaction: db.transaction, query: db.query};
  try {
    await runner.query("CREATE TEMP TABLE notification_smoke_scope(id INT)");
    await runner.query("SET LOCAL search_path TO pg_temp");
    const folder = path.resolve(__dirname, "../../dist/infrastructure/database/migrations");
    for (const file of fs.readdirSync(folder).filter(name => name.endsWith(".js")).sort()) {
      const Migration = Object.values(require(path.join(folder, file)))[0];
      await new Migration().up(runner);
    }
    assert.equal((await runner.query("SELECT relpersistence FROM pg_class WHERE oid = 'notifications'::regclass"))[0].relpersistence, "t");
    await runner.query("INSERT INTO roles(id,code,name) VALUES (1,'ADMIN','Admin'),(2,'TEAM_MEMBER','Member')");
    await runner.query(`INSERT INTO users(id,role_id,full_name,email,password_hash,is_active) VALUES
      (1,1,'System Administrator','admin@test.invalid','test',true), (2,2,'Mahedee','member@test.invalid','test',true),
      (3,2,'Tushar','old@test.invalid','test',true), (4,2,'Outside','outside@test.invalid','test',true),
      (5,2,'Inactive','inactive@test.invalid','test',false), (6,1,'Second Admin','admin2@test.invalid','test',true)`);
    // Nested savepoints exercise atomic rollback without committing any fixture data.
    db.transaction = async (...args) => {
      await runner.startTransaction();
      try {const result = await args.at(-1)(runner.manager); await runner.commitTransaction(); return result;}
      catch (error) {await runner.rollbackTransaction(); throw error;}
    };
    db.query = (sql, args) => runner.query(sql, args);
    const writer = new NotificationWriter(), projects = new ProjectRepository(writer), tasks = new TaskRepository(writer);
    const discussions = new DiscussionRepository(writer), notifications = new NotificationRepository();
    const project = await projects.createProject({name: "Notification Test", description: null, createdBy: 1, isArchived: false});
    assert.equal((await notifications.list(1, "ADMIN")).unreadCount, 0);
    assert.equal((await notifications.list(6, "ADMIN")).unreadCount, 1);
    assert.equal((await notifications.list(2, "TEAM_MEMBER")).notifications.length, 0);
    const task = await tasks.createTask({projectId: project.projectId, assigneeId: 3, createdBy: 1, title: "Develop UI", description: null, status: "TODO", priority: "HIGH", dueAt: null});
    const first = await notifications.list(3, "TEAM_MEMBER");
    assert.equal(first.unreadCount, 1); assert.match(first.notifications[0].message, /System Administrator.*Develop UI.*Tushar/);
    assert.equal(await notifications.markRead(2, first.notifications[0].notificationId), false);
    assert.equal(await notifications.markRead(3, first.notifications[0].notificationId), true);
    assert.equal((await notifications.list(3, "TEAM_MEMBER")).unreadCount, 0);
    await tasks.reassignTask(task.taskId, 1, 2, 1);
    assert.equal((await notifications.list(3, "TEAM_MEMBER")).notifications[0].canOpen, false);
    assert.equal((await notifications.list(2, "TEAM_MEMBER")).notifications[0].canOpen, true);
    assert.match((await notifications.list(2, "TEAM_MEMBER")).notifications[0].message, /Tushar to Mahedee/);
    const beforeStale = (await runner.query("SELECT COUNT(*)::int AS n FROM notifications"))[0].n;
    assert.equal(await tasks.changeTaskStatus(task.taskId, 1, "IN_PROGRESS", {userId: 2, role: "TEAM_MEMBER"}), null);
    assert.equal((await runner.query("SELECT COUNT(*)::int AS n FROM notifications"))[0].n, beforeStale);
    await tasks.changeTaskStatus(task.taskId, 2, "IN_PROGRESS", {userId: 2, role: "TEAM_MEMBER"});
    assert.match((await notifications.list(1, "ADMIN")).notifications[0].message, /Mahedee.*In Progress/);
    const adminBeforeMessage = (await notifications.list(1, "ADMIN")).unreadCount;
    await discussions.addMessage(project.projectId, {userId: 2, role: "TEAM_MEMBER"}, "Private body must not appear in bell");
    assert.equal((await notifications.list(1, "ADMIN")).unreadCount, adminBeforeMessage + 1);
    assert.doesNotMatch((await notifications.list(1, "ADMIN")).notifications[0].message, /Private body/);
    assert.equal((await notifications.list(4, "TEAM_MEMBER")).notifications.length, 0);
    assert.equal((await notifications.list(5, "TEAM_MEMBER")).notifications.length, 0);
    await tasks.changeTaskStatus(task.taskId, 3, "DONE", {userId: 2, role: "TEAM_MEMBER"});
    await projects.archiveProject(project.projectId, 1);
    assert.equal((await notifications.list(2, "TEAM_MEMBER")).notifications[0].kind, "PROJECT_ARCHIVED");
    const snapshot = (await notifications.list(6, "ADMIN")).notifications[0].notificationId;
    await projects.createProject({name: "Newer project", description: null, createdBy: 1, isArchived: false});
    await notifications.markAllRead(6, snapshot);
    assert.equal((await notifications.list(6, "ADMIN")).unreadCount, 1);
    // Same event retry cannot duplicate recipients, including admins assigned to their own task.
    const latestProject = await projects.createProject({name: "Pagination", description: null, createdBy: 1, isArchived: false});
    const event = {kind: "PROJECT_CREATED", key: `project:${latestProject.projectId}:created`, actorId: 1, projectId: latestProject.projectId};
    const beforeRetry = (await runner.query("SELECT COUNT(*)::int AS n FROM notifications"))[0].n;
    await writer.record(runner.manager, event);
    assert.equal((await runner.query("SELECT COUNT(*)::int AS n FROM notifications"))[0].n, beforeRetry);
    for (let index = 0; index < 34; index++) await writer.record(runner.manager, {...event, key: `fixture:${index}`});
    const page = await notifications.list(6, "ADMIN"), older = await notifications.list(6, "ADMIN", page.nextBefore);
    assert.equal(page.notifications.length, 30);
    assert.ok(older.notifications[0].notificationId < page.notifications.at(-1).notificationId);
    // A notification failure must roll back the primary write, rather than return a misleading success.
    const brokenProjects = new ProjectRepository({record: async () => {throw new Error("Fixture notification failure");}});
    await assert.rejects(() => brokenProjects.createProject({name: "Must Roll Back", description: null, createdBy: 1, isArchived: false}));
    assert.equal((await runner.query("SELECT COUNT(*)::int AS n FROM projects WHERE name = 'Must Roll Back'"))[0].n, 0);
    console.log("PASS: all six production event hooks, recipients, actor attribution, read ownership/snapshot, permissions, pagination, deduplication and rollback (pg_temp only).");
  } finally {
    db.transaction = original.transaction; db.query = original.query;
    await runner.rollbackTransaction(); await runner.release(); await db.destroy();
  }
}
main().catch(error => {console.error("Notification smoke test failed:", error.code || error.name, error instanceof assert.AssertionError ? error.message : "details omitted"); process.exitCode = 1;});
