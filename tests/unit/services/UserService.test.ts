
import { describe, it, expect, vi } from "vitest";

import { UserService } from "../../../src/application/services/UserService";
import { IUserRepository } from "../../../src/domain/repositories/IUserRepository";
import { IRoleRepository } from "../../../src/domain/repositories/IRoleRepository";
import { IPasswordHasher } from "../../../src/application/interfaces/IPasswordHasher";

describe("UserService - createUser", () => {

  // ==========================================
  // TEST 1: Successful User Creation
  // ==========================================
  it("should create a user successfully", async () => {
    // Arrange
    const now = new Date();

    const mockUserRepository = {
      getUserByEmail: vi.fn().mockResolvedValue(null),

      createUser: vi.fn().mockImplementation(async (data) => ({
        userId: 1,
        ...data,
        createdAt: now,
        updatedAt: now,
      })),
    } as unknown as IUserRepository;

    const mockRoleRepository = {
      getRoleById: vi.fn().mockResolvedValue({
        roleId: 2,
        roleCode: "TEAM_MEMBER",
        roleName: "Team Member",
        createdAt: now,
      }),
    } as unknown as IRoleRepository;

    const mockPasswordHasher = {
      hashPassword: vi.fn().mockResolvedValue("hashed_password"),
    } as unknown as IPasswordHasher;

    const userService = new UserService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordHasher
    );

    // Act
    const result = await userService.createUser({
      fullName: "Test User",
      email: "test@example.com",
      roleId: 2,
      temporaryPassword: "TestPassword123!",
    });

    // Assert
    expect(result.userId).toBe(1);
    expect(result.fullName).toBe("Test User");
    expect(result.email).toBe("test@example.com");
    expect(result.mustChangePassword).toBe(true);
    expect(result.isActive).toBe(true);

    expect(mockPasswordHasher.hashPassword)
      .toHaveBeenCalledWith("TestPassword123!");

    expect(result).not.toHaveProperty("passwordHash");

    expect(mockUserRepository.createUser)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: "hashed_password",
          roleId: 2,
          isSystemAdmin: false,
          mustChangePassword: true,
        })
      );
  });


  // ==========================================
  // TEST 2: Duplicate Email Validation
  // ==========================================
  it("should reject duplicate email", async () => {
    // Arrange
    const mockUserRepository = {
      getUserByEmail: vi.fn().mockResolvedValue({
        userId: 1,
        email: "test@example.com",
      }),
      createUser: vi.fn(),
    } as unknown as IUserRepository;

    const mockRoleRepository = {
      getRoleById: vi.fn().mockResolvedValue({
        roleId: 2,
        roleCode: "TEAM_MEMBER",
      }),
    } as unknown as IRoleRepository;

    const mockPasswordHasher = {
      hashPassword: vi.fn(),
    } as unknown as IPasswordHasher;

    const userService = new UserService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordHasher
    );

    // Act & Assert
    await expect(
      userService.createUser({
        fullName: "Test User",
        email: "test@example.com",
        roleId: 2,
        temporaryPassword: "TestPassword123!",
      })
    ).rejects.toThrow("Email already exists");

    expect(mockUserRepository.createUser)
      .not.toHaveBeenCalled();

    expect(mockPasswordHasher.hashPassword)
      .not.toHaveBeenCalled();
  });


  // ==========================================
  // TEST 3: Role Not Found
  // ==========================================
  it("should reject user creation when role is not found", async () => {
    // Arrange
    const mockUserRepository = {
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
    } as unknown as IUserRepository;

    const mockRoleRepository = {
      getRoleById: vi.fn().mockResolvedValue(null),
    } as unknown as IRoleRepository;

    const mockPasswordHasher = {
      hashPassword: vi.fn(),
    } as unknown as IPasswordHasher;

    const userService = new UserService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordHasher
    );

    // Act & Assert
    await expect(
      userService.createUser({
        fullName: "Test User",
        email: "test@example.com",
        roleId: 999,
        temporaryPassword: "TestPassword123!",
      })
    ).rejects.toThrow("Role not found");

    expect(mockRoleRepository.getRoleById)
      .toHaveBeenCalledWith(999);

    expect(mockUserRepository.createUser)
      .not.toHaveBeenCalled();

    expect(mockUserRepository.getUserByEmail)
      .not.toHaveBeenCalled();

    expect(mockPasswordHasher.hashPassword)
      .not.toHaveBeenCalled();
  });


  // ==========================================
  // TEST 4: Invalid Role ID
  // ==========================================
  it("should reject invalid role ID", async () => {
    // Arrange
    const mockUserRepository = {
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
    } as unknown as IUserRepository;

    const mockRoleRepository = {
      getRoleById: vi.fn(),
    } as unknown as IRoleRepository;

    const mockPasswordHasher = {
      hashPassword: vi.fn(),
    } as unknown as IPasswordHasher;

    const userService = new UserService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordHasher
    );

    // Act & Assert
    await expect(
      userService.createUser({
        fullName: "Test User",
        email: "test@example.com",
        roleId: 0,
        temporaryPassword: "TestPassword123!",
      })
    ).rejects.toThrow("Invalid role ID");

    expect(mockRoleRepository.getRoleById)
      .not.toHaveBeenCalled();

    expect(mockUserRepository.createUser)
      .not.toHaveBeenCalled();

    expect(mockPasswordHasher.hashPassword)
      .not.toHaveBeenCalled();
  });

  
it("should reject a temporary password shorter than 12 characters", async () => {
  // Arrange
  const mockUserRepository = {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
  } as unknown as IUserRepository;

  const mockRoleRepository = {
    getRoleById: vi.fn(),
  } as unknown as IRoleRepository;

  const mockPasswordHasher = {
    hashPassword: vi.fn(),
  } as unknown as IPasswordHasher;

  const userService = new UserService(
    mockUserRepository,
    mockRoleRepository,
    mockPasswordHasher
  );

  // Act & Assert
  await expect(
    userService.createUser({
      fullName: "Test User",
      email: "test@example.com",
      roleId: 2,
      temporaryPassword: "Short123",
    })
  ).rejects.toThrow(
    "Temporary password must have at least 12 characters"
  );

  expect(mockRoleRepository.getRoleById)
    .not.toHaveBeenCalled();

  expect(mockUserRepository.createUser)
    .not.toHaveBeenCalled();

  expect(mockPasswordHasher.hashPassword)
    .not.toHaveBeenCalled();
});


});
