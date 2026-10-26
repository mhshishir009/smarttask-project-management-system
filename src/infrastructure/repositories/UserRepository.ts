
import { Repository } from "typeorm";

import { AppDataSource } from "../database/data-source";
import { UserOrmEntity } from "../database/entities/UserOrmEntity";

import { User } from "../../domain/entities/User";
import { IUserRepository } from "../../domain/repositories/IUserRepository";

export class UserRepository implements IUserRepository {
  private readonly repository: Repository<UserOrmEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(UserOrmEntity);
  }

  // ==========================================
  // 1. GET ALL USERS
  // ==========================================
  async getAllUsers(): Promise<User[]> {
    const users = await this.repository
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .orderBy("user.userId", "ASC")
      .getMany();

    return users.map((user) => this.mapToDomain(user));
  }

  // ==========================================
  // 2. GET USER BY ID
  // ==========================================
  async getUserById(
    userId: number
  ): Promise<User | null> {
    const user = await this.repository
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.userId = :userId", { userId })
      .getOne();

    return user ? this.mapToDomain(user) : null;
  }

  // ==========================================
  // 3. GET USER BY EMAIL
  // ==========================================
  async getUserByEmail(
    email: string
  ): Promise<User | null> {
    const user = await this.repository
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("LOWER(user.email) = LOWER(:email)", {
        email: email.trim(),
      })
      .getOne();

    return user ? this.mapToDomain(user) : null;
  }

  // ==========================================
  // 4. CREATE USER
  // ==========================================
  async createUser(
    user: Omit<User, "userId" | "createdAt" | "updatedAt">
  ): Promise<User> {
    const newUser = this.repository.create({
      roleId: user.roleId,
      fullName: user.fullName,
      email: user.email.trim().toLowerCase(),
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      mustChangePassword: user.mustChangePassword,
      authVersion: user.authVersion,
    });

    const savedUser = await this.repository.save(
      newUser
    );

    return this.mapToDomain(savedUser);
  }

  // ==========================================
  // 5. UPDATE USER
  // ==========================================
  async updateUser(
    userId: number,
    user: Partial<User>
  ): Promise<User | null> {
    const updateData: Partial<UserOrmEntity> = {};

    if (user.fullName !== undefined) {
      updateData.fullName = user.fullName;
    }

    if (user.email !== undefined) {
      updateData.email = user.email.trim().toLowerCase();
    }

    if (Object.keys(updateData).length === 0) {
      return this.getUserById(userId);
    }

    const result = await this.repository.update(
      { userId },
      updateData
    );

    if (result.affected !== 1) {
      return null;
    }

    return this.getUserById(userId);
  }

  // ==========================================
  // 6. DEACTIVATE USER
  // ==========================================
  async deactivateUser(
    userId: number
  ): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {

      // Serialize admin deactivation checks.
      // Preserve the existing advisory lock.
      await manager.query(
        "SELECT pg_advisory_xact_lock($1, $2)",
        [7321, 1]
      );

      // Lock the target user row.
      // TaskRepository uses FOR UPDATE on
      // the same user during task assignment.
      const lockedUsers: Array<{ id: string }> =
        await manager.query(
          `
          SELECT id
          FROM users
          WHERE id = $1
          FOR UPDATE
          `,
          [userId]
        );

      if (lockedUsers.length === 0) {
        return false;
      }

      const userRepository =
        manager.getRepository(UserOrmEntity);

      // Read the latest user information
      // after obtaining the database lock.
      const targetUser = await userRepository.findOne({
        where: { userId },
        relations: { role: true },
      });

      if (!targetUser) {
        return false;
      }

      // Already inactive: idempotent response.
      if (!targetUser.isActive) {
        return true;
      }

      // Protect the system administrator.
      if (targetUser.isSystemAdmin) {
        throw new Error(
          "System admin cannot be deactivated"
        );
      }

      // Protect the last active ADMIN.
      if (targetUser.role.roleCode === "ADMIN") {
        const activeAdminCount = await userRepository
          .createQueryBuilder("user")
          .innerJoin("user.role", "role")
          .where("role.code = :roleCode", {
            roleCode: "ADMIN",
          })
          .andWhere("user.isActive = :isActive", {
            isActive: true,
          })
          .getCount();

        if (activeAdminCount <= 1) {
          throw new Error(
            "Cannot deactivate the last active admin"
          );
        }
      }

      // Deactivate and invalidate existing JWTs.
      const result = await userRepository
        .createQueryBuilder()
        .update(UserOrmEntity)
        .set({
          isActive: false,
          authVersion: () => '"auth_version" + 1',
        })
        .where("id = :userId", { userId })
        .andWhere("is_active = :isActive", {
          isActive: true,
        })
        .execute();

      return result.affected === 1;
    });
  }

  // ==========================================
  // 7. CHANGE PASSWORD
  // ==========================================
  async changePassword(
    userId: number,
    currentPasswordHash: string,
    newPasswordHash: string
  ): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(UserOrmEntity)
      .set({
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        authVersion: () => '"auth_version" + 1',
      })
      .where("id = :userId", { userId })
      .andWhere("password_hash = :currentPasswordHash", {
        currentPasswordHash,
      })
      .andWhere("is_active = :isActive", {
        isActive: true,
      })
      .execute();

    return result.affected === 1;
  }

  // ==========================================
  // 8. MAP ORM ENTITY TO DOMAIN ENTITY
  // ==========================================
  private mapToDomain(
    user: UserOrmEntity
  ): User {
    const userId = Number(user.userId);
    const authVersion = Number(user.authVersion);

    if (
      !Number.isSafeInteger(userId) ||
      !Number.isSafeInteger(authVersion)
    ) {
      throw new Error(
        "User numeric value is out of range"
      );
    }

    return {
      userId,
      roleId: user.roleId,
      fullName: user.fullName,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      mustChangePassword: user.mustChangePassword,
      authVersion,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
