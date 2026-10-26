export interface User {
  userId: number;
  roleId: number;
  fullName: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
  authVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
