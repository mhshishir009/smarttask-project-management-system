
import { Request, Response, NextFunction } from "express";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import {
  ITokenService,
  TokenPayload,
} from "../../application/interfaces/ITokenService";

export function createAuthMiddleware(
  tokenService: ITokenService,
  userRepository: IUserRepository
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // 1. Read Bearer Token
      const authorization = req.headers.authorization;

      if (!authorization) {
        res.status(401).json({
          success: false,
          message: "Authentication token required",
        });
        return;
      }

      const parts = authorization.split(" ");

      if (
        parts.length !== 2 ||
        parts[0] !== "Bearer" ||
        !parts[1]
      ) {
        res.status(401).json({
          success: false,
          message: "Invalid authorization header",
        });
        return;
      }

      // 2. Verify JWT
      let payload: TokenPayload;

      try {
        payload = tokenService.verifyToken(parts[1]);
      } catch {
        res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
        return;
      }

      // 3. Find Current User
      const user = await userRepository.getUserById(
        payload.userId
      );

      if (
        !user ||
        !user.isActive ||
        user.authVersion !== payload.authVersion ||
        user.roleId !== payload.roleId ||
        user.mustChangePassword !==
          payload.mustChangePassword
      ) {
        res.status(401).json({
          success: false,
          message: "Authentication failed",
        });
        return;
      }

      // 4. Attach Verified User Information
      res.locals.authUser = {
        userId: user.userId,
        roleId: user.roleId,
        mustChangePassword: user.mustChangePassword,
      };

      // 5. Continue to Next Middleware
      next();
    } catch (error) {
      next(error);
    }
  };
}
