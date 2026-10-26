import { Role } from "../entities/Role";

export interface IRoleRepository {
  getAllRoles(): Promise<Role[]>;
  getRoleById(roleId: number): Promise<Role | null>;
  getRoleByCode(roleCode: Role["roleCode"]): Promise<Role | null>;
}
