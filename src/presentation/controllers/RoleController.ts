
import { Request, Response, NextFunction } from "express";
import { RoleService } from "../../application/services/RoleService";
import { toRoleViewModel } from "../viewmodels/RoleViewModel";

export class RoleController {
  constructor(
    private readonly roleService: RoleService
  ) {}

  getAllRoles = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const roles = await this.roleService.getAllRoles();

      res.status(200).json({
        success: true,
        data: roles.map(toRoleViewModel),
      });
    } catch (error) {
      next(error);
    }
  };

  getRoleById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const rawId = req.params.id;
      const roleId = Number(rawId);

      if (
        typeof rawId !== "string" ||
        !/^[0-9]+$/.test(rawId) ||
        !Number.isSafeInteger(roleId) ||
        roleId <= 0
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid role ID",
        });
        return;
      }

      const role = await this.roleService.getRoleById(roleId);

      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: toRoleViewModel(role),
      });
    } catch (error) {
      next(error);
    }
  };

  getRoleByCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const roleCode = req.params.code;

      if (
        roleCode !== "ADMIN" &&
        roleCode !== "TEAM_MEMBER"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid role code",
        });
        return;
      }

      const role = await this.roleService.getRoleByCode(roleCode);

      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: toRoleViewModel(role),
      });
    } catch (error) {
      next(error);
    }
  };
}
