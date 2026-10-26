
import {
  Request,
  Response,
  NextFunction,
} from "express";

import { ProjectService } from "../../application/services/ProjectService";

export class ProjectController {
  constructor(
    private readonly projectService: ProjectService
  ) {}

  // ==========================================
  // 1. CREATE PROJECT
  // ==========================================
  createProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authUser = res.locals.authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { name, description } = req.body ?? {};

      if (
        typeof name !== "string" ||
        (
          description !== undefined &&
          description !== null &&
          typeof description !== "string"
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid project information",
        });
        return;
      }

      const project =
        await this.projectService.createProject(
          { name, description },
          authUser.userId
        );

      res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: project,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 2. GET ALL PROJECTS
  // ==========================================
  getAllProjects = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projects =
        await this.projectService.getAllProjects();

      res.status(200).json({
        success: true,
        message: "Projects retrieved successfully",
        data: projects,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 3. GET PROJECT BY ID
  // ==========================================
  getProjectById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projectId = this.parseProjectId(
        req.params.id
      );

      if (projectId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
        return;
      }

      const project =
        await this.projectService.getProjectById(
          projectId
        );

      if (!project) {
        res.status(404).json({
          success: false,
          message: "Project not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Project retrieved successfully",
        data: project,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // 4. UPDATE PROJECT
  // ==========================================
  updateProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projectId = this.parseProjectId(
        req.params.id
      );

      if (projectId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
        return;
      }

      const { name, description } = req.body ?? {};

      if (
        typeof name !== "string" ||
        (
          description !== null &&
          typeof description !== "string"
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid project information",
        });
        return;
      }

      const project =
        await this.projectService.updateProject(
          projectId,
          { name, description }
        );

      if (!project) {
        res.status(404).json({
          success: false,
          message: "Project not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Project updated successfully",
        data: project,
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 5. ARCHIVE PROJECT
  // ==========================================
  archiveProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projectId = this.parseProjectId(
        req.params.id
      );

      if (projectId === null) {
        res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
        return;
      }

      const archived =
        await this.projectService.archiveProject(
          projectId, res.locals?.authUser?.userId
        );

      if (!archived) {
        res.status(404).json({
          success: false,
          message: "Project not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Project archived successfully",
      });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // DELETE PROJECT
  // ==========================================
  deleteProject = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const projectId = this.parseProjectId(req.params.id);
      if (projectId === null) {
        res.status(400).json({ success: false, message: "Invalid project ID" });
        return;
      }

      // Authorization is enforced by the project route before deletion is attempted.
      const deleted = await this.projectService.deleteProject(projectId);
      if (!deleted) {
        res.status(404).json({ success: false, message: "Project not found" });
        return;
      }
      res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
      this.handleError(error, res, next);
    }
  };

  // ==========================================
  // 6. PROJECT ID VALIDATION
  // ==========================================
  private parseProjectId(
    value: string | string[] | undefined
  ): number | null {
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*$/.test(value)
    ) {
      return null;
    }

    const projectId = Number(value);

    return Number.isSafeInteger(projectId)
      ? projectId
      : null;
  }

  // ==========================================
  // 7. BUSINESS ERROR HANDLING
  // ==========================================
  private handleError(
    error: unknown,
    res: Response,
    next: NextFunction
  ): void {
    if (error instanceof Error) {
      // --------------------------------------
      // BAD REQUEST - 400
      // --------------------------------------
      const badRequestMessages = [
        "Invalid project name",
        "Invalid project description",
        "Invalid project ID",
        "Invalid project creator",
      ];

      if (
        badRequestMessages.includes(
          error.message
        )
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      // --------------------------------------
      // CONFLICT - 409
      // --------------------------------------
      const conflictMessages = [
        // Deletion preserves projects that still own tasks.
        "Cannot delete project with tasks",
        "Cannot delete project with discussion messages",
        "Archived project cannot be updated",
        "Project is already archived",
        "Project update failed or project was archived",
        "Project archive failed or project was already archived",

        // NEW ARCHIVE VALIDATION
        "Cannot archive project with incomplete tasks",
      ];

      if (
        conflictMessages.includes(
          error.message
        )
      ) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }

      // --------------------------------------
      // FORBIDDEN - 403
      // --------------------------------------
      if (
        error.message ===
        "Project creator not found or inactive"
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project creator is not authorized",
        });
        return;
      }
    }

    // ----------------------------------------
    // UNEXPECTED SERVER ERROR
    // ----------------------------------------
    next(error);
  }
}
