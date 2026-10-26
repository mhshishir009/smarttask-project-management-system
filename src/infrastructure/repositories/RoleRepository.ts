
import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { RoleOrmEntity } from "../database/entities/RoleOrmEntity";
import { Role } from "../../domain/entities/Role";
import { IRoleRepository } from "../../domain/repositories/IRoleRepository";

export class RoleRepository implements IRoleRepository {
  private readonly repository: Repository<RoleOrmEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(RoleOrmEntity);
  }

  async getAllRoles(): Promise<Role[]> {
    const roles = await this.repository.find({
      order: { roleId: "ASC" },
    });

    return roles.map((role) => this.mapToDomain(role));
  }

  async getRoleById(roleId: number): Promise<Role | null> {
    const role = await this.repository.findOneBy({ roleId });

    return role ? this.mapToDomain(role) : null;
  }

  async getRoleByCode(
    roleCode: Role["roleCode"]
  ): Promise<Role | null> {
    const role = await this.repository.findOneBy({ roleCode });

    return role ? this.mapToDomain(role) : null;
  }

  private mapToDomain(role: RoleOrmEntity): Role {
    return {
      roleId: role.roleId,
      roleCode: role.roleCode as Role["roleCode"],
      roleName: role.roleName,
      createdAt: role.createdAt,
    };
  }
}
