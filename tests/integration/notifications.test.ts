import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";
import type { NotificationRepository } from "../../src/infrastructure/repositories/NotificationRepository";
import { createNotificationRoutes } from "../../src/presentation/routes/notificationRoutes";

describe("Recipient-scoped notification HTTP API", () => {
  let server: Server, base: string;
  const list = vi.fn(), markRead = vi.fn(), markAllRead = vi.fn();
  beforeEach(async () => {
    vi.resetAllMocks();
    list.mockResolvedValue({notifications: [], unreadCount: 0, nextBefore: null});
    markRead.mockResolvedValue(true); markAllRead.mockResolvedValue(undefined);
    const users = {getUserById: async id => ({userId: id, roleId: id === 2 ? 2 : 1, authVersion: 0, isActive: id !== 4, mustChangePassword: id === 3})} as unknown as IUserRepository;
    const tokens = {verifyToken: token => {
      const id = {admin: 1, member: 2, temporary: 3, inactive: 4}[token];
      if (!id) throw new Error("Invalid token");
      return {userId: id, roleId: id === 2 ? 2 : 1, authVersion: 0, mustChangePassword: id === 3};
    }} as ITokenService;
    const app = express(); app.use(express.json());
    app.use("/api/notifications", createNotificationRoutes({list, markRead, markAllRead} as unknown as NotificationRepository, tokens, users));
    app.use((_err, _req, res, _next) => res.status(500).json({message: "Internal server error"}));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/notifications`;
  });
  afterEach(async () => {await new Promise<void>(resolve => server.close(() => resolve()));});
  const request = async (path = "", method = "GET", body?: unknown, token: string | null = "member") => {
    const result = await fetch(base + path, {method, headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
    return {status: result.status, body: await result.json()};
  };
  it("lists only the authenticated member and ignores a supplied recipient ID", async () => {
    expect((await request("?recipientId=1&before=80")).status).toBe(200);
    expect(list).toHaveBeenCalledWith(2, "TEAM_MEMBER", 80);
  });
  it("passes the authenticated admin role", async () => {
    expect((await request("", "GET", undefined, "admin")).status).toBe(200);
    expect(list).toHaveBeenCalledWith(1, "ADMIN", undefined);
  });
  it("marks a notification for the authenticated recipient, ignoring body ownership", async () => {
    expect((await request("/80/read", "PATCH", {recipientId: 1})).status).toBe(200);
    expect(markRead).toHaveBeenCalledWith(2, 80);
  });
  it("returns 404 when another user's or missing notification is requested", async () => {
    markRead.mockResolvedValueOnce(false);
    expect((await request("/80/read", "PATCH")).status).toBe(404);
  });
  it("marks a bounded snapshot rather than future notifications or another user's rows", async () => {
    expect((await request("/read-all", "PATCH", {throughId: 80, recipientId: 1})).status).toBe(200);
    expect(markAllRead).toHaveBeenCalledWith(2, 80);
  });
  it.each(["0", "01", "abc", "-1", "1.5", "9007199254740992"])("rejects invalid notification ID/cursor %s", async id => {
    expect((await request(`/${id}/read`, "PATCH")).status).toBe(400);
    expect((await request(`?before=${id}`)).status).toBe(400);
    expect(list).not.toHaveBeenCalled(); expect(markRead).not.toHaveBeenCalled();
  });
  it("rejects duplicate cursor fields", async () => {expect((await request("?before=1&before=2")).status).toBe(400);});
  it.each([{}, {throughId: 0}, {throughId: "80"}, {throughId: null}, {throughId: 1.5}])("rejects invalid read-all snapshots %#", async body => {
    expect((await request("/read-all", "PATCH", body)).status).toBe(400);
    expect(markAllRead).not.toHaveBeenCalled();
  });
  it.each([[null, 401], ["invalid", 401], ["inactive", 401], ["temporary", 403]])("blocks unauthorized session %s", async (token, status) => {
    expect((await request("", "GET", undefined, token as string | null)).status).toBe(status);
    expect(list).not.toHaveBeenCalled();
  });
  it("hides database failure details", async () => {
    list.mockRejectedValueOnce(new Error("Private database connection"));
    expect(await request()).toEqual({status: 500, body: {message: "Internal server error"}});
  });
});
