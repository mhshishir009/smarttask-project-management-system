export interface CreateUserDto {
  fullName: string;
  email: string;
  roleId: number;
  temporaryPassword: string;
}
