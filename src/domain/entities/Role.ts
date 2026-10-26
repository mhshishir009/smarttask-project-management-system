export interface Role {
  roleId: number;
  roleCode: "ADMIN" | "TEAM_MEMBER";
  roleName: string;
  createdAt: Date;
}