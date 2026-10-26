
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import axios from "axios";
import { useSearchParams } from "react-router-dom";
import WorkspaceResultNotice from "../components/layout/WorkspaceResultNotice";

import {
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UserRoundCog,
  X,
  Trash2,
} from "lucide-react";

import api from "../services/api";
import { deleteTask, getFilteredTasks, requireActiveAssignee, reassignTask } from "../services/taskActions";
import { useAuth } from "../context/AuthContext";

// ==========================================
// TYPES
// ==========================================

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

type StatusFilter = "ALL" | TaskStatus;

type ModalMode = "create" | "edit" | "assign";

interface Task {
  taskId: number;
  projectId: number;
  assigneeId: number | null;
  createdBy: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  projectId: number;
  name?: string;
  projectName?: string;
  title?: string;
  isArchived?: boolean;
}

interface User {
  userId: number;
  fullName?: string;
  name?: string;
  email?: string;
  isActive?: boolean;
}

// ==========================================
// HELPERS
// ==========================================

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === "string") {
      return message;
    }

    if (error.response?.status === 409) {
      return "Conflict detected. Refresh and try again.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function statusStyle(status: TaskStatus): string {
  if (status === "TODO") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "IN_PROGRESS") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

function priorityStyle(priority: TaskPriority): string {
  if (priority === "HIGH") {
    return "bg-red-50 text-red-700";
  }

  if (priority === "MEDIUM") {
    return "bg-violet-50 text-violet-700";
  }

  return "bg-blue-50 text-blue-700";
}

function formatDate(value: string | null): string {
  if (!value) return "No due date";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : date.toLocaleDateString();
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid task due date");
  }

  return date.toISOString();
}

function getProjectName(project: Project): string {
  return (
    project.name ??
    project.projectName ??
    project.title ??
    `Project #${project.projectId}`
  );
}

function getUserName(user: User): string {
  return (
    user.fullName ??
    user.name ??
    user.email ??
    `User #${user.userId}`
  );
}

function getNextStatus(
  status: TaskStatus
): TaskStatus | null {
  if (status === "TODO") return "IN_PROGRESS";

  if (status === "IN_PROGRESS") return "DONE";

  return null;
}

// ==========================================
// TASK MANAGEMENT PAGE
// ==========================================

