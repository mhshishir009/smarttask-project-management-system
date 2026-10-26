import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { User } from "../../src/domain/entities/User";
import type { IUserRepository } from "../../src/domain/repositories/IUserRepository";
import type { IRoleRepository } from "../../src/domain/repositories/IRoleRepository";
import type { ITokenService } from "../../src/application/interfaces/ITokenService";
import { AuthService } from "../../src/application/services/AuthService";
import { AuthController } from "../../src/presentation/controllers/AuthController";
import { createAuthRoutes } from "../../src/presentation/routes/authRoutes";
import { Argon2PasswordHasher } from "../../src/infrastructure/security/Argon2PasswordHasher";

// Exercise the real HTTP route, service and Argon2 hasher without modifying a database.
describe("Public registration API", () => {
  let server: Server;
  let baseUrl: string;
  let records: User[];
  let createUser: ReturnType<typeof vi.fn>;
  let getUserByEmail: ReturnType<typeof vi.fn>;
  let getRoleByCode: ReturnType<typeof vi.fn>;
  const hasher = new Argon2PasswordHasher();
  const valid = { fullName: "Signup User", email: "signup@example.test", password: "SignupPassword123!" };

  beforeEach(async () => {
    records = [];
    getUserByEmail = vi.fn(async (email: string) => records.find(user => user.email === email) ?? null);
    createUser = vi.fn(async (data: Omit<User, "userId" | "createdAt" | "updatedAt">) => {
      const user = { ...data, userId: records.length + 1, createdAt: new Date(), updatedAt: new Date() };
      records.push(user);
      return user;
    });
    getRoleByCode = vi.fn(async () => ({ roleId: 2, roleCode: "TEAM_MEMBER", roleName: "Team Member", createdAt: new Date() }));
    const users = { createUser, getUserByEmail } as unknown as IUserRepository;
    const roles = { getRoleByCode } as unknown as IRoleRepository;
    const tokens = { generateToken: vi.fn(() => "test-login-token") } as unknown as ITokenService;
    const service = new AuthService(users, hasher, tokens, roles);
    const app = express();
    app.use(express.json());
    app.use("/api/auth", createAuthRoutes(new AuthController(service), tokens, users));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // Match the existing app.ts parser-error handling in this isolated auth router harness.
      const parserError = error as { status?: number; type?: string };
      if (error instanceof SyntaxError && parserError.status === 400 && parserError.type === "entity.parse.failed") {
        res.status(400).json({ success: false, message: "Invalid JSON request body" });
        return;
      }
      res.status(500).json({ success: false, message: "Internal server error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  const post = async (body: unknown, route = "/register") => {
    const response = await fetch(baseUrl + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  it("registers without a token, hashes the password and permits ordinary login", async () => {
    const result = await post({ ...valid, fullName: "  Signup User  ", email: "  SIGNUP@example.test  " });
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ fullName: valid.fullName, email: valid.email, roleId: 2,
      isSystemAdmin: false, mustChangePassword: false, isActive: true });
    expect(result.body.data).not.toHaveProperty("passwordHash");
    expect(result.body.data).not.toHaveProperty("password");
    expect(getRoleByCode).toHaveBeenCalledWith("TEAM_MEMBER");
    expect(records[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(await hasher.verifyPassword(records[0].passwordHash, valid.password)).toBe(true);
    const login = await post({ email: valid.email, password: valid.password }, "/login");
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ accessToken: "test-login-token", mustChangePassword: false });
  });

  it("ignores attempts to grant administrator privileges or choose account flags", async () => {
    const result = await post({ ...valid, roleId: 1, role: "ADMIN", roleCode: "ADMIN",
      isSystemAdmin: true, isActive: false, authVersion: 999, mustChangePassword: true });
    expect(result.status).toBe(201);
    expect(records[0]).toMatchObject({ roleId: 2, isSystemAdmin: false, isActive: true,
      authVersion: 0, mustChangePassword: false });
  });

  it.each([
    ["missing fields", {}],
    ["null body", null],
    ["array body", []],
    ["blank name", { ...valid, fullName: "   " }],
    ["non-string name", { ...valid, fullName: 123 }],
    ["non-string email", { ...valid, email: 123 }],
    ["invalid email", { ...valid, email: "not-an-email" }],
    ["long name", { ...valid, fullName: "a".repeat(151) }],
    ["long email", { ...valid, email: "a".repeat(250) + "@example.test" }],
    ["short password", { ...valid, password: "Short123!" }],
    ["blank password", { ...valid, password: " ".repeat(12) }],
    ["non-string password", { ...valid, password: 123456789012 }],
  ])("rejects %s with HTTP 400 without inserting a user", async (_name, body) => {
    const result = await post(body);
    expect(result.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("returns 409 for an existing email regardless of casing or surrounding spaces", async () => {
    expect((await post(valid)).status).toBe(201);
    const result = await post({ ...valid, email: " SIGNUP@EXAMPLE.TEST " });
    expect(result.status).toBe(409);
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("maps the unique email constraint to 409 (wrapped driver error: %s)", async wrapped => {
    // Simulate two signups passing the precheck before PostgreSQL rejects the duplicate.
    const conflict = { code: "23505", constraint: "ux_users_email" };
    createUser.mockRejectedValueOnce(wrapped ? { driverError: conflict } : conflict);
    const result = await post(valid);
    expect(result.status).toBe(409);
    expect(result.body.message).toBe("Email already exists");
  });

  it("does not report unrelated database errors as duplicate emails", async () => {
    createUser.mockRejectedValueOnce({ code: "23505", constraint: "another_unique_index" });
    expect((await post(valid)).status).toBe(500);
  });

  it("fails closed when the team member role has not been seeded", async () => {
    getRoleByCode.mockResolvedValueOnce(null);
    expect((await post(valid)).status).toBe(503);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("keeps password changes protected by authentication", async () => {
    expect((await post({ currentPassword: valid.password, newPassword: "OtherPassword123!" }, "/change-password")).status).toBe(401);
  });
});
