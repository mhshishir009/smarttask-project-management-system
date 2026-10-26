export interface DiscussionActor {
  userId: number;
  role: "ADMIN" | "TEAM_MEMBER";
}

export interface ProjectMessage {
  messageId: number;
  projectId: number;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface DiscussionPage {
  messages: ProjectMessage[];
  nextBefore: number | null;
  isArchived: boolean;
}

export class DiscussionError extends Error {
  constructor(message: string, public readonly code: "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "ARCHIVED") {
    super(message);
  }
}
