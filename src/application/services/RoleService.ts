
import { Role } from "../../domain/entities/Role";
import { IRoleRepository } from "../../domain/repositories/IRoleRepository";
import { RoleDto } from "../dto/RoleDto";

export class RoleService {
  constructor(
    private readonly roleRepository: IRoleRepository
  ) {}

  async getAllRoles(): Promise<RoleDto[]> {
    const roles = await this.roleRepository.getAllRoles();

    return roles.map((role) => this.mapToDto(role));
  }

  async getRoleById(roleId: number): Promise<RoleDto | null> {
    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
      throw new Error("Invalid role ID");
    }

    const role = await this.roleRepository.getRoleById(roleId);

    return role ? this.mapToDto(role) : null;
  }

  async getRoleByCode(
    roleCode: Role["roleCode"]
  ): Promise<RoleDto | null> {
    if (roleCode !== "ADMIN" && roleCode !== "TEAM_MEMBER") {
      throw new Error("Invalid role code");
    }

    const role = await this.roleRepository.getRoleByCode(roleCode);

    return role ? this.mapToDto(role) : null;
  }

  private mapToDto(role: Role): RoleDto {
    return {
      roleId: role.roleId,
      roleCode: role.roleCode,
      roleName: role.roleName,
    };
  }
}
