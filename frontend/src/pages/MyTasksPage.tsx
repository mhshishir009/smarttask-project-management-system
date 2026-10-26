
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import WorkspaceResultNotice from "../components/layout/WorkspaceResultNotice";
import {
  ClipboardCheck,
  RefreshCw,
  Clock3,
  FolderKanban,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

interface Task {
  taskId: number;
  projectId: number;
  assigneeId: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
  version: number;
}

interface Project {
  projectId: number;
  isArchived?: boolean;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      "Unable to process your request."
    );
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function nextStatus(
  current: TaskStatus
): TaskStatus | null {
  if (current === "TODO") return "IN_PROGRESS";
  if (current === "IN_PROGRESS") return "DONE";
  return null;
}

export default function MyTasksPage() {
  const [searchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("workspaceTask");
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const visibleTasks = selectedTaskId ? tasks.filter(task => task.taskId === Number(selectedTaskId)) : tasks;
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] =
    useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchMyTasks = useCallback(() => {
    // Members continue to use project-scoped task APIs; all state updates follow the requests.
    const request = user?.role === "TEAM_MEMBER" ? api.get("/projects")
      : Promise.reject(new Error("Team member access required."));
    return request.then((projectResponse) => {
      const projects = projectResponse.data?.data;
      if (!Array.isArray(projects)) throw new Error("Unable to load projects.");
      return Promise.all((projects as Project[]).map(async (project) => {
        const response = await api.get(`/tasks/project/${project.projectId}`);
        if (!Array.isArray(response.data?.data)) throw new Error("Invalid task response.");
        return response.data.data as Task[];
      }));
    }).then((projectTasks) => {
      setTasks(projectTasks.flat().filter((task) => task.assigneeId === user?.userId));
    }).catch((err: unknown) => {
      setError(errorMessage(err));
    }).finally(() => { setLoading(false); });
  }, [user]);

  // Explicit refreshes retain loading feedback; mounting only starts the async request.
  const loadMyTasks = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchMyTasks();
  }, [fetchMyTasks]);

  useEffect(() => {
    void fetchMyTasks();
  }, [fetchMyTasks]);

  const handleChangeStatus = async (task: Task) => {
    if (updatingId !== null) return;

    const status = nextStatus(task.status);

    if (!status) return;

    setUpdatingId(task.taskId);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/tasks/${task.taskId}/status`,
        {
          expectedVersion: task.version,
          status,
        }
      );

      setSuccess(
        `Task #${task.taskId} moved to ${status.replace("_", " ")}.`
      );

      await loadMyTasks();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkspaceResultNotice field="workspaceTask" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My Assigned Tasks
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View your tasks and update their progress.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadMyTasks()}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "My Tasks",
            count: tasks.length,
          },
          {
            label: "In Progress",
            count: tasks.filter(
              (task) => task.status === "IN_PROGRESS"
            ).length,
          },
          {
            label: "Completed",
            count: tasks.filter(
              (task) => task.status === "DONE"
            ).length,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">
              {item.label}
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : item.count}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading assigned tasks...
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ClipboardCheck
            size={36}
            className="mx-auto text-slate-400"
          />

          <h2 className="mt-4 font-semibold text-slate-800">
            No assigned tasks
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Your assigned tasks will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visibleTasks.map((task) => (
            <article
              key={task.taskId}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  TASK #{task.taskId}
                </span>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {task.status.replace("_", " ")}
                </span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                {task.title}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {task.description || "No description."}
              </p>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <FolderKanban size={16} />
                  Project #{task.projectId}
                </div>

                <div className="flex items-center gap-2">
                  <Clock3 size={16} />
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleDateString()
                    : "No due date"}
                </div>

                <div className="text-xs text-slate-400">
                  Priority: {task.priority} · Version: {task.version}
                </div>
              </div>

              {nextStatus(task.status) && (
                <button
                  type="button"
                  disabled={updatingId !== null}
                  onClick={() =>
                    void handleChangeStatus(task)
                  }
                  className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingId === task.taskId ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}

                  Move to{" "}
                  {nextStatus(task.status)?.replace("_", " ")}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
