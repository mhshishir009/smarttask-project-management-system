
import { AppDataSource } from "./data-source";
import { RoleOrmEntity } from "./entities/RoleOrmEntity";

async function seedRoles(): Promise<void> {
  try {
    await AppDataSource.initialize();

    const roleRepository =
      AppDataSource.getRepository(RoleOrmEntity);

    const roles = [
      { roleCode: "ADMIN", roleName: "Administrator" },
      { roleCode: "TEAM_MEMBER", roleName: "Team Member" },
    ];

    for (const role of roles) {
      await roleRepository
        .createQueryBuilder()
        .insert()
        .into(RoleOrmEntity)
        .values(role)
        .orIgnore()
        .execute();
    }

    console.log("Default roles seeded successfully!");

    const savedRoles = await roleRepository.find();

    console.table(
      savedRoles.map((role) => ({
        roleId: role.roleId,
        roleCode: role.roleCode,
        roleName: role.roleName,
      }))
    );
  } catch (error) {
    console.error("Role seeding failed:", error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seedRoles();
