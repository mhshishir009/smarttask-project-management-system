interface TaskPriorityChartProps {
  high: number;
  medium: number;
  low: number;
  loading: boolean;
}

export default function TaskPriorityChart({ high, medium, low, loading }: TaskPriorityChartProps) {
  const items = [
    { label: "HIGH", count: high, color: "var(--color-red-500, #ef4444)" },
    { label: "MEDIUM", count: medium, color: "var(--color-amber-500, #f59e0b)" },
    { label: "LOW", count: low, color: "var(--color-emerald-500, #10b981)" },
  ];
  const total = high + medium + low;
  // Use a shared count scale with integer ticks; never divide by zero on empty data.
  const step = Math.max(1, Math.ceil(Math.max(high, medium, low) / 4));
  const axisMax = step * 4;
  const description = loading ? "Loading task priority distribution" : total === 0 ? "No tasks to display"
    : `Task priority distribution: ${items.map(item => `${item.label}: ${item.count} (${Math.round(item.count / total * 100)}%)`).join(", ")}`;

  return (
    <div className="flex flex-1 flex-col justify-center px-5 pb-6 pt-5 sm:px-6">
      <svg viewBox="0 0 440 250" role="img" aria-label={description} className="mx-auto block h-60 w-full">
        <title>{description}</title>
        <text x={8} y={17} className="fill-slate-400 text-xs">Tasks</text>
        {[0, 1, 2, 3, 4].map(index => {
          const y = 32 + index * 48;
          return (
            <g key={index}>
              <line x1={40} y1={y} x2={428} y2={y} stroke="var(--color-slate-100, #f1f5f9)" />
              <text x={28} y={y + 4} textAnchor="end" className="fill-slate-400 text-xs">{axisMax - index * step}</text>
            </g>
          );
        })}
        <line x1={40} y1={224} x2={428} y2={224} stroke="var(--color-slate-200, #e2e8f0)" />
        {items.map((item, index) => {
          const x = 110 + index * 122;
          const height = loading ? 0 : item.count / axisMax * 192;
          return (
            <g key={item.label}>
              <rect x={x - 30} y={224 - height} width={60} height={height} rx={8} fill={item.color}>
                <title>{loading ? "Loading..." : `${item.label}: ${item.count} tasks`}</title>
              </rect>
              <text x={x} y={Math.min(211, 216 - height)} textAnchor="middle" className="fill-slate-900 text-sm font-semibold">{loading ? "—" : item.count}</text>
              <text x={x} y={244} textAnchor="middle" className="fill-slate-500 text-xs">{item.label}</text>
            </g>
          );
        })}
        {(loading || total === 0) && <text x={230} y={126} textAnchor="middle" className="fill-slate-500 text-sm">{loading ? "Loading..." : "No tasks yet"}</text>}
      </svg>
      {/* Native text below the plot remains readable when the SVG scales on small screens. */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
        {items.map(item => <div key={item.label} className="text-center">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{loading ? "—" : item.count}<span className="ml-1.5 text-xs font-normal text-slate-400">{loading ? "" : `(${total > 0 ? Math.round(item.count / total * 100) : 0}%)`}</span></p>
        </div>)}
      </div>
    </div>
  );
}
