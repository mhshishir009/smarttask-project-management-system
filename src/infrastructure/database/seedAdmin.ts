import "reflect-metadata";
import "dotenv/config";

import * as argon2 from "argon2";

import { AppDataSource } from "./data-source";
import { UserOrmEntity } from "./entities/UserOrmEntity";
import { RoleOrmEntity } from "./entities/RoleOrmEntity";

async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD are required in .env"
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) ||
      adminEmail.length > 255
    ) {
      throw new Error("Invalid admin email");
    }

    if (adminPassword.length < 12) {
      throw new Error(
        "Admin password must have at least 12 characters"
      );
    }

    await AppDataSource.initialize();

    const roleRepository =
      AppDataSource.getRepository(RoleOrmEntity);

    const userRepository =
      AppDataSource.getRepository(UserOrmEntity);

    
    const adminRole = await roleRepository.findOneBy({
      roleCode: "ADMIN",
    });

    if (!adminRole) {
      throw new Error(
        "ADMIN role not found. Run seedRoles first."
      );
    }

    
    const existingUser = await userRepository
      .createQueryBuilder("user")
      .where("LOWER(user.email) = :email", {
        email: adminEmail,
      })
      .getOne();

    if (existingUser) {
      console.log(
        "A user with this email already exists. No changes made."
      );
      return;
    }

    
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

   
    const admin = userRepository.create({
      roleId: adminRole.roleId,
      fullName: "System Administrator",
      email: adminEmail,
      passwordHash,
      isActive: true,
      isSystemAdmin: true,
      mustChangePassword: true,
      authVersion: 0,
    });

    const savedAdmin = await userRepository.save(admin);

    console.log("System Admin created successfully!");
    console.log("Admin User ID:", savedAdmin.userId);
    console.log("Admin Email:", savedAdmin.email);
    console.log("Password change required on first login.");
  } catch (error) {
    console.error("Admin seeding failed:", error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seedAdmin();
