import { Archive, CalendarDays, CheckCircle2, FolderKanban, MessageSquare, MoreHorizontal, Pencil, Trash2, UsersRound } from "lucide-react";
import type { ProjectTaskSummary } from "../services/projectPresentation";

interface CardProject {
  projectId: number;
  name: string;
  description?: string | null;
  isArchived?: boolean;
  createdAt?: string;
}
interface ProjectCardProps {
  project: CardProject;
  summary: ProjectTaskSummary | null;
  isAdmin: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onDiscuss?: () => void;
}

function formatDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  return new Date(value).toLocaleDateString("en-GB", {day: "2-digit", month: "short", year: "numeric"});
}

export default function ProjectCard({project, summary, isAdmin, busy, onEdit, onArchive, onDelete, onDiscuss}: ProjectCardProps) {
  const status = project.isArchived ? "Archived" : !isAdmin && summary
    ? !summary.total ? "No assigned tasks" : summary.status === "Completed" ? "Your tasks done" : summary.status === "In progress" ? "Your tasks active" : "Your tasks not started"
    : summary?.status ?? "Active";
  const statusStyle = !project.isArchived && summary?.status === "Completed" ? "bg-emerald-50 text-emerald-700"
    : !project.isArchived && summary?.status === "In progress" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  const priorityStyle = summary?.priority === "HIGH" ? "bg-red-50 text-red-600"
    : summary?.priority === "MEDIUM" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";

  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-3 ${project.isArchived ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600"}`}><FolderKanban size={21} /></div>
          <span className="font-mono text-xs font-medium tracking-wide text-slate-400">PRJ-{String(project.projectId).padStart(3, "0")}</span>
        </div>
        {isAdmin && (
          <details className="relative" onKeyDown={event => { if (event.key === "Escape") event.currentTarget.open = false; }}>
            <summary aria-label={`Actions for ${project.name}`} className="cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><MoreHorizontal size={20} /></summary>
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
              onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>
              {/* Reuse existing page handlers and permission rules, including archived restrictions. */}
              {!project.isArchived && <>
                <button type="button" disabled={busy} onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil size={15} />Edit project</button>
                <button type="button" disabled={busy} onClick={onArchive} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Archive size={15} />Archive</button>
              </>}
              <button type="button" disabled={busy} onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />Delete project</button>
            </div>
          </details>
        )}
      </div>
      <h2 title={project.name} className="mt-5 line-clamp-2 min-h-14 break-words text-lg font-semibold leading-7 text-slate-900">{project.name}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
        {summary?.priority && <span title={isAdmin ? "Highest task priority in this project" : "Highest priority among your assigned tasks"} className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyle}`}>{summary.priority.charAt(0) + summary.priority.slice(1).toLowerCase()} task priority</span>}
      </div>
      <p title={project.description || undefined} className="mt-4 line-clamp-3 h-[4.5rem] break-words text-sm leading-6 text-slate-500">{project.description || "Add a description to give your team a clear overview of this project."}</p>
      <div className="mt-auto pt-6">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-600">{isAdmin ? "Task progress" : "Your task progress"}</span><span className="font-semibold text-slate-900">{summary ? `${summary.progress}%` : "—"}</span></div>
        <div role="progressbar" aria-label={`${project.name} ${isAdmin ? "task" : "assigned task"} completion`} aria-valuenow={summary?.progress} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${summary?.progress === 100 ? "bg-emerald-500" : "bg-blue-600"}`} style={{width: `${summary?.progress ?? 0}%`}} />
        </div>
        <p className="mt-2 text-xs text-slate-400">{summary ? `${summary.completed} of ${summary.total} ${isAdmin ? "tasks" : "assigned tasks"} completed` : "Task metrics unavailable"}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><UsersRound size={14} />{summary ? isAdmin ? `${summary.assignees} assignees` : `${summary.total} assigned tasks` : "—"}</span>
        {summary?.status === "Completed" ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} />{isAdmin ? "All done" : "Your tasks done"}</span>
          : <span title="Earliest deadline among unfinished tasks" className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Next task: {formatDate(summary?.nextDue)}</span>}
      </div>
      <p className="mt-3 text-xs text-slate-400">Created {formatDate(project.createdAt)}</p>
      {onDiscuss && (isAdmin || (summary?.total ?? 0) > 0) && <button type="button" onClick={onDiscuss} disabled={busy} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"><MessageSquare size={16} />{project.isArchived ? "View discussion" : "Discussion"}</button>}
    </article>
  );
}
