
import { User } from "../entities/User";

export interface IUserRepository {

  // Get all users
  getAllUsers(): Promise<User[]>;

  // Get user by ID
  getUserById(userId: number): Promise<User | null>;

  // Get user by email
  getUserByEmail(email: string): Promise<User | null>;

  // Create new user
  createUser(
    user: Omit<User, "userId" | "createdAt" | "updatedAt">
  ): Promise<User>;

  // Update user information
  updateUser(
    userId: number,
    user: Partial<User>
  ): Promise<User | null>;

  // Deactivate user
  deactivateUser(userId: number): Promise<boolean>;

  // Change password and invalidate old JWT tokens
  changePassword(
    userId: number,
    currentPasswordHash: string,
    newPasswordHash: string
  ): Promise<boolean>;
}
