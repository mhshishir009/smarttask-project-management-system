
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import axios from "axios";
import { useSearchParams } from "react-router-dom";
import WorkspaceResultNotice from "../components/layout/WorkspaceResultNotice";

import {
  FolderKanban,
  RefreshCw,
  Plus,
  Archive,
  X,
  LoaderCircle,
  Pencil,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProjectCard from "../components/ProjectCard";
import ProjectDiscussion from "../components/ProjectDiscussion";
import { getProjectTaskSummary, type ProjectOverviewTask } from "../services/projectPresentation";

interface Project {
  projectId: number;
  name?: string;
  projectName?: string;
  title?: string;
  description?: string | null;
  isArchived?: boolean;
  createdAt?: string;
}

type FormMode = "create" | "edit";

function getProjectName(project: Project): string {
  return (
    project.name ??
    project.projectName ??
    project.title ??
    `Project #${project.projectId}`
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get("workspaceProject");
  const requestedDiscussion = searchParams.get("discussion");
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [projects, setProjects] = useState<Project[]>([]);
  const [discussionProject, setDiscussionProject] = useState<Project | null>(null);
  const closeDiscussion = useCallback(() => {
    setDiscussionProject(null);
    // Consume the notification's open flag so the same notification can reopen it later.
    if (searchParams.has("discussion")) {
      const params = new URLSearchParams(searchParams);
      params.delete("discussion");
      setSearchParams(params, {replace: true});
    }
  }, [searchParams, setSearchParams]);
  const [projectTasks, setProjectTasks] = useState<ProjectOverviewTask[] | null>(null);
  const [metricsError, setMetricsError] = useState("");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const summaries = useMemo(() => new Map(projects.map(project => [project.projectId,
    projectTasks === null ? null : getProjectTaskSummary(project.projectId, projectTasks)])), [projects, projectTasks]);
  const visibleProjects = useMemo(() => projects.filter(project => {
    if (selectedProjectId && project.projectId !== Number(selectedProjectId)) return false;
    if (projectFilter === "ACTIVE" && project.isArchived) return false;
    if (projectFilter === "ARCHIVED" && !project.isArchived) return false;
    const query = search.trim().toLowerCase();
    return !query || [getProjectName(project), project.description ?? "", String(project.projectId)].some(value => value.toLowerCase().includes(query));
  }).sort((a, b) => {
    if (sortBy === "name") return getProjectName(a).localeCompare(getProjectName(b));
    if (sortBy === "progress") return (summaries.get(b.projectId)?.progress ?? -1) - (summaries.get(a.projectId)?.progress ?? -1) || a.projectId - b.projectId;
    return (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || b.projectId - a.projectId;
  }), [projects, selectedProjectId, projectFilter, search, sortBy, summaries]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] =
    useState<FormMode>("create");

  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [archivingId, setArchivingId] =
    useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ==========================================
  // LOAD PROJECTS
  // ==========================================
  const fetchProjects = useCallback(() => {
    // Projects remain usable if task metrics fail; member progress covers assigned tasks only.
    return api.get("/projects").then((response) => {
      const payload = response.data?.data;
      if (!Array.isArray(payload)) throw new Error("Unexpected project API response");
      const projectList = payload as Project[];
      setProjects(projectList);
      // Notification deep links open the requested discussion; the API still enforces access.
      if (requestedDiscussion) {
        const target = projectList.find(project => String(project.projectId) === requestedDiscussion);
        if (target) setDiscussionProject(target);
      }
      setProjectTasks(null);
      setMetricsError("");
      const taskRequest = isAdmin ? api.get("/tasks").then(result => {
        if (!Array.isArray(result.data?.data)) throw new Error("Unexpected task API response");
        return result.data.data as ProjectOverviewTask[];
      }) : Promise.all(projectList.map(project => api.get(`/tasks/project/${project.projectId}`))).then(responses =>
        responses.flatMap(result => {
          if (!Array.isArray(result.data?.data)) throw new Error("Unexpected task API response");
          return result.data.data as ProjectOverviewTask[];
        }).filter(task => task.assigneeId === user?.userId));
      return taskRequest.then(setProjectTasks).catch((err: unknown) => {
        setMetricsError(getErrorMessage(err, "Task metrics are unavailable. Refresh to try again."));
      });
    }).catch((err: unknown) => {
      setError(getErrorMessage(err, "Unable to load projects."));
    }).finally(() => { setLoading(false); });
  }, [isAdmin, user?.userId, requestedDiscussion]);

  // User-triggered reloads set loading immediately; the mount effect only starts async work.
  const loadProjects = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // ==========================================
  // OPEN CREATE FORM
  // ==========================================
  const openCreateForm = () => {
    if (!isAdmin) return;

    setFormMode("create");
    setSelectedProject(null);
    setProjectName("");
    setDescription("");
    setFormError("");
    setSuccess("");
    setShowForm(true);
  };

  // ==========================================
  // OPEN EDIT FORM
  // ==========================================
  const openEditForm = (project: Project) => {
    if (!isAdmin || project.isArchived) return;

    setFormMode("edit");
    setSelectedProject(project);
    setProjectName(getProjectName(project));
    setDescription(project.description ?? "");
    setFormError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setSelectedProject(null);
    setProjectName("");
    setDescription("");
    setFormError("");
  };

  // ==========================================
  // CREATE OR UPDATE PROJECT
  // ==========================================
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    if (!isAdmin) {
      setFormError(
        "Only administrators can manage projects."
      );
      return;
    }

    const name = projectName.trim();

    if (!name) {
      setFormError("Project name is required.");
      return;
    }

    if (
      formMode === "edit" &&
      (!selectedProject || selectedProject.isArchived)
    ) {
      setFormError(
        "An active project must be selected."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        description: description.trim() || null,
      };

      if (formMode === "create") {
        await api.post("/projects", payload);
        setSuccess("Project created successfully.");
      } else if (selectedProject) {
        await api.put(
          `/projects/${selectedProject.projectId}`,
          payload
        );

        setSuccess("Project updated successfully.");
      }

      closeFormAfterSave();
      await loadProjects();
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(
          err,
          "Unable to save project."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const closeFormAfterSave = () => {
    setShowForm(false);
    setSelectedProject(null);
    setProjectName("");
    setDescription("");
    setFormError("");
  };

  // ==========================================
  // ARCHIVE PROJECT
  // ==========================================
  const handleArchive = async (
    project: Project
  ) => {
    if (
      !isAdmin ||
      project.isArchived ||
      archivingId !== null || deletingId !== null
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Archive "${getProjectName(project)}"?\n\n` +
      "Archived projects cannot be modified."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setArchivingId(project.projectId);

    try {
      await api.patch(
        `/projects/${project.projectId}/archive`
      );

      setSuccess("Project archived successfully.");
      await loadProjects();
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to archive project."
        )
      );
    } finally {
      setArchivingId(null);
    }
  };

  // Delete only after confirmation; the backend preserves any project that still has tasks.
  const handleDelete = async (project: Project) => {
    if (!isAdmin || deletingId !== null || archivingId !== null) return;
    if (!window.confirm(`Permanently delete "${getProjectName(project)}"?\n\nProjects with tasks or discussion messages cannot be deleted.`)) return;
    setDeletingId(project.projectId);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/projects/${project.projectId}`);
      setSuccess("Project deleted successfully.");
      await loadProjects();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) await loadProjects();
      setError(getErrorMessage(err, "Unable to delete project."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkspaceResultNotice field="workspaceProject" />
      {/* Project workspace keeps existing actions and uses the application's blue palette. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Workspace / Projects</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your projects, in focus.</h1>
          <p className="mt-2 text-sm text-slate-500">A clear view of your work, progress, and next deadlines.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void loadProjects()} disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh
          </button>
          {isAdmin && <button type="button" onClick={openCreateForm} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17} />New Project</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {[
          {label: "Total projects", value: projects.length, icon: FolderKanban, style: "bg-blue-50 text-blue-600"},
          {label: "Active", value: projects.filter(project => !project.isArchived).length, icon: SlidersHorizontal, style: "bg-emerald-50 text-emerald-600"},
          {label: "Archived", value: projects.filter(project => project.isArchived).length, icon: Archive, style: "bg-slate-100 text-slate-500"},
        ].map(item => <div key={item.label} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div><p className="text-xs text-slate-500 sm:text-sm">{item.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "—" : item.value}</p></div>
          <div className={`hidden rounded-xl p-2.5 sm:block ${item.style}`}><item.icon size={20} /></div>
        </div>)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Project archive filter" className="flex rounded-xl border border-slate-200 bg-white p-1">
          {([ ["ALL", "All projects"], ["ACTIVE", "Active"], ["ARCHIVED", "Archived"] ] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={projectFilter === value} onClick={() => setProjectFilter(value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${projectFilter === value ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>{label}</button>)}
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-60"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input type="search" aria-label="Search projects" placeholder="Search projects..." value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <select aria-label="Sort projects" value={sortBy} onChange={event => setSortBy(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
            <option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="progress">Most complete</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-400">{loading ? "Loading your workspace..." : `Showing ${visibleProjects.length} of ${projects.length} projects`}{!isAdmin && " · Progress reflects only your assigned tasks"}</p>

      {/* SUCCESS */}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {metricsError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Projects loaded, but task metrics could not be loaded: {metricsError}</p>}
      {/* Consistent card heights, live task progress, and compact existing actions. */}
      {loading ? (
        <div role="status" aria-label="Loading projects" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(index => <div key={index} className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="h-12 w-12 rounded-xl bg-slate-100" /><div className="mt-6 h-5 w-3/4 rounded bg-slate-100" /><div className="mt-4 h-16 rounded bg-slate-50" /><div className="mt-12 h-2 rounded bg-slate-100" /></div>)}
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FolderKanban size={34} className="mx-auto text-blue-400" />
          <h2 className="mt-4 font-semibold text-slate-800">{projects.length ? "No matching projects" : "Your next project starts here"}</h2>
          <p className="mt-2 text-sm text-slate-500">{projects.length ? "Try another search or switch project filters." : "Create a project to organize your team's work."}</p>
          {(search || projectFilter !== "ALL") && <button type="button" onClick={() => {setSearch(""); setProjectFilter("ALL");}} className="mt-4 text-sm font-medium text-blue-600">Clear filters</button>}
        </div>
      ) : (
        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map(project => <ProjectCard key={project.projectId}
            project={{...project, name: getProjectName(project)}} summary={summaries.get(project.projectId) ?? null}
            isAdmin={isAdmin} busy={saving || deletingId !== null || archivingId !== null}
            onDiscuss={() => setDiscussionProject(project)}
            onEdit={() => openEditForm(project)} onArchive={() => void handleArchive(project)} onDelete={() => void handleDelete(project)} />)}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {discussionProject && <ProjectDiscussion key={discussionProject.projectId} projectId={discussionProject.projectId} projectName={getProjectName(discussionProject)} isArchived={!!discussionProject.isArchived} onClose={closeDiscussion} />}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-form-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2
                  id="project-form-title"
                  className="text-xl font-bold text-slate-900"
                >
                  {formMode === "create"
                    ? "Create New Project"
                    : "Edit Project"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {formMode === "create"
                    ? "Add a new project to your workspace."
                    : "Update the selected project information."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close project form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(event) =>
                void handleSubmit(event)
              }
              className="space-y-5 p-6"
            >
              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="project-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Project Name *
                </label>

                <input
                  id="project-name"
                  type="text"
                  required
                  autoFocus
                  value={projectName}
                  onChange={(event) =>
                    setProjectName(event.target.value)
                  }
                  placeholder="Enter project name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="project-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="project-description"
                  rows={4}
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Enter project description"
                  className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
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
                  ) : formMode === "create" ? (
                    <>
                      <Plus size={17} />
                      Create Project
                    </>
                  ) : (
                    <>
                      <Pencil size={17} />
                      Save Changes
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
