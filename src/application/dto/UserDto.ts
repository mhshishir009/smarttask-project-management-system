export interface UserDto {
  userId: number;
  roleId: number;
  fullName: string;
  email: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}
