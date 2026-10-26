
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";
import axios from "axios";

import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock3,
  ArrowRight,
  Activity,
  ClipboardList,
  Plus,
  Users,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  BarChart3,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import TaskAnalytics from "../components/TaskAnalytics";

// ==========================================
// TYPES
// ==========================================

interface Project {
  projectId: number;
  name: string;
  description?: string | null;
  isArchived: boolean;
}

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE";

interface Task {
  taskId: number;
  projectId: number;
  assigneeId?: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  updatedAt?: string;
  createdAt?: string;
  dueAt?: string | null;
}

interface SystemUser {
  userId: number;
  isActive: boolean;
}

// ==========================================
// HELPERS
// ==========================================

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === "string") {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load dashboard data.";
}

function getArray<T>(
  response: { data?: { data?: unknown } },
  name: string
): T[] {
  const result = response.data?.data;

  if (!Array.isArray(result)) {
    throw new Error(
      `Unexpected ${name} API response.`
    );
  }

  return result as T[];
}

function formatDate(date?: string | null): string {
  if (!date) return "Not set";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "Not set";
  }

  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTaskStatusLabel(status: string) {
  if (status === "IN_PROGRESS") {
    return "In Progress";
  }

  if (status === "DONE") {
    return "Completed";
  }

  return "To Do";
}

function getTaskStatusStyle(status: string) {
  if (status === "DONE") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-600";
}

// ==========================================
// MAIN DASHBOARD
// ==========================================

