
import { RoleDto } from "../../application/dto/RoleDto";

export interface RoleViewModel {
  roleId: number;
  roleCode: "ADMIN" | "TEAM_MEMBER";
  roleName: string;
}

export function toRoleViewModel(
  role: RoleDto
): RoleViewModel {
  return {
    roleId: role.roleId,
    roleCode: role.roleCode,
    roleName: role.roleName,
  };
}
