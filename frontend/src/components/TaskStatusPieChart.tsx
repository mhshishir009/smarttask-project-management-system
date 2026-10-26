interface TaskStatusPieChartProps {
  todo: number;
  inProgress: number;
  completed: number;
  loading: boolean;
}

export default function TaskStatusPieChart({ todo, inProgress, completed, loading }: TaskStatusPieChartProps) {
  const items = [
    { label: "Completed", count: completed, color: "var(--color-emerald-500, #10b981)", swatch: "bg-emerald-500" },
    { label: "In Progress", count: inProgress, color: "var(--color-amber-500, #f59e0b)", swatch: "bg-amber-500" },
    { label: "To Do", count: todo, color: "var(--color-blue-600, #2563eb)", swatch: "bg-blue-600" },
  ];
  const total = todo + inProgress + completed;
  let start = 0;
  // Cumulative boundaries preserve exact slice proportions without rounding the chart geometry.
  const segments = items.filter(item => item.count > 0).map(item => {
    const end = start + (item.count / total) * 100;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  // A neutral circle represents loading/empty data, never an invented status distribution.
  const background = !loading && total > 0 ? `conic-gradient(${segments.join(", ")})` : "var(--color-slate-100, #f1f5f9)";
  const description = loading ? "Loading task status distribution"
    : total === 0 ? "No tasks to display"
    : `Task status distribution: ${items.map(item => `${item.label}: ${item.count} (${Math.round(item.count / total * 100)}%)`).join(", ")}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 px-5 py-8 sm:flex-row sm:gap-6 sm:px-6">
      <div role="img" aria-label={description} title={description}
        className="flex h-48 w-48 shrink-0 items-center justify-center rounded-full sm:h-52 sm:w-52"
        style={{ background }}>
        {/* A white center turns the same accurate status slices into a compact donut. */}
        <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white text-center sm:h-36 sm:w-36">
          <span className="text-xs font-medium text-slate-400">Total</span>
          <span className="mt-1 text-4xl font-bold tracking-tight text-slate-900">{loading ? "—" : total}</span>
          <span className="mt-1 text-xs text-slate-400">{loading ? "Loading..." : total === 0 ? "No tasks yet" : "Tasks"}</span>
        </div>
      </div>
      <ul aria-label="Task status legend" className="w-full min-w-0 space-y-5 sm:w-auto sm:flex-1">
        {items.map(item => (
          <li key={item.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-2.5 font-medium text-slate-600">
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${item.swatch}`} />
              {item.label}
            </span>
            <span className="font-semibold text-slate-900">
              {loading ? "—" : item.count}
              <span className="ml-2 text-xs font-normal text-slate-400">{loading ? "—" : `(${total > 0 ? Math.round(item.count / total * 100) : 0}%)`}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
