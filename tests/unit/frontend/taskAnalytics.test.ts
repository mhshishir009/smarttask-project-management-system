import { describe, expect, it } from "vitest";
import { createElement } from "../../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../../frontend/node_modules/react-dom/server.node.js";
import TaskAnalytics from "../../../frontend/src/components/TaskAnalytics";

describe("Paired task analytics", () => {
  const data = {todo: 3, inProgress: 1, completed: 3, high: 3, medium: 4, low: 0, loading: false};

  it("retains status completion and priority totals in the compact layout", () => {
    const html = renderToStaticMarkup(createElement(TaskAnalytics, data));
    expect(html).toContain("Task Status Analytics");
    expect(html).toContain("Task Priority Distribution");
    expect(html).toContain("3 of 7 tasks completed");
    expect(html).toContain("43%");
    expect(html).toContain("Total tasks");
    expect(html).toContain("Task status legend");
  });

  it("keeps loading and empty data honest in both cards", () => {
    const loading = renderToStaticMarkup(createElement(TaskAnalytics, {...data, loading: true}));
    expect(loading).not.toContain("43%");
    expect(loading).not.toContain("3 of 7 tasks completed");
    const empty = renderToStaticMarkup(createElement(TaskAnalytics, {todo: 0, inProgress: 0, completed: 0, high: 0, medium: 0, low: 0, loading: false}));
    expect(empty).toContain("0 of 0 tasks completed");
    expect(empty).not.toMatch(/NaN|Infinity/);
  });
});
