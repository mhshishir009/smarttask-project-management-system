import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../frontend/node_modules/react-dom/server.node.js";
import TaskPriorityChart from "../../../frontend/src/components/TaskPriorityChart";

describe("Task priority vertical chart", () => {
  it("shows three categories with actual counts and percentages", () => {
    const html = renderToStaticMarkup(createElement(TaskPriorityChart, {high: 3, medium: 4, low: 0, loading: false}));
    expect(html).toContain("HIGH: 3 (43%)");
    expect(html).toContain("MEDIUM: 4 (57%)");
    expect(html).toContain("LOW: 0 (0%)");
    expect(html.match(/<rect /g)).toHaveLength(3);
  });

  it("shows an empty state without invalid geometry", () => {
    const html = renderToStaticMarkup(createElement(TaskPriorityChart, {high: 0, medium: 0, low: 0, loading: false}));
    expect(html).toContain("No tasks yet");
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html.match(/height="0"/g)).toHaveLength(3);
  });

  it("keeps zero categories at zero height while one category fills the count scale", () => {
    const html = renderToStaticMarkup(createElement(TaskPriorityChart, {high: 0, medium: 4, low: 0, loading: false}));
    expect(html).toContain("MEDIUM: 4 (100%)");
    expect(html).toContain('height="192"');
    expect(html.match(/height="0"/g)).toHaveLength(2);
  });

  it("does not display stale bars while loading", () => {
    const html = renderToStaticMarkup(createElement(TaskPriorityChart, {high: 3, medium: 4, low: 0, loading: true}));
    expect(html).toContain("Loading task priority distribution");
    expect(html.match(/height="0"/g)).toHaveLength(3);
  });
});
