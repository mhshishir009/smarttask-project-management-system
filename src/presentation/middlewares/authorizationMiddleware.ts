import { Request, Response, NextFunction } from "express";

// Fixed Role IDs from Database
export const ROLES = {
  ADMIN: 1,
  TEAM_MEMBER: 2,
} as const;

type RoleCode = keyof typeof ROLES;

// ==========================================
// Role-Based Authorization
// ==========================================
export function requireRole(...allowedRoles: RoleCode[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const authUser = res.locals.authUser;

    // Authentication must run first
    if (!authUser) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const allowedRoleIds = allowedRoles.map(
      (role) => ROLES[role]
    );

    if (!allowedRoleIds.includes(authUser.roleId)) {
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions",
      });
      return;
    }

    next();
  };
}

// ==========================================
// Mandatory Password Change Restriction
// ==========================================
export function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authUser = res.locals.authUser;

  if (!authUser) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (authUser.mustChangePassword) {
    res.status(403).json({
      success: false,
      message: "Password change required before accessing this resource",
    });
    return;
  }

  next();
}
