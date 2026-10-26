
import * as argon2 from "argon2";
import { IPasswordHasher } from "../../application/interfaces/IPasswordHasher";

export class Argon2PasswordHasher implements IPasswordHasher {
  async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(
    hashedPassword: string,
    plainPassword: string
  ): Promise<boolean> {
    return await argon2.verify(
      hashedPassword,
      plainPassword
    );
  }
}