export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("workspaceTask");
  const { user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  // ==========================================
  // TASK LIST
  // ==========================================

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | TaskPriority>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // ==========================================
  // MODAL
  // ==========================================

  const [showModal, setShowModal] = useState(false);

  const [modalMode, setModalMode] =
    useState<ModalMode>("create");

  const [selectedTask, setSelectedTask] =
    useState<Task | null>(null);

  const [saving, setSaving] = useState(false);

  const [loadingOptions, setLoadingOptions] =
    useState(false);

  const [formError, setFormError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterUsers, setFilterUsers] = useState<User[]>([]);

  // ==========================================
  // FORM FIELDS
  // ==========================================

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [priority, setPriority] =
    useState<TaskPriority>("MEDIUM");

  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");

  // ==========================================
  // STATUS UPDATE
  // ==========================================

  const [updatingStatusId, setUpdatingStatusId] =
    useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const taskRequestId = useRef(0);

  // ==========================================
  // LOAD TASKS
  // ==========================================

  const fetchTasks = useCallback((signal?: AbortSignal) => {
    const requestId = ++taskRequestId.current;
    // Keep unauthorized loads local and apply state updates from promise callbacks.
    const request = isAdmin ? getFilteredTasks({ projectId: projectFilter, status: statusFilter, priority: priorityFilter, assigneeId: assigneeFilter }, signal)
      : Promise.reject(new Error("Only administrators can view all tasks."));
    return request.then((response) => {
      if (signal?.aborted || requestId !== taskRequestId.current) return;
      const payload = response.data?.data;
      if (!Array.isArray(payload)) throw new Error("Unexpected task API response.");
      setTasks(payload as Task[]);
    }).catch((err: unknown) => {
      if (signal?.aborted || requestId !== taskRequestId.current || axios.isCancel(err)) return;
      setTasks([]);
      setError(getErrorMessage(err, "Unable to load tasks."));
    }).finally(() => { if (!signal?.aborted && requestId === taskRequestId.current) setLoading(false); });
  }, [isAdmin, projectFilter, statusFilter, priorityFilter, assigneeFilter]);

  // Preserve refresh and mutation reload feedback without synchronous effect updates.
  const loadTasks = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    // Discard an older filter response when the user selects a new filter quickly.
    const controller = new AbortController();
    void fetchTasks(controller.signal);
    return () => controller.abort();
  }, [fetchTasks]);

  // ==========================================
  // LOAD FORM OPTIONS
  // ==========================================

  // Load option lists for filters as well as the existing task form.
  const fetchFormOptions = useCallback(() => {
    return Promise.all([api.get("/projects"), api.get("/users")])
      .then(([projectResponse, userResponse]) => {
        const projectData = projectResponse.data?.data;
        const userData = userResponse.data?.data;
        if (!Array.isArray(projectData)) throw new Error("Unable to load projects.");
        if (!Array.isArray(userData)) throw new Error("Unable to load users.");
        setProjects(projectData as Project[]);
        setFilterUsers(userData as User[]);
        setUsers((userData as User[]).filter(account => account.isActive === true));
        setOptionsError("");
      }).catch((err: unknown) => {
        setOptionsError(getErrorMessage(err, "Unable to load project or user options."));
      }).finally(() => { setLoadingOptions(false); });
  }, []);

  const loadFormOptions = () => {
    setLoadingOptions(true);
    setOptionsError("");
    return fetchFormOptions();
  };

  useEffect(() => {
    if (isAdmin) void fetchFormOptions();
  }, [isAdmin, fetchFormOptions]);

  // ==========================================
  // FILTER TASKS
  // ==========================================

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (selectedTaskId && task.taskId !== Number(selectedTaskId)) return false;
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        String(task.taskId).includes(query) ||
        String(task.projectId).includes(query);

      return matchesSearch;
    });
  }, [tasks, search, selectedTaskId]);

  // ==========================================
  // TASK STATISTICS
  // ==========================================

  const summary = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: tasks.length,
      },
      {
        label: "To Do",
        value: tasks.filter(
          (task) => task.status === "TODO"
        ).length,
      },
      {
        label: "In Progress",
        value: tasks.filter(
          (task) => task.status === "IN_PROGRESS"
        ).length,
      },
      {
        label: "Completed",
        value: tasks.filter(
          (task) => task.status === "DONE"
        ).length,
      },
    ],
    [tasks]
  );

  // ==========================================
  // RESET FORM
  // ==========================================

  const resetForm = () => {
    setSelectedTask(null);
    setProjectId("");
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssigneeId("");
    setDueAt("");
    setFormError("");
    setOptionsError("");
  };

  // ==========================================
  // OPEN CREATE MODAL
  // ==========================================

  const openCreateModal = () => {
    if (!isAdmin) return;

    resetForm();
    setModalMode("create");
    setSuccess("");
    setShowModal(true);

    void loadFormOptions();
  };

  // ==========================================
  // OPEN EDIT MODAL
  // ==========================================

  const openEditModal = (task: Task) => {
    if (!isAdmin) return;

    resetForm();

    setModalMode("edit");
    setSelectedTask(task);

    setProjectId(String(task.projectId));
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setDueAt(toDateTimeLocal(task.dueAt));

    setShowModal(true);

    void loadFormOptions();
  };

  // ==========================================
  // OPEN REASSIGN MODAL
  // ==========================================

  const openAssignModal = (task: Task) => {
    if (!isAdmin) return;

    resetForm();

    setModalMode("assign");
    setSelectedTask(task);

    setAssigneeId(
      task.assigneeId === null
        ? ""
        : String(task.assigneeId)
    );

    setShowModal(true);

    void loadFormOptions();
  };

  // ==========================================
  // CLOSE MODAL
  // ==========================================

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    resetForm();
  };

  // ==========================================
  // FORM SUBMIT
  // ==========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormError("");
    setError("");
    setSuccess("");

    if (!isAdmin) {
      setFormError("Administrator access required.");
      return;
    }

    if (
      modalMode !== "create" &&
      selectedTask === null
    ) {
      setFormError("Please select a task.");
      return;
    }

    setSaving(true);

    try {
      if (modalMode === "assign") {
        // Keep a required active assignee for both creation and reassignment.
        await reassignTask(selectedTask!.taskId, selectedTask!.version, assigneeId, users);

        setSuccess("Task reassigned successfully.");
      } else {
        const taskTitle = title.trim();

        if (
          !taskTitle ||
          taskTitle.length > 200
        ) {
          throw new Error(
            "Task title must contain 1 to 200 characters."
          );
        }

        const payload = {
          title: taskTitle,
          description: description.trim() || null,
          priority,
          dueAt: toIsoOrNull(dueAt),
        };

        if (modalMode === "create") {
          const selectedProjectId = Number(projectId);

          if (
            !Number.isSafeInteger(selectedProjectId) ||
            selectedProjectId <= 0
          ) {
            throw new Error("Please select a project.");
          }

          // Validate before making a request; only active users can own a new task.
          const selectedAssigneeId = requireActiveAssignee(assigneeId, users);

          await api.post("/tasks", {
            projectId: selectedProjectId,
            assigneeId: selectedAssigneeId,
            ...payload,
          });

          setSuccess("Task created successfully.");
        } else {
          await api.put(
            `/tasks/${selectedTask!.taskId}`,
            {
              ...payload,
              expectedVersion: selectedTask!.version,
            }
          );

          setSuccess("Task updated successfully.");
        }
      }

      setShowModal(false);
      resetForm();

      await loadTasks();
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(
          err,
          "Unable to save task."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // CHANGE TASK STATUS
  // ==========================================

  const handleChangeStatus = async (task: Task) => {
    if (!isAdmin || updatingStatusId !== null || deletingId !== null) return;

    const nextStatus = getNextStatus(task.status);

    if (!nextStatus) return;

    const confirmed = window.confirm(
      `Change Task #${task.taskId} status from ` +
      `${task.status} to ${nextStatus}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setUpdatingStatusId(task.taskId);

    try {
      await api.patch(
        `/tasks/${task.taskId}/status`,
        {
          expectedVersion: task.version,
          status: nextStatus,
        }
      );

      setSuccess(
        `Task #${task.taskId} status changed to ${nextStatus}.`
      );

      await loadTasks();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to update task status."
        )
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Delete the displayed version only; a 409 refreshes the list without retrying deletion.
  const handleDelete = async (task: Task) => {
    if (!isAdmin || deletingId !== null || updatingStatusId !== null) return;
    if (!window.confirm(`Permanently delete Task #${task.taskId}: "${task.title}"?`)) return;
    setDeletingId(task.taskId);
    setError("");
    setSuccess("");
    try {
      await deleteTask(task.taskId, task.version);
      setSuccess("Task deleted successfully.");
      await loadTasks();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && [404, 409].includes(err.response?.status ?? 0)) await loadTasks();
      setError(getErrorMessage(err, "Unable to delete task."));
    } finally {
      setDeletingId(null);
    }
  };

  // Filter changes trigger the server query; loading feedback starts in the user event.
  const prepareFilterChange = () => { setLoading(true); setError(""); };
  const resetFilters = () => {
    if (projectFilter || assigneeFilter || statusFilter !== "ALL" || priorityFilter !== "ALL") prepareFilterChange();
    setProjectFilter(""); setAssigneeFilter(""); setStatusFilter("ALL"); setPriorityFilter("ALL"); setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkspaceResultNotice field="workspaceTask" />
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Task Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create, assign, update and track project tasks.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadTasks()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {success}
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">
              {item.label}
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "—" : item.value}
            </p>
          </div>
        ))}
      </div>

      {/* SEARCH AND FILTER */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-3 text-slate-400"
          />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by title, task ID or project ID"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <select
          aria-label="Filter tasks by status"
          disabled={deletingId !== null || updatingStatusId !== null}
          value={statusFilter}
          onChange={(event) => { prepareFilterChange(); setStatusFilter(event.target.value as StatusFilter); }}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select aria-label="Filter tasks by project" value={projectFilter}
          disabled={deletingId !== null || updatingStatusId !== null}
          onChange={event => { prepareFilterChange(); setProjectFilter(event.target.value); }}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <option value="">All Projects</option>
          {projects.map(project => <option key={project.projectId} value={project.projectId}>{getProjectName(project)}</option>)}
        </select>
        <select aria-label="Filter tasks by priority" value={priorityFilter}
          disabled={deletingId !== null || updatingStatusId !== null}
          onChange={event => { prepareFilterChange(); setPriorityFilter(event.target.value as "ALL" | TaskPriority); }}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <option value="ALL">All Priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
        </select>
        <select aria-label="Filter tasks by assignee" value={assigneeFilter}
          disabled={deletingId !== null || updatingStatusId !== null}
          onChange={event => { prepareFilterChange(); setAssigneeFilter(event.target.value); }}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <option value="">All Assignees</option>
          {filterUsers.map(account => <option key={account.userId} value={account.userId}>{getUserName(account)}{account.isActive === false ? " (Inactive)" : ""}</option>)}
        </select>
        <button type="button" disabled={deletingId !== null || updatingStatusId !== null} onClick={resetFilters} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">Reset Filters</button>
      </div>
      {optionsError && !showModal && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {optionsError} <button type="button" disabled={loadingOptions} onClick={() => void loadFormOptions()} className="font-medium underline">Retry options</button>
        </div>
      )}

      {/* TASK LIST */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          Loading tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <ListTodo
            size={36}
            className="mx-auto text-slate-400"
          />

          <h2 className="mt-4 font-semibold text-slate-800">
            No tasks found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Create a task or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredTasks.map((task) => (
            <article
              key={task.taskId}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              {/* TASK HEADER */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  TASK #{task.taskId}
                </span>

                <div className="flex gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${priorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle(
                      task.status
                    )}`}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* TASK CONTENT */}
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                {task.title}
              </h2>

              <p className="mt-2 min-h-12 text-sm text-slate-500">
                {task.description ||
                  "No description available."}
              </p>

              {/* TASK META */}
              <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <FolderKanban
                    size={16}
                    className="text-slate-400"
                  />

                  Project #{task.projectId}
                </div>

                <div className="flex items-center gap-2">
                  <UserRound
                    size={16}
                    className="text-slate-400"
                  />

                  {task.assigneeId === null
                    ? "Unassigned"
                    : `User #${task.assigneeId}`}
                </div>

                <div className="flex items-center gap-2">
                  <Clock3
                    size={16}
                    className="text-slate-400"
                  />

                  {formatDate(task.dueAt)}
                </div>

                <div className="text-xs text-slate-400 sm:text-right">
                  Version: {task.version}
                </div>
              </div>

              {/* ADMIN TASK ACTIONS */}
              {isAdmin && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openEditModal(task)}
                    className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => openAssignModal(task)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <UserRoundCog size={16} />
                    Reassign
                  </button>

                  {getNextStatus(task.status) && (
                    <button
                      type="button"
                      disabled={updatingStatusId !== null || deletingId !== null}
                      onClick={() =>
                        void handleChangeStatus(task)
                      }
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {updatingStatusId === task.taskId ? (
                        <LoaderCircle
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}

                      Move to{" "}
                      {getNextStatus(task.status)?.replace(
                        "_",
                        " "
                      )}
                    </button>
                  )}
                  <button type="button" disabled={deletingId !== null || updatingStatusId !== null}
                    onClick={() => void handleDelete(task)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                    {deletingId === task.taskId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* CREATE / EDIT / REASSIGN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2
                  id="task-modal-title"
                  className="text-xl font-bold text-slate-900"
                >
                  {modalMode === "create"
                    ? "Create New Task"
                    : modalMode === "edit"
                      ? "Edit Task"
                      : "Reassign Task"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {modalMode === "create"
                    ? "Add a task to an active project."
                    : `Task #${selectedTask?.taskId}`}
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close task form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={(event) =>
                void handleSubmit(event)
              }
              className="space-y-5 p-6"
            >
              {/* FORM ERROR */}
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              {/* OPTIONS ERROR */}
              {optionsError && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                >
                  {optionsError}
                </div>
              )}

              {/* CREATE OR EDIT FIELDS */}
              {modalMode !== "assign" && (
                <>
                  {modalMode === "create" && (
                    <div>
                      <label
                        htmlFor="task-project"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Project *
                      </label>

                      <select
                        id="task-project"
                        required
                        value={projectId}
                        onChange={(event) =>
                          setProjectId(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                      >
                        <option value="">
                          Select a project
                        </option>

                        {projects
                          .filter(
                            (project) => !project.isArchived
                          )
                          .map((project) => (
                            <option
                              key={project.projectId}
                              value={project.projectId}
                            >
                              {getProjectName(project)}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* TASK TITLE */}
                  <div>
                    <label
                      htmlFor="task-title"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Task Title *
                    </label>

                    <input
                      id="task-title"
                      type="text"
                      required
                      maxLength={200}
                      value={title}
                      onChange={(event) =>
                        setTitle(event.target.value)
                      }
                      placeholder="Enter task title"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div>
                    <label
                      htmlFor="task-description"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Description
                    </label>

                    <textarea
                      id="task-description"
                      rows={3}
                      value={description}
                      onChange={(event) =>
                        setDescription(event.target.value)
                      }
                      placeholder="Enter task description"
                      className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm"
                    />
                  </div>

                  {/* PRIORITY */}
                  <div>
                    <label
                      htmlFor="task-priority"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Priority
                    </label>

                    <select
                      id="task-priority"
                      value={priority}
                      onChange={(event) =>
                        setPriority(
                          event.target.value as TaskPriority
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  {/* DUE DATE */}
                  <div>
                    <label
                      htmlFor="task-due-date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Due Date & Time
                    </label>

                    <input
                      id="task-due-date"
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) =>
                        setDueAt(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm"
                    />
                  </div>
                </>
              )}

              {/* ASSIGNEE FIELD */}
              {(modalMode === "create" ||
                modalMode === "assign") && (
                <div>
                  <label
                    htmlFor="task-assignee"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Assigned To *
                  </label>

                  <select
                    id="task-assignee"
                    required
                    value={assigneeId}
                    onChange={(event) =>
                      setAssigneeId(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="" disabled>
                      Select an active assignee
                    </option>

                    {users.map((account) => (
                      <option
                        key={account.userId}
                        value={account.userId}
                      >
                        {getUserName(account)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* VERSION INFO */}
              {selectedTask && (
                <p className="text-xs text-slate-500">
                  Current Version: {selectedTask.version}
                </p>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingOptions ||
                    Boolean(optionsError)
                  }
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                      Saving...
                    </>
                  ) : modalMode === "create" ? (
                    <>
                      <Plus size={17} />
                      Create Task
                    </>
                  ) : modalMode === "edit" ? (
                    <>
                      <Pencil size={17} />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <UserRoundCog size={17} />
                      Save Assignment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
