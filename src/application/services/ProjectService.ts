
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { ITaskRepository } from "../../domain/repositories/ITaskRepository";

import { Project } from "../../domain/entities/Project";

import { CreateProjectDto } from "../dto/CreateProjectDto";
import { UpdateProjectDto } from "../dto/UpdateProjectDto";
import { ProjectDto } from "../dto/ProjectDto";

export class ProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly taskRepository: ITaskRepository
  ) {}

  // ==========================================
  // 1. CREATE PROJECT
  // ==========================================
  async createProject(
    dto: CreateProjectDto,
    createdBy: number
  ): Promise<ProjectDto> {
    const name =
      typeof dto?.name === "string"
        ? dto.name.trim()
        : "";

    if (!name || name.length > 200) {
      throw new Error("Invalid project name");
    }

    if (
      dto.description !== undefined &&
      dto.description !== null &&
      typeof dto.description !== "string"
    ) {
      throw new Error("Invalid project description");
    }

    if (
      !Number.isSafeInteger(createdBy) ||
      createdBy <= 0
    ) {
      throw new Error("Invalid project creator");
    }

    const creator =
      await this.userRepository.getUserById(
        createdBy
      );

    if (!creator || !creator.isActive) {
      throw new Error(
        "Project creator not found or inactive"
      );
    }

    const project =
      await this.projectRepository.createProject({
        name,
        description: dto.description?.trim() || null,
        createdBy,
        isArchived: false,
      });

    return this.mapToDto(project);
  }

  // ==========================================
  // 2. GET ALL PROJECTS
  // ==========================================
  async getAllProjects(): Promise<ProjectDto[]> {
    const projects =
      await this.projectRepository.getAllProjects();

    return projects.map((project) =>
      this.mapToDto(project)
    );
  }

  // ==========================================
  // 3. GET PROJECT BY ID
  // ==========================================
  async getProjectById(
    projectId: number
  ): Promise<ProjectDto | null> {
    this.validateProjectId(projectId);

    const project =
      await this.projectRepository.getProjectById(
        projectId
      );

    return project
      ? this.mapToDto(project)
      : null;
  }

  // ==========================================
  // 4. UPDATE PROJECT
  // ==========================================
  async updateProject(
    projectId: number,
    dto: UpdateProjectDto
  ): Promise<ProjectDto | null> {
    this.validateProjectId(projectId);

    const name =
      typeof dto?.name === "string"
        ? dto.name.trim()
        : "";

    if (!name || name.length > 200) {
      throw new Error("Invalid project name");
    }

    if (
      dto.description !== null &&
      typeof dto.description !== "string"
    ) {
      throw new Error("Invalid project description");
    }

    const existingProject =
      await this.projectRepository.getProjectById(
        projectId
      );

    if (!existingProject) {
      return null;
    }

    if (existingProject.isArchived) {
      throw new Error(
        "Archived project cannot be updated"
      );
    }

    const updatedProject =
      await this.projectRepository.updateProject(
        projectId,
        {
          name,
          description:
            dto.description?.trim() || null,
        }
      );

    if (!updatedProject) {
      throw new Error(
        "Project update failed or project was archived"
      );
    }

    return this.mapToDto(updatedProject);
  }

  // ==========================================
  // 5. ARCHIVE PROJECT
  // ==========================================
  async archiveProject(
    projectId: number,
    actorId?: number
  ): Promise<boolean> {
    this.validateProjectId(projectId);

    // Check if project exists
    const existingProject =
      await this.projectRepository.getProjectById(
        projectId
      );

    if (!existingProject) {
      return false;
    }

    // Prevent duplicate archiving
    if (existingProject.isArchived) {
      throw new Error(
        "Project is already archived"
      );
    }

    // ========================================
    // NEW: CHECK PROJECT TASKS
    // ========================================
    const projectTasks =
      await this.taskRepository.getTasksByProjectId(
        projectId
      );

    // TODO and IN_PROGRESS tasks must
    // be completed before archiving.
    const hasIncompleteTasks = projectTasks.some(
      (task) => task.status !== "DONE"
    );

    if (hasIncompleteTasks) {
      throw new Error(
        "Cannot archive project with incomplete tasks"
      );
    }

    // ========================================
    // ARCHIVE PROJECT
    // ========================================
    const archived =
      await this.projectRepository.archiveProject(
        projectId, ...(actorId === undefined ? [] : [actorId])
      );

    if (!archived) {
      throw new Error(
        "Project archive failed or project was already archived"
      );
    }

    return true;
  }

  // ==========================================
  // DELETE PROJECT
  // ==========================================
  async deleteProject(projectId: number): Promise<boolean> {
    this.validateProjectId(projectId);
    // The repository performs the task check and deletion in one locked transaction.
    return this.projectRepository.deleteProject(projectId);
  }

  // ==========================================
  // 6. PROJECT ID VALIDATION
  // ==========================================
  private validateProjectId(
    projectId: number
  ): void {
    if (
      !Number.isSafeInteger(projectId) ||
      projectId <= 0
    ) {
      throw new Error(
        "Invalid project ID"
      );
    }
  }

  // ==========================================
  // 7. MAP DOMAIN ENTITY TO RESPONSE DTO
  // ==========================================
  private mapToDto(
    project: Project
  ): ProjectDto {
    return {
      projectId: project.projectId,
      name: project.name,
      description: project.description,
      createdBy: project.createdBy,
      isArchived: project.isArchived,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
