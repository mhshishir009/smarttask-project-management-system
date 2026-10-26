
import { Request, Response, NextFunction } from "express";
import { UserService } from "../../application/services/UserService";

export class UserController {
  constructor(
    private readonly userService: UserService
  ) {}

  // ==========================================
  // 1. CREATE USER
  // ==========================================
  createUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        fullName,
        email,
        roleId,
        temporaryPassword,
      } = req.body ?? {};

      if (
        typeof fullName !== "string" ||
        typeof email !== "string" ||
        typeof roleId !== "number" ||
        typeof temporaryPassword !== "string"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid user information",
        });
        return;
      }

      const user = await this.userService.createUser({
        fullName,
        email,
        roleId,
        temporaryPassword,
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Email already exists") {
          res.status(409).json({
            success: false,
            message: error.message,
          });
          return;
        }

        if (error.message === "Role not found") {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }

        if (
          [
            "Required fields are missing",
            "Name or email exceeds allowed length",
            "Invalid email address",
            "Temporary password must have at least 12 characters",
            "Invalid role ID",
          ].includes(error.message)
        ) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }

      next(error);
    }
  };

  // ==========================================
  // 2. GET ALL USERS
  // ==========================================
  getAllUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers();

      res.status(200).json({
        success: true,
        message: "Users retrieved successfully",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 3. GET USER BY ID
  // ==========================================
  getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.parseUserId(req.params.id);

      if (userId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
        return;
      }

      const user = await this.userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "User retrieved successfully",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 4. UPDATE USER
  // ==========================================
  updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.parseUserId(req.params.id);

      if (userId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
        return;
      }

      const body = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid request body",
        });
        return;
      }

      const { fullName, email } = body;

      if (
        (fullName !== undefined &&
          typeof fullName !== "string") ||
        (email !== undefined &&
          typeof email !== "string") ||
        (fullName === undefined &&
          email === undefined)
      ) {
        res.status(400).json({
          success: false,
          message: "Provide a valid fullName or email",
        });
        return;
      }

      const user = await this.userService.updateUser(
        userId,
        { fullName, email }
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Email already exists") {
          res.status(409).json({
            success: false,
            message: error.message,
          });
          return;
        }

        if (
          [
            "Invalid user ID",
            "Invalid full name",
            "Invalid email address",
            "No valid fields provided for update",
          ].includes(error.message)
        ) {
          res.status(400).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }

      next(error);
    }
  };

  // ==========================================
  // 5. DEACTIVATE USER
  // ==========================================
  deactivateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = this.parseUserId(req.params.id);

      if (userId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
        return;
      }

      const deactivated =
        await this.userService.deactivateUser(userId);

      if (!deactivated) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "User deactivated successfully",
      });
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message === "System admin cannot be deactivated" ||
          error.message ===
            "Cannot deactivate the last active admin"
        ) {
          res.status(403).json({
            success: false,
            message: error.message,
          });
          return;
        }
      }

      next(error);
    }
  };

  // ==========================================
  // USER ID VALIDATION
  // ==========================================
  private parseUserId(
    value: string | string[] | undefined
  ): number | null {
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*$/.test(value)
    ) {
      return null;
    }

    const userId = Number(value);

    return Number.isSafeInteger(userId)
      ? userId
      : null;
  }
}