export default function DashboardPage() {
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [users, setUsers] =
    useState<SystemUser[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");
  // Snapshot the clock in state so overdue calculations stay pure during rendering.
  const [dashboardNow, setDashboardNow] = useState(() => Date.now());

  // ==========================================
  // LOAD DASHBOARD DATA
  // ==========================================

  const fetchDashboard = useCallback(() => {
    // Keep the existing role-specific requests; commit results only in async callbacks.
    const request = isAdmin
      ? Promise.all([api.get("/projects"), api.get("/tasks"), api.get("/users")])
          .then(([projectsResponse, tasksResponse, usersResponse]) => ({
            projects: getArray<Project>(projectsResponse, "projects"),
            tasks: getArray<Task>(tasksResponse, "tasks"),
            users: getArray<SystemUser>(usersResponse, "users"),
          }))
      : api.get("/projects").then((projectsResponse) => {
          const projectList = getArray<Project>(projectsResponse, "projects");
          return Promise.all(projectList.map((project) =>
            api.get(`/tasks/project/${project.projectId}`)
          )).then((responses) => ({
            projects: projectList,
            tasks: responses.flatMap((response) => getArray<Task>(response, "project tasks"))
              .filter((task) => task.assigneeId === user?.userId),
            users: [] as SystemUser[],
          }));
        });
    return request.then((data) => {
      setProjects(data.projects);
      setTasks(data.tasks);
      setUsers(data.users);
    }).catch((err: unknown) => {
      setError(getErrorMessage(err));
      setProjects([]);
      setTasks([]);
      setUsers([]);
    }).finally(() => {
      // Take a new clock snapshot after loading, outside render.
      setDashboardNow(Date.now());
      setLoading(false);
    });
  }, [isAdmin, user?.userId]);

  // Loading state is initialized on mount and reset only by explicit refresh actions.
  const loadDashboard = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // ==========================================
  // CALCULATE STATISTICS
  // ==========================================

  const totalProjects = projects.length;

  const activeProjects = projects.filter(
    (project) => !project.isArchived
  ).length;

  const totalTasks = tasks.length;

  const todoTasks = tasks.filter(
    (task) => task.status === "TODO"
  ).length;

  const inProgressTasks = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  // Pending includes both tasks waiting to start and tasks currently in progress.
  const pendingTasks = todoTasks + inProgressTasks;

  const completedTasks = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  // Compare full timestamps against the last load; completed or undated tasks are not overdue.
  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "DONE" &&
      task.dueAt &&
      new Date(task.dueAt).getTime() < dashboardNow
  ).length;

  const activeUsers = users.filter(
    (account) => account.isActive === true
  ).length;

  const completionRate =
    totalTasks > 0
      ? Math.round(
          (completedTasks / totalTasks) * 100
        )
      : 0;

  // ==========================================
  // DASHBOARD CARDS
  // ==========================================

  const stats = [
    {
      title: "Total Projects",
      value: totalProjects,
      subtitle: `${activeProjects} active projects`,
      icon: FolderKanban,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: isAdmin
        ? "Total Tasks"
        : "My Tasks",
      value: totalTasks,
      subtitle: isAdmin
        ? "Tasks across all projects"
        : "Tasks assigned to you",
      icon: ListTodo,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "In Progress",
      value: inProgressTasks,
      subtitle: "Currently active tasks",
      icon: Clock3,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Completed Tasks",
      value: completedTasks,
      subtitle: "Successfully finished",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    // Reuse the existing statistics card renderer without changing its styling or grid.
    {
      title: "Overdue Tasks",
      value: overdueTasks,
      subtitle: "Past deadline and not completed",
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  // ==========================================
  // PROJECT SUMMARY
  // ==========================================

  const projectSummary = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter(
        (task) =>
          task.projectId === project.projectId
      );

      const completed = projectTasks.filter(
        (task) => task.status === "DONE"
      ).length;

      const progress =
        projectTasks.length > 0
          ? Math.round(
              (completed / projectTasks.length) *
                100
            )
          : 0;

      return {
        ...project,
        totalTasks: projectTasks.length,
        completed,
        progress,
      };
    });
  }, [projects, tasks]);

  // ==========================================
  // RECENT TASKS
  // ==========================================

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const dateA = new Date(
          a.updatedAt ??
            a.createdAt ??
            0
        ).getTime();

        const dateB = new Date(
          b.updatedAt ??
            b.createdAt ??
            0
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tasks]);

  const taskPage = isAdmin
    ? "/tasks"
    : "/my-tasks";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isAdmin
              ? "Admin Dashboard"
              : "My Dashboard"}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? "Monitor projects, tasks and team performance."
              : "Track your assigned tasks and project progress."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              void loadDashboard()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                loading ? "animate-spin" : ""
              }
            />
            Refresh
          </button>

          <Link
            to={
              isAdmin
                ? "/projects"
                : "/my-tasks"
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isAdmin ? (
              <Plus size={18} />
            ) : (
              <ListTodo size={18} />
            )}

            {isAdmin
              ? "Manage Projects"
              : "View My Tasks"}
          </Link>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={19}
            className="shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {/* STATISTICS CARDS */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {stat.title}
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-slate-900">
                    {loading
                      ? "—"
                      : stat.value}
                  </h2>
                </div>

                <div
                  className={`rounded-xl p-3 ${stat.bg} ${stat.color}`}
                >
                  <Icon size={22} />
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                {stat.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* ADDITIONAL METRICS */}
      <div
        className={`grid gap-5 ${
          isAdmin
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2"
        }`}
      >
        {/* COMPLETION RATE */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Task Completion Rate
            </span>

            <BarChart3
              size={20}
              className="text-blue-600"
            />
          </div>

          <p className="mt-3 text-2xl font-bold text-slate-900">
            {loading
              ? "—"
              : `${completionRate}%`}
          </p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${completionRate}%`,
              }}
            />
          </div>
        </div>

        {/* PENDING TASKS */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Pending Tasks
            </span>

            <ClipboardList
              size={20}
              className="text-amber-600"
            />
          </div>

          <p className="mt-3 text-2xl font-bold text-slate-900">
            {loading ? "—" : pendingTasks}
          </p>

          <p className="mt-3 text-xs text-slate-400">
            To Do and In Progress tasks
          </p>
        </div>

        {/* ACTIVE USERS — ADMIN ONLY */}
        {isAdmin && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Active Users
              </span>

              <Users
                size={20}
                className="text-emerald-600"
              />
            </div>

            <p className="mt-3 text-2xl font-bold text-slate-900">
              {loading ? "—" : activeUsers}
            </p>

            <p className="mt-3 text-xs text-slate-400">
              Active registered accounts
            </p>
          </div>
        )}
      </div>


      
{/* STATUS AND PRIORITY ANALYTICS */}
{isAdmin && (
  <TaskAnalytics
    todo={todoTasks}
    inProgress={inProgressTasks}
    completed={completedTasks}
    high={tasks.filter(task => task.priority === "HIGH").length}
    medium={tasks.filter(task => task.priority === "MEDIUM").length}
    low={tasks.filter(task => task.priority === "LOW").length}
    loading={loading}
  />
)}

{/* PROJECT PERFORMANCE ANALYTICS */}
{isAdmin && (
  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div className="flex items-center gap-3">
        <FolderKanban
          size={22}
          className="text-blue-600"
        />

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Project Performance Analytics
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Task completion progress across projects
          </p>
        </div>
      </div>

      <Link
        to="/projects"
        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        All Projects
        <ArrowRight size={16} />
      </Link>
    </div>

    <div className="space-y-6 p-6">
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Loading project performance...
        </p>
      ) : projectSummary.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No projects available.
        </p>
      ) : (
        [...projectSummary]
          .sort((a, b) => b.progress - a.progress)
          .map((project) => (
            <div key={project.projectId}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {project.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {project.completed} of {project.totalTasks} tasks completed
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {project.isArchived && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                      Archived
                    </span>
                  )}

                  <span className="text-sm font-bold text-blue-600">
                    {project.progress}%
                  </span>
                </div>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    project.progress === 100
                      ? "bg-emerald-500"
                      : "bg-blue-600"
                  }`}
                  style={{
                    width: `${project.progress}%`,
                  }}
                />
              </div>
            </div>
          ))
      )}
    </div>
  </section>
)}




      {/* PROJECTS + QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* PROJECT OVERVIEW */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Project Overview
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {isAdmin
                  ? "Progress across all projects"
                  : "Progress based on your assigned tasks"}
              </p>
            </div>

            <Link
              to="/projects"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All
              <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading project overview...
            </div>
          ) : projectSummary.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
              <FolderKanban
                size={34}
                className="text-slate-400"
              />

              <p className="mt-4 text-sm font-medium text-slate-700">
                No projects available
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projectSummary
                .slice(0, 5)
                .map((project) => (
                  <div
                    key={project.projectId}
                    className="p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {project.name}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {project.completed} of{" "}
                          {project.totalTasks} tasks completed
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {project.isArchived && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                            Archived
                          </span>
                        )}

                        <span className="text-sm font-semibold text-blue-600">
                          {project.progress}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* QUICK ACTIONS */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Quick Actions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Navigate your workspace
            </p>
          </div>

          <div className="space-y-3 p-5">
            <Link
              to="/projects"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <FolderKanban
                  size={20}
                  className="text-blue-600"
                />

                <span className="text-sm font-medium text-slate-700">
                  View Projects
                </span>
              </div>

              <ArrowRight
                size={16}
                className="text-slate-400"
              />
            </Link>

            <Link
              to={taskPage}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <ClipboardList
                  size={20}
                  className="text-violet-600"
                />

                <span className="text-sm font-medium text-slate-700">
                  {isAdmin
                    ? "Manage Tasks"
                    : "My Tasks"}
                </span>
              </div>

              <ArrowRight
                size={16}
                className="text-slate-400"
              />
            </Link>

            {isAdmin && (
              <Link
                to="/users"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <Users
                    size={20}
                    className="text-emerald-600"
                  />

                  <span className="text-sm font-medium text-slate-700">
                    Team Management
                  </span>
                </div>

                <ArrowRight
                  size={16}
                  className="text-slate-400"
                />
              </Link>
            )}

            <Link
              to="/change-password"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <Activity
                  size={20}
                  className="text-slate-600"
                />

                <span className="text-sm font-medium text-slate-700">
                  Change Password
                </span>
              </div>

              <ArrowRight
                size={16}
                className="text-slate-400"
              />
            </Link>
          </div>
        </section>
      </div>

      {/* RECENT TASKS */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Tasks
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Most recently updated tasks
            </p>
          </div>

          <Link
            to={taskPage}
            className="flex items-center gap-1 text-sm font-medium text-blue-600"
          >
            View Tasks
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading recent tasks...
          </div>
        ) : recentTasks.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
            <Activity
              size={30}
              className="text-slate-400"
            />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No recent tasks
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTasks.map((task) => (
              <div
                key={task.taskId}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {task.title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      Task #{task.taskId}
                    </span>

                    <span>
                      Project #{task.projectId}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={13} />

                      {formatDate(
                        task.updatedAt ??
                          task.createdAt
                      )}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getTaskStatusStyle(
                    task.status
                  )}`}
                >
                  {getTaskStatusLabel(
                    task.status
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <p className="pb-3 text-center text-xs text-slate-400">
        Smart Task & Project Management System
      </p>
    </div>
  );
}
