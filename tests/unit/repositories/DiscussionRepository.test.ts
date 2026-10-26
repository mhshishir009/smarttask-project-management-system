import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({query: vi.fn()}));
vi.mock("../../../src/infrastructure/database/data-source", () => ({AppDataSource: {transaction: async callback => callback(db)}}));
import { DiscussionRepository } from "../../../src/infrastructure/repositories/DiscussionRepository";

describe("Discussion repository authorization and pagination", () => {
  const repo = new DiscussionRepository();
  const admin = {userId: 1, role: "ADMIN" as const};
  const member = {userId: 2, role: "TEAM_MEMBER" as const};
  const row = (id = 1) => ({id: String(id), project_id: "6", author_id: "1", body: "Update", created_at: new Date(), author_name: "Admin"});
  const allow = (archived = false, role = "ADMIN") => db.query.mockResolvedValueOnce([{is_archived: archived}]).mockResolvedValueOnce([{full_name: "Admin", role_code: role}]);
  beforeEach(() => db.query.mockReset());

  it("locks the project and current author before inserting bound message values", async () => {
    allow(); db.query.mockResolvedValueOnce([row()]);
    const result = await repo.addMessage(6, admin, "'quoted' update");
    expect(db.query.mock.calls[0]).toEqual([expect.stringContaining("FOR UPDATE"), [6]]);
    expect(db.query.mock.calls[1][0]).toContain("FOR SHARE OF u");
    expect(db.query.mock.calls[2]).toEqual([expect.stringContaining("VALUES ($1, $2, $3)"), [6, 1, "'quoted' update"]]);
    expect(result).toMatchObject({messageId: 1, authorId: 1, authorName: "Admin"});
  });
  it("rejects nonexistent projects without looking up or inserting messages", async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(repo.addMessage(6, admin, "Hi")).rejects.toMatchObject({code: "NOT_FOUND"});
    expect(db.query).toHaveBeenCalledTimes(1);
  });
  it.each([{users: []}, {users: [{full_name: "Admin", role_code: "TEAM_MEMBER"}]}])("rejects inactive or changed-role authors", async ({users}) => {
    db.query.mockResolvedValueOnce([{is_archived: false}]).mockResolvedValueOnce(users);
    await expect(repo.addMessage(6, admin, "Hi")).rejects.toMatchObject({code: "FORBIDDEN"});
    expect(db.query).toHaveBeenCalledTimes(2);
  });
  it("rejects members without a current project assignment before reading history", async () => {
    allow(false, "TEAM_MEMBER"); db.query.mockResolvedValueOnce([]);
    await expect(repo.listMessages(6, member)).rejects.toMatchObject({code: "FORBIDDEN"});
    expect(db.query.mock.calls[2][1]).toEqual([6, 2]);
    expect(db.query).toHaveBeenCalledTimes(3);
  });
  it("allows an assigned member to write using their authenticated ID", async () => {
    allow(false, "TEAM_MEMBER"); db.query.mockResolvedValueOnce([{id: "5"}]).mockResolvedValueOnce([{...row(), author_id: "2"}]);
    expect((await repo.addMessage(6, member, "Question")).authorId).toBe(2);
    expect(db.query.mock.calls[3][1]).toEqual([6, 2, "Question"]);
  });
  it("blocks writes to archived projects", async () => {
    allow(true);
    await expect(repo.addMessage(6, admin, "Hi")).rejects.toMatchObject({code: "ARCHIVED"});
    expect(db.query).toHaveBeenCalledTimes(2);
  });
  it("permits archived history and returns latest 50 chronologically with an older cursor", async () => {
    allow(true); db.query.mockResolvedValueOnce(Array.from({length: 51}, (_, i) => row(100 - i)));
    const page = await repo.listMessages(6, admin, 101);
    expect(page.messages).toHaveLength(50);
    expect(page.messages[0].messageId).toBe(51);
    expect(page.messages[49].messageId).toBe(100);
    expect(page).toMatchObject({isArchived: true, nextBefore: 51});
    expect(db.query.mock.calls[0][0]).toContain("FOR SHARE");
    expect(db.query.mock.calls[2][1]).toEqual([6, 101]);
  });
  it("returns an empty thread without a pagination cursor", async () => {
    allow(); db.query.mockResolvedValueOnce([]);
    expect(await repo.listMessages(6, admin)).toEqual({messages: [], nextBefore: null, isArchived: false});
  });
});
