
import { Repository } from "typeorm";

import { AppDataSource } from "../database/data-source";
import { ProjectOrmEntity } from "../database/entities/ProjectOrmEntity";

import { Project } from "../../domain/entities/Project";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { NotificationWriter } from "./NotificationWriter";

export class ProjectRepository implements IProjectRepository {
  private readonly repository: Repository<ProjectOrmEntity>;

  constructor(private readonly notifications?: NotificationWriter) {
    this.repository = AppDataSource.getRepository(ProjectOrmEntity);
  }

  // ==========================================
  // 1. CREATE PROJECT
  // ==========================================
  async createProject(
    project: Omit<
      Project,
      "projectId" | "createdAt" | "updatedAt"
    >
  ): Promise<Project> {
    if (this.notifications) {
      return AppDataSource.transaction(async manager => {
        const repository = manager.getRepository(ProjectOrmEntity);
        const saved = await repository.save(repository.create({...project}));
        await this.notifications!.record(manager, {kind: "PROJECT_CREATED", key: `project:${saved.projectId}:created`, actorId: project.createdBy, projectId: Number(saved.projectId)});
        return this.mapToDomain(saved);
      });
    }
    const newProject = this.repository.create({
      name: project.name,
      description: project.description,
      createdBy: project.createdBy,
      isArchived: project.isArchived,
    });

    const savedProject = await this.repository.save(
      newProject
    );

    return this.mapToDomain(savedProject);
  }

  // ==========================================
  // 2. GET ALL PROJECTS
  // ==========================================
  async getAllProjects(): Promise<Project[]> {
    const projects = await this.repository.find({
      order: {
        projectId: "ASC",
      },
    });

    return projects.map((project) =>
      this.mapToDomain(project)
    );
  }

  // ==========================================
  // 3. GET PROJECT BY ID
  // ==========================================
  async getProjectById(
    projectId: number
  ): Promise<Project | null> {
    const project = await this.repository.findOneBy({
      projectId,
    });

    return project ? this.mapToDomain(project) : null;
  }

  // ==========================================
  // 4. UPDATE PROJECT
  // ==========================================
  async updateProject(
    projectId: number,
    project: Pick<Project, "name" | "description">
  ): Promise<Project | null> {
    return AppDataSource.transaction(async (manager) => {
      // Lock active project row.
      const rows: Array<{ id: string }> =
        await manager.query(
          `
          SELECT id
          FROM projects
          WHERE id = $1
            AND is_archived = FALSE
          FOR UPDATE
          `,
          [projectId]
        );

      if (rows.length === 0) {
        return null;
      }

      const repository =
        manager.getRepository(ProjectOrmEntity);

      const result = await repository.update(
        {
          projectId,
          isArchived: false,
        },
        {
          name: project.name,
          description: project.description,
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      const updated = await repository.findOneBy({
        projectId,
      });

      return updated ? this.mapToDomain(updated) : null;
    });
  }

  // ==========================================
  // 5. ARCHIVE PROJECT
  // ==========================================
  async archiveProject(
    projectId: number,
    actorId?: number
  ): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      // Lock the project row.
      // TaskRepository locks the same parent row
      // before task creation or modification.
      const rows: Array<{ id: string }> =
        await manager.query(
          `
          SELECT id
          FROM projects
          WHERE id = $1
            AND is_archived = FALSE
          FOR UPDATE
          `,
          [projectId]
        );

      if (rows.length === 0) {
        return false;
      }

      // Recheck after acquiring the parent lock, inside the same transaction as archiving.
      // TaskRepository takes this lock before task creation or status changes, so tasks
      // committed while this request was waiting cannot bypass the service's earlier check.
      const incompleteTasks: Array<{ id: string }> = await manager.query(
        "SELECT id FROM tasks WHERE project_id = $1 AND status <> $2 LIMIT 1",
        [projectId, "DONE"]
      );
      if (incompleteTasks.length > 0) {
        throw new Error("Cannot archive project with incomplete tasks");
      }

      const repository =
        manager.getRepository(ProjectOrmEntity);

      const result = await repository.update(
        {
          projectId,
          isArchived: false,
        },
        {
          isArchived: true,
        }
      );

      if (result.affected === 1 && this.notifications) {
        await this.notifications.record(manager, {kind: "PROJECT_ARCHIVED", key: `project:${projectId}:archived`, actorId: actorId!, projectId});
      }
      return result.affected === 1;
    });
  }

  // ==========================================
  // DELETE PROJECT
  // ==========================================
  async deleteProject(projectId: number): Promise<boolean> {
    try {
      return await AppDataSource.transaction(async (manager) => {
        // Match TaskRepository's parent lock so task creation cannot race with deletion.
        const projects: Array<{ id: string }> = await manager.query(
          "SELECT id FROM projects WHERE id = $1 FOR UPDATE",
          [projectId]
        );
        if (projects.length === 0) {
          return false;
        }

        // Preserve every existing task, including completed tasks and archived project history.
        const tasks: Array<{ id: string }> = await manager.query(
          "SELECT id FROM tasks WHERE project_id = $1 LIMIT 1",
          [projectId]
        );
        if (tasks.length > 0) {
          throw new Error("Cannot delete project with tasks");
        }

        const result = await manager.getRepository(ProjectOrmEntity).delete({ projectId });
        return result.affected === 1;
      });
    } catch (error) {
      // Retain the database foreign key as a final safeguard against dependent tasks.
      const databaseError = error as {
        code?: string; constraint?: string;
        driverError?: { code?: string; constraint?: string };
      } | null;
      const details = databaseError?.driverError ?? databaseError;
      if (details?.code === "23503" && details.constraint === "fk_project_messages_project") {
        throw new Error("Cannot delete project with discussion messages");
      }
      if (details?.code === "23503" && details.constraint === "fk_tasks_project") {
        throw new Error("Cannot delete project with tasks");
      }
      throw error;
    }
  }

  // ==========================================
  // MAP ORM ENTITY TO DOMAIN ENTITY
  // ==========================================
  private mapToDomain(
    project: ProjectOrmEntity
  ): Project {
    const projectId = Number(project.projectId);
    const createdBy = Number(project.createdBy);

    if (
      !Number.isSafeInteger(projectId) ||
      projectId <= 0 ||
      !Number.isSafeInteger(createdBy) ||
      createdBy <= 0
    ) {
      throw new Error(
        "Project numeric value is out of range"
      );
    }

    return {
      projectId,
      name: project.name,
      description: project.description,
      createdBy,
      isArchived: project.isArchived,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
