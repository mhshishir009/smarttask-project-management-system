import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../frontend/node_modules/react-dom/server.node.js";
import TaskStatusPieChart from "../../../frontend/src/components/TaskStatusPieChart";

describe("Task status pie chart", () => {
  it("renders the actual distribution and all status labels accessibly", () => {
    const html = renderToStaticMarkup(createElement(TaskStatusPieChart, {todo: 3, inProgress: 1, completed: 3, loading: false}));
    expect(html).toContain("conic-gradient(");
    expect(html).toContain("To Do: 3 (43%)");
    expect(html).toContain("In Progress: 1 (14%)");
    expect(html).toContain("Completed: 3 (43%)");
    expect(html).toContain("Task status legend");
  });

  it("shows an empty state instead of invalid percentages for zero tasks", () => {
    const html = renderToStaticMarkup(createElement(TaskStatusPieChart, {todo: 0, inProgress: 0, completed: 0, loading: false}));
    expect(html).toContain("No tasks yet");
    expect(html).not.toContain("conic-gradient(");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("supports a full circle when every task has one status", () => {
    const html = renderToStaticMarkup(createElement(TaskStatusPieChart, {todo: 0, inProgress: 0, completed: 4, loading: false}));
    expect(html).toContain("Completed: 4 (100%)");
    expect(html).toContain("0% 100%");
  });

  it("does not display old data as a completed chart while loading", () => {
    const html = renderToStaticMarkup(createElement(TaskStatusPieChart, {todo: 3, inProgress: 1, completed: 3, loading: true}));
    expect(html).toContain("Loading task status distribution");
    expect(html).not.toContain("conic-gradient(");
  });
});
