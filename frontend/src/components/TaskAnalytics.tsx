import { BarChart3, PieChart } from "lucide-react";
import TaskStatusPieChart from "./TaskStatusPieChart";
import TaskPriorityChart from "./TaskPriorityChart";

interface TaskAnalyticsProps {
  todo: number;
  inProgress: number;
  completed: number;
  high: number;
  medium: number;
  low: number;
  loading: boolean;
}

// Matched cards share one responsive row; all counts still come from the dashboard's API data.
export default function TaskAnalytics(props: TaskAnalyticsProps) {
  const {todo, inProgress, completed, high, medium, low, loading} = props;
  const total = todo + inProgress + completed;
  const completion = total ? Math.round(completed / total * 100) : 0;
  return (
    <div className="grid items-stretch gap-6 xl:grid-cols-2">
      <section aria-labelledby="task-status-title" className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 pb-2 pt-6 sm:px-6">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><PieChart size={21} /></div>
          <div className="min-w-0"><h2 id="task-status-title" className="text-base font-semibold text-slate-900">Task Status Analytics</h2><p className="mt-1 text-xs text-slate-500">A clear picture of where your tasks stand</p></div>
        </div>
        <TaskStatusPieChart todo={todo} inProgress={inProgress} completed={completed} loading={loading} />
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:mx-6 sm:mb-6">
          <div><p className="text-xs font-medium text-slate-600">Overall task completion</p><p className="mt-1 text-xs text-slate-400">{loading ? "Loading..." : `${completed} of ${total} tasks completed`}</p></div>
          <span className="text-xl font-bold text-blue-600">{loading ? "—" : `${completion}%`}</span>
        </div>
      </section>
      <section aria-labelledby="task-priority-title" className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 pb-2 pt-6 sm:px-6">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><BarChart3 size={21} /></div>
          <div className="min-w-0"><h2 id="task-priority-title" className="text-base font-semibold text-slate-900">Task Priority Distribution</h2><p className="mt-1 text-xs text-slate-500">Task counts across your three priority levels</p></div>
        </div>
        <TaskPriorityChart high={high} medium={medium} low={low} loading={loading} />
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:mx-6 sm:mb-6">
          <div><p className="text-xs font-medium text-slate-600">Total tasks</p><p className="mt-1 text-xs text-slate-400">Actual counts from the current workspace</p></div>
          <span className="text-xl font-bold text-slate-900">{loading ? "—" : high + medium + low}</span>
        </div>
      </section>
    </div>
  );
}
