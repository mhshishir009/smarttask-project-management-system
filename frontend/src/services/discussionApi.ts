import api from "./api";

export interface ProjectMessage {
  messageId: number;
  projectId: number;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: string;
}
export interface DiscussionPage {
  messages: ProjectMessage[];
  nextBefore: number | null;
  isArchived: boolean;
}

export async function getDiscussion(projectId: number, signal: AbortSignal, before?: number): Promise<DiscussionPage> {
  const response = await api.get(`/projects/${projectId}/messages`, {signal, params: before === undefined ? undefined : {before}});
  return response.data.data;
}

export async function sendDiscussionMessage(projectId: number, body: string, signal: AbortSignal): Promise<ProjectMessage> {
  // The server derives author and timestamp from the authenticated session.
  const response = await api.post(`/projects/${projectId}/messages`, {body}, {signal});
  return response.data.data;
}
