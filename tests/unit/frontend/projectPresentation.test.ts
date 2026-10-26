import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../frontend/node_modules/react-dom/server.node.js";
import { getProjectTaskSummary, type ProjectOverviewTask } from "../../../frontend/src/services/projectPresentation";
import ProjectCard from "../../../frontend/src/components/ProjectCard";

describe("Project card presentation", () => {
  const task = (changes: Partial<ProjectOverviewTask> = {}): ProjectOverviewTask => ({
    projectId: 6, assigneeId: 2, status: "TODO", priority: "MEDIUM", dueAt: null, ...changes,
  });

  it("derives progress, highest priority and unique assignees from only the project's tasks", () => {
    const summary = getProjectTaskSummary(6, [task({status: "DONE"}), task({assigneeId: 3, priority: "HIGH", status: "IN_PROGRESS"}), task({projectId: 7})]);
    expect(summary).toMatchObject({total: 2, completed: 1, progress: 50, assignees: 2, priority: "HIGH", status: "In progress"});
  });

  it("uses the earliest valid unfinished task deadline, not completed or fabricated dates", () => {
    const summary = getProjectTaskSummary(6, [task({dueAt: "2026-11-03T12:00:00Z"}),
      task({dueAt: "2026-11-01T12:00:00Z"}), task({dueAt: "2026-10-01T12:00:00Z", status: "DONE"}), task({dueAt: "invalid"})]);
    expect(summary.nextDue).toBe("2026-11-01T12:00:00Z");
  });

  it("handles an empty project without inventing priorities, assignees or progress", () => {
    expect(getProjectTaskSummary(6, [])).toMatchObject({total: 0, progress: 0, assignees: 0, priority: null, nextDue: null, status: "Not started"});
  });

  it("marks a project completed only when every task is complete", () => {
    expect(getProjectTaskSummary(6, [task({status: "DONE"})])).toMatchObject({progress: 100, status: "Completed", nextDue: null});
  });

  const base = {project: {projectId: 6, name: "Real project", description: "Project description"},
    busy: false, onEdit: () => {}, onArchive: () => {}, onDelete: () => {}};

  it("keeps administrator actions and the true task metrics available", () => {
    const html = renderToStaticMarkup(createElement(ProjectCard, {...base, isAdmin: true,
      summary: getProjectTaskSummary(6, [task({status: "DONE"}), task()])}));
    expect(html).toContain("50%");
    expect(html).toContain("Edit project");
    expect(html).toContain("Delete project");
    expect(html).toContain("Actions for Real project");
  });

  it("does not expose admin actions or mislabel member metrics as global project completion", () => {
    const html = renderToStaticMarkup(createElement(ProjectCard, {...base, isAdmin: false,
      summary: getProjectTaskSummary(6, [task({status: "DONE"})])}));
    expect(html).not.toContain("Delete project");
    expect(html).not.toContain("Edit project");
    expect(html).toContain("Your task progress");
    expect(html).toContain("Your tasks done");
    expect(html).toContain("assigned tasks");
  });

  it("retains archived-project restrictions", () => {
    const html = renderToStaticMarkup(createElement(ProjectCard, {...base, project: {...base.project, isArchived: true}, isAdmin: true, summary: null}));
    expect(html).toContain("Archived");
    expect(html).not.toContain("Edit project");
    expect(html).toContain("Delete project");
    expect(html).toContain("Task metrics unavailable");
  });

  it("shows discussion for admins and assigned members, including archived history", () => {
    const props = {...base, onDiscuss: () => {}};
    const render = (isAdmin, summary, archived = false) => renderToStaticMarkup(createElement(ProjectCard, {...props, project: {...base.project, isArchived: archived}, isAdmin, summary}));
    expect(render(true, null)).toContain(">Discussion</button>");
    expect(render(false, getProjectTaskSummary(6, [task()]))).toContain(">Discussion</button>");
    expect(render(false, getProjectTaskSummary(6, []))).not.toContain(">Discussion</button>");
    expect(render(false, null)).not.toContain(">Discussion</button>");
    expect(render(true, null, true)).toContain("View discussion");
  });
});
