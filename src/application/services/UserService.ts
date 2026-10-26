
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IRoleRepository } from "../../domain/repositories/IRoleRepository";
import { IPasswordHasher } from "../interfaces/IPasswordHasher";

import { CreateUserDto } from "../dto/CreateUserDto";
import { UserDto } from "../dto/UserDto";
import { User } from "../../domain/entities/User";

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly roleRepository: IRoleRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  // ==========================================
  // 1. CREATE USER
  // ==========================================
  async createUser(dto: CreateUserDto): Promise<UserDto> {
    const fullName = dto.fullName?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (!fullName || !email || !dto.temporaryPassword) {
      throw new Error("Required fields are missing");
    }

    if (fullName.length > 150 || email.length > 255) {
      throw new Error("Name or email exceeds allowed length");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email address");
    }

    if (dto.temporaryPassword.length < 12) {
      throw new Error("Temporary password must have at least 12 characters");
    }

    if (!Number.isSafeInteger(dto.roleId) || dto.roleId <= 0) {
      throw new Error("Invalid role ID");
    }

    const role = await this.roleRepository.getRoleById(dto.roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    const existingUser =
      await this.userRepository.getUserByEmail(email);

    if (existingUser) {
      throw new Error("Email already exists");
    }

    const passwordHash = await this.passwordHasher.hashPassword(
      dto.temporaryPassword
    );

    const newUser = await this.userRepository.createUser({
      roleId: dto.roleId,
      fullName,
      email,
      passwordHash,
      isActive: true,
      isSystemAdmin: false,
      mustChangePassword: true,
      authVersion: 0,
    });

    return this.mapToDto(newUser);
  }

  // ==========================================
  // 2. GET ALL USERS
  // ==========================================
  async getAllUsers(): Promise<UserDto[]> {
    const users = await this.userRepository.getAllUsers();

    return users.map((user) => this.mapToDto(user));
  }

  // ==========================================
  // 3. GET USER BY ID
  // ==========================================
  async getUserById(userId: number): Promise<UserDto | null> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("Invalid user ID");
    }

    const user = await this.userRepository.getUserById(userId);

    return user ? this.mapToDto(user) : null;
  }

  // ==========================================
  // 4. UPDATE USER PROFILE
  // ==========================================
  async updateUser(
    userId: number,
    data: { fullName?: string; email?: string }
  ): Promise<UserDto | null> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("Invalid user ID");
    }

    const updateData: Partial<User> = {};

    if (data.fullName !== undefined) {
      const fullName = data.fullName.trim();

      if (!fullName || fullName.length > 150) {
        throw new Error("Invalid full name");
      }

      updateData.fullName = fullName;
    }

    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();

      if (
        email.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new Error("Invalid email address");
      }

      const existingUser =
        await this.userRepository.getUserByEmail(email);

      if (existingUser && existingUser.userId !== userId) {
        throw new Error("Email already exists");
      }

      updateData.email = email;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("No valid fields provided for update");
    }

    const updatedUser = await this.userRepository.updateUser(
      userId,
      updateData
    );

    return updatedUser ? this.mapToDto(updatedUser) : null;
  }

  // ==========================================
  // 5. DEACTIVATE USER
  // ==========================================
  async deactivateUser(userId: number): Promise<boolean> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error("Invalid user ID");
    }

    return await this.userRepository.deactivateUser(userId);
  }

  // ==========================================
  // MAP DOMAIN ENTITY TO RESPONSE DTO
  // ==========================================
  private mapToDto(user: User): UserDto {
    return {
      userId: user.userId,
      roleId: user.roleId,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
