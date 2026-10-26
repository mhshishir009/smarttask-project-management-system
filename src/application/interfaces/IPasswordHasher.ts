export interface IPasswordHasher {
  hashPassword(password: string): Promise<string>;

  verifyPassword(
    hashedPassword: string,
    plainPassword: string
  ): Promise<boolean>;
}
