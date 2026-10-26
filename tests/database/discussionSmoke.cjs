// Run after npm run build. All SQL is isolated to pg_temp and rolled back.
require("dotenv").config({quiet: true});
const assert = require("node:assert/strict");
const {Client} = require("pg");
const {AppDataSource} = require("../../dist/infrastructure/database/data-source");
const {DiscussionRepository} = require("../../dist/infrastructure/repositories/DiscussionRepository");
const {DiscussionService} = require("../../dist/application/services/DiscussionService");
const {CreateProjectMessages1792999492767} = require("../../dist/infrastructure/database/migrations/1792999492767-CreateProjectMessages");

async function main() {
  const client = new Client({host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME});
  const original = AppDataSource.transaction;
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE roles (id SMALLINT PRIMARY KEY, code TEXT)");
    await client.query("SET LOCAL search_path TO pg_temp");
    await client.query("CREATE TEMP TABLE users (id BIGINT PRIMARY KEY, role_id SMALLINT, full_name TEXT, is_active BOOLEAN)");
    await client.query("CREATE TEMP TABLE projects (id BIGINT PRIMARY KEY, is_archived BOOLEAN)");
    await client.query("CREATE TEMP TABLE tasks (id BIGINT PRIMARY KEY, project_id BIGINT, assignee_id BIGINT)");
    await new CreateProjectMessages1792999492767().up({query: (sql, args) => client.query(sql, args)});
    const persistence = await client.query("SELECT relpersistence FROM pg_class WHERE oid = 'project_messages'::regclass");
    assert.equal(persistence.rows[0].relpersistence, "t", "Smoke test must use temporary relations only");
    await client.query("INSERT INTO roles VALUES (1, 'ADMIN'), (2, 'TEAM_MEMBER')");
    await client.query("INSERT INTO users VALUES (1,1,'Admin',true), (2,2,'Member',true), (3,2,'Outside',true), (4,2,'Inactive',false)");
    await client.query("INSERT INTO projects VALUES (1,false), (2,true)");
    await client.query("INSERT INTO tasks VALUES (1,1,2), (2,2,2)");
    AppDataSource.transaction = async callback => callback({query: async (sql, args) => (await client.query(sql, args)).rows});
    const service = new DiscussionService(new DiscussionRepository());
    const admin = {userId: 1, role: "ADMIN"}, member = {userId: 2, role: "TEAM_MEMBER"};
    const message = await service.addMessage(1, admin, "  'Hello' <team>  ");
    assert.equal(message.body, "'Hello' <team>");
    assert.equal(message.authorName, "Admin");
    assert.equal((await service.listMessages(1, member)).messages.length, 1);
    assert.equal((await service.addMessage(1, member, "Reply")).authorId, 2);
    await assert.rejects(() => service.addMessage(1, {userId: 3, role: "TEAM_MEMBER"}, "Blocked"), {code: "FORBIDDEN"});
    await assert.rejects(() => service.listMessages(1, {userId: 4, role: "TEAM_MEMBER"}), {code: "FORBIDDEN"});
    await assert.rejects(() => service.addMessage(2, admin, "Blocked"), {code: "ARCHIVED"});
    assert.equal((await service.listMessages(2, member)).isArchived, true);
    await client.query("INSERT INTO project_messages(project_id,author_id,body) SELECT 1,1,'Message ' || n FROM generate_series(1,52) AS n");
    const latest = await service.listMessages(1, admin);
    const older = await service.listMessages(1, admin, latest.nextBefore);
    assert.equal(latest.messages.length, 50);
    assert.equal(older.messages.length, 4);
    assert.equal(older.nextBefore, null);
    assert.ok(older.messages.at(-1).messageId < latest.messages[0].messageId);
    await client.query("DELETE FROM tasks WHERE project_id = 1");
    await assert.rejects(() => service.listMessages(1, member), {code: "FORBIDDEN"});
    await client.query("SAVEPOINT deletion_guard");
    await assert.rejects(() => client.query("DELETE FROM projects WHERE id = 1"), {code: "23503", constraint: "fk_project_messages_project"});
    await client.query("ROLLBACK TO SAVEPOINT deletion_guard");
    console.log("PASS: migration SQL, persisted messages, assignment permissions, archived read-only, pagination and history protection (temporary tables only).");
  } finally {
    AppDataSource.transaction = original;
    await client.query("ROLLBACK");
    await client.end();
  }
}
main().catch(() => {console.error("Discussion database smoke test failed. Connection details are not printed."); process.exitCode = 1;});
