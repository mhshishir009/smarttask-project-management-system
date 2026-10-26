
import { Project } from "../entities/Project";

export interface IProjectRepository {

  // Create a new project
  createProject(
    project: Omit<
      Project,
      "projectId" | "createdAt" | "updatedAt"
    >
  ): Promise<Project>;

  // Get all projects
  getAllProjects(): Promise<Project[]>;

  // Get project by ID
  getProjectById(
    projectId: number
  ): Promise<Project | null>;

  // Update project information
  updateProject(
    projectId: number,
    project: Pick<Project, "name" | "description">
  ): Promise<Project | null>;

  // Archive a project
  archiveProject(
    projectId: number,
    actorId?: number
  ): Promise<boolean>;

  // Delete only projects without tasks; the repository checks this atomically.
  deleteProject(projectId: number): Promise<boolean>;
}
