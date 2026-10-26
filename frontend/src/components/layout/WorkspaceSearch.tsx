import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LoaderCircle } from "lucide-react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { searchWorkspace, type WorkspaceResult } from "../../services/workspaceSearch";

export default function WorkspaceSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!user || query.trim().length < 2) return;
    const controller = new AbortController();
    // Debounce typing and cancel obsolete queries so results never jump back to older text.
    const timer = window.setTimeout(() => {
      void searchWorkspace(query, user.role, user.userId, controller.signal).then(items => {
        if (!controller.signal.aborted) setResults(items);
      }).catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        setError(axios.isAxiosError(err) ? err.response?.data?.message || "Unable to search. Please try again." : "Unable to search. Please try again.");
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, user]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (item: WorkspaceResult) => { setOpen(false); setQuery(""); setResults([]); navigate(item.href); };
  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      setActive(current => event.key === "ArrowDown" ? Math.min(current + 1, results.length - 1) : Math.max(current - 1, 0));
    }
    if (event.key === "Enter") { event.preventDefault(); if (open && results.length && !loading) select(results[Math.max(active, 0)]); }
  };

  return (
    <div ref={root} className="relative hidden xl:block">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        {loading ? <LoaderCircle size={17} className="animate-spin text-slate-400" /> : <Search size={17} className="text-slate-400" />}
        <input type="search" role="combobox" aria-label="Search workspace" aria-expanded={open} aria-autocomplete="list" aria-controls="workspace-results"
          aria-activedescendant={open && active >= 0 && results[active] ? `workspace-result-${active}` : undefined}
          placeholder="Search workspace" value={query} autoComplete="off"
          onFocus={() => setOpen(true)} onKeyDown={handleKey}
          onChange={event => { const value = event.target.value; setQuery(value); setResults([]); setError(""); setActive(-1); setLoading(value.trim().length >= 2); setOpen(true); }}
          className="w-48 min-w-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
      </div>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div role="status" className="px-3 py-2 text-xs text-slate-500">
            {query.trim().length < 2 ? "Type at least 2 characters to search." : loading ? "Searching..." : error || (results.length ? "Select a result to open it." : "No matching results.")}
          </div>
          <ul role="listbox" id="workspace-results" aria-label="Workspace search results">
            {results.map((item, index) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" role="option" id={`workspace-result-${index}`} aria-selected={active === index}
                  onClick={() => select(item)} className={`w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${active === index ? "bg-blue-50" : ""}`}>
                  <span className="block truncate text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-xs capitalize text-slate-500">{item.kind} #{item.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
