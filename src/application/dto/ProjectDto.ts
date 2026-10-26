
export interface ProjectDto {
  projectId: number;
  name: string;
  description: string | null;
  createdBy: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
