
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { IPasswordHasher } from "../interfaces/IPasswordHasher";
import { ITokenService } from "../interfaces/ITokenService";
import { LoginDto } from "../dto/LoginDto";
import { ChangePasswordDto } from "../dto/ChangePasswordDto";
import { RegisterDto } from "../dto/RegisterDto";
import { UserDto } from "../dto/UserDto";
import { IRoleRepository } from "../../domain/repositories/IRoleRepository";

// ==========================================
// LOGIN RESPONSE DTO
// ==========================================
export interface LoginResponseDto {
  accessToken: string;
  tokenType: "Bearer";
  mustChangePassword: boolean;
  user: {
    userId: number;
    roleId: number;
    fullName: string;
    email: string;
  };
}

// ==========================================
// AUTHENTICATION SERVICE
// ==========================================
export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
    private readonly roleRepository: IRoleRepository
  ) {}

  // Public signup chooses the member role server-side; client privileges are ignored.
  async register(dto: RegisterDto): Promise<UserDto> {
    const fullName = typeof dto?.fullName === "string" ? dto.fullName.trim() : "";
    const email = typeof dto?.email === "string" ? dto.email.trim().toLowerCase() : "";
    const password = dto?.password;

    if (!fullName || !email || typeof password !== "string" || !password.trim()) {
      throw new Error("Full name, email and password are required");
    }
    if (fullName.length > 150 || email.length > 255) {
      throw new Error("Name or email exceeds allowed length");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email address");
    }
    if (password.length < 12) {
      throw new Error("Password must contain at least 12 characters");
    }

    const role = await this.roleRepository.getRoleByCode("TEAM_MEMBER");
    if (!role) {
      throw new Error("Registration is unavailable. Team member role is not configured");
    }
    if (await this.userRepository.getUserByEmail(email)) {
      throw new Error("Email already exists");
    }

    const passwordHash = await this.passwordHasher.hashPassword(password);
    let user;
    try {
      user = await this.userRepository.createUser({
        roleId: role.roleId,
        fullName,
        email,
        passwordHash,
        isActive: true,
        isSystemAdmin: false,
        // Signup passwords are chosen by the user, unlike admin-issued temporary passwords.
        mustChangePassword: false,
        authVersion: 0,
      });
    } catch (error) {
      // The unique email index also prevents duplicates from concurrent signup requests.
      const databaseError = error as {
        code?: string; constraint?: string;
        driverError?: { code?: string; constraint?: string };
      } | null;
      const details = databaseError?.driverError ?? databaseError;
      if (details?.code === "23505" && details.constraint === "ux_users_email") {
        throw new Error("Email already exists");
      }
      throw error;
    }

    // Explicitly return public fields so password hashes never reach the signup response.
    return {
      userId: user.userId,
      roleId: user.roleId,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
      isSystemAdmin: user.isSystemAdmin,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ==========================================
  // USER LOGIN
  // ==========================================
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email =
      typeof dto?.email === "string"
        ? dto.email.trim().toLowerCase()
        : "";

    const password = dto?.password;

    // Validate login request
    if (
      !email ||
      typeof password !== "string" ||
      password.length === 0
    ) {
      throw new Error("Email and password are required");
    }

    // Find user
    const user = await this.userRepository.getUserByEmail(email);

    if (!user || !user.isActive) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isPasswordValid =
      await this.passwordHasher.verifyPassword(
        user.passwordHash,
        password
      );

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT
    const accessToken = this.tokenService.generateToken({
      userId: user.userId,
      roleId: user.roleId,
      authVersion: user.authVersion,
      mustChangePassword: user.mustChangePassword,
    });

    // Return safe response
    return {
      accessToken,
      tokenType: "Bearer",
      mustChangePassword: user.mustChangePassword,
      user: {
        userId: user.userId,
        roleId: user.roleId,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================
  async changePassword(
    userId: number,
    dto: ChangePasswordDto
  ): Promise<void> {
    const currentPassword = dto?.currentPassword;
    const newPassword = dto?.newPassword;

    // Validate request
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      currentPassword.length === 0 ||
      newPassword.length === 0
    ) {
      throw new Error("Invalid password change request");
    }

    // Validate new password
    if (newPassword.length < 12) {
      throw new Error(
        "New password must contain at least 12 characters"
      );
    }

    if (currentPassword === newPassword) {
      throw new Error(
        "New password must be different from current password"
      );
    }

    // Get current user
    const user = await this.userRepository.getUserById(userId);

    if (!user || !user.isActive) {
      throw new Error("User account not found or inactive");
    }

    // Verify current password
    const isCurrentPasswordValid =
      await this.passwordHasher.verifyPassword(
        user.passwordHash,
        currentPassword
      );

    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Prevent reusing current password
    const isSameAsOldPassword =
      await this.passwordHasher.verifyPassword(
        user.passwordHash,
        newPassword
      );

    if (isSameAsOldPassword) {
      throw new Error(
        "New password must be different from current password"
      );
    }

    // Hash new password using Argon2id
    const newPasswordHash =
      await this.passwordHasher.hashPassword(newPassword);

    // Atomically update password and revoke old tokens
    const updated = await this.userRepository.changePassword(
      userId,
      user.passwordHash,
      newPasswordHash
    );

    if (!updated) {
      throw new Error(
        "Password change failed. Please try again."
      );
    }
  }
}
