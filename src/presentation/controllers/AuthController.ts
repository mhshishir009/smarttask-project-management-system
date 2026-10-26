
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../application/services/AuthService";

export class AuthController {
  constructor(
    private readonly authService: AuthService
  ) {}

  // Accept only signup fields; never forward client-supplied roles or account flags.
  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { fullName, email, password } = req.body ?? {};
      const user = await this.authService.register({ fullName, email, password });
      res.status(201).json({
        success: true,
        message: "Registration successful. Please login.",
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Email already exists") {
          res.status(409).json({ success: false, message: error.message });
          return;
        }
        if ([
          "Full name, email and password are required",
          "Name or email exceeds allowed length",
          "Invalid email address",
          "Password must contain at least 12 characters",
        ].includes(error.message)) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
        if (error.message === "Registration is unavailable. Team member role is not configured") {
          res.status(503).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  };

  // ==========================================
  // USER LOGIN
  // ==========================================
  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};

      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
      ) {
        res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
        return;
      }

      const result = await this.authService.login({
        email,
        password,
      });

      res.status(200).json({
        success: true,
        message: result.mustChangePassword
          ? "Login successful. Password change required."
          : "Login successful",
        data: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (
          error.message === "Invalid email or password" ||
          error.message === "Account is inactive"
        )
      ) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
        return;
      }

      next(error);
    }
  };

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================
  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Authentication Middleware must run first
      const authUser = res.locals.authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { currentPassword, newPassword } =
        req.body ?? {};

      // Validate request
      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        res.status(400).json({
          success: false,
          message: "Current and new passwords are required",
        });
        return;
      }

      if (newPassword.length < 12) {
        res.status(400).json({
          success: false,
          message:
            "New password must contain at least 12 characters",
        });
        return;
      }

      if (currentPassword === newPassword) {
        res.status(400).json({
          success: false,
          message:
            "New password must be different from current password",
        });
        return;
      }

      // Call Application Service
      await this.authService.changePassword(
        authUser.userId,
        {
          currentPassword,
          newPassword,
        }
      );

      res.status(200).json({
        success: true,
        message:
          "Password changed successfully. Please login again.",
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Current password is incorrect") {
          res.status(400).json({
            success: false,
            message: "Current password is incorrect",
          });
          return;
        }

        if (
          error.message === "Invalid password change request" ||
          error.message ===
            "New password must contain at least 12 characters" ||
          error.message ===
            "New password must be different from current password"
        ) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }

        if (
          error.message === "User account not found or inactive" ||
          error.message ===
            "Password change failed. Please try again."
        ) {
          res.status(401).json({
            success: false,
            message: "Authentication failed. Please login again.",
          });
          return;
        }
      }

      next(error);
    }
  };
}
