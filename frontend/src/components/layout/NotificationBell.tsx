import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell, CheckCheck, RefreshCw, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { notificationTarget, type NotificationItem, type NotificationPage } from "../../services/notifications";

export default function NotificationBell() {
  const {user} = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<NotificationPage>({notifications: [], unreadCount: 0, nextBefore: null});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const active = useRef(true);
  const fetching = useRef(false);
  const currentFetch = useRef<AbortController | null>(null);
  const changing = useRef(false);
  const olderLoaded = useRef(false);
  const requests = useRef(new Set<AbortController>());

  const load = useCallback((before?: number) => {
    if (fetching.current || changing.current || !active.current) return Promise.resolve();
    fetching.current = true;
    const request = new AbortController(); requests.current.add(request);
    currentFetch.current = request;
    return api.get<{data: NotificationPage}>("/notifications", {signal: request.signal, params: before === undefined ? undefined : {before}})
      .then(response => {
        if (request.signal.aborted) return;
        const result = response.data.data;
        setPage(previous => {
          const merge = before !== undefined || olderLoaded.current;
          const combined = merge ? [...result.notifications, ...previous.notifications].filter((item, index, all) => all.findIndex(other => other.notificationId === item.notificationId) === index).sort((a,b) => b.notificationId - a.notificationId) : result.notifications;
          return {...result, notifications: combined, nextBefore: before === undefined && olderLoaded.current ? previous.nextBefore : result.nextBefore};
        });
        if (before !== undefined) olderLoaded.current = true;
        setError("");
      }).catch((value: unknown) => {
        if (!request.signal.aborted && !axios.isCancel(value)) setError("Notifications could not be loaded. Please refresh to retry.");
      }).finally(() => {
        requests.current.delete(request);
        if (currentFetch.current === request) {currentFetch.current = null; fetching.current = false;}
        if (!request.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    active.current = true;
    void load();
    // Polling and focus refresh avoid a realtime dependency or changes to existing forms.
    const timer = window.setInterval(() => {if (document.visibilityState === "visible") void load();}, 30000);
    const focus = () => {void load();};
    window.addEventListener("focus", focus);
    const pending = requests.current;
    return () => {active.current = false; pending.forEach(request => request.abort()); pending.clear(); currentFetch.current = null; fetching.current = false; window.clearInterval(timer); window.removeEventListener("focus", focus);};
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {if (!panel.current?.contains(event.target as Node)) setOpen(false);};
    const keyboard = (event: KeyboardEvent) => {if (event.key === "Escape") {setOpen(false); bell.current?.focus();}};
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", keyboard);
    return () => {document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", keyboard);};
  }, [open]);

  const refresh = (before?: number) => {if (fetching.current || changing.current) return; setLoading(true); void load(before);};
  const mark = async (item?: NotificationItem) => {
    if (changing.current || fetching.current) return;
    const newest = page.notifications[0]?.notificationId;
    if (!item && !newest) return;
    changing.current = true; setSaving(true); setError("");
    const request = new AbortController(); requests.current.add(request);
    let succeeded = false;
    try {
      if (item) await api.patch(`/notifications/${item.notificationId}/read`, {}, {signal: request.signal});
      else await api.patch("/notifications/read-all", {throughId: newest}, {signal: request.signal});
      if (request.signal.aborted) return;
      succeeded = true;
      const timestamp = new Date().toISOString();
      setPage(previous => ({...previous, notifications: previous.notifications.map(value =>
        !item || item.notificationId === value.notificationId ? {...value, readAt: value.readAt ?? timestamp} : value)}));
      if (item && user) {
        const destination = notificationTarget(item, user.role);
        if (destination) {setOpen(false); navigate(destination);}
      }
    } catch (value) {if (!request.signal.aborted && !axios.isCancel(value)) setError("Unable to mark notification as read. Please try again.");}
    finally {
      requests.current.delete(request); changing.current = false;
      if (active.current) {setSaving(false); if (succeeded) void load();}
    }
  };

  return <div ref={panel} className="relative">
    <button ref={bell} type="button" aria-label={`Notifications${page.unreadCount ? `, ${page.unreadCount} unread` : ""}`} aria-expanded={open} aria-controls="notification-panel" onClick={() => {setOpen(previous => !previous); if (!open) refresh();}} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
      <Bell size={20} />{page.unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">{page.unreadCount > 99 ? "99+" : page.unreadCount}</span>}
    </button>
    {open && <section id="notification-panel" aria-label="Notifications" className="fixed right-3 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:right-0 sm:top-full sm:mt-3 sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h3 className="font-semibold text-slate-900">Notifications</h3><p className="text-xs text-slate-500">{page.unreadCount} unread</p></div><div className="flex gap-1">
        <button type="button" aria-label="Refresh notifications" disabled={loading || saving} onClick={() => refresh()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        <button type="button" aria-label="Close notifications" onClick={() => {setOpen(false); bell.current?.focus();}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
      </div></div>
      <div className="flex justify-end border-b border-slate-100 px-4 py-2"><button type="button" onClick={() => void mark()} disabled={loading || saving || !page.unreadCount || !page.notifications.length} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 disabled:opacity-50"><CheckCheck size={14} />Mark all as read</button></div>
      {error && <p role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="max-h-[60dvh] overflow-y-auto" aria-busy={loading || saving}>
        {!page.notifications.length && <p role="status" className="px-4 py-10 text-center text-sm text-slate-400">{loading ? "Loading notifications…" : "No notifications yet"}</p>}
        {page.notifications.map(item => <button key={item.notificationId} type="button" disabled={saving || loading} onClick={() => void mark(item)} className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-100 disabled:opacity-60 ${item.readAt ? "bg-white" : "bg-blue-50/70"}`}>
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-slate-200" : "bg-blue-600"}`} />
          <span className="min-w-0"><span className="block break-words text-sm leading-5 text-slate-700">{item.message}</span><time dateTime={item.createdAt} className="mt-1 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>{!item.canOpen && <span className="mt-1 block text-xs text-slate-400">History · target unavailable or access changed</span>}</span>
        </button>)}
        {page.nextBefore && <button type="button" disabled={loading || saving} onClick={() => refresh(page.nextBefore ?? undefined)} className="w-full px-4 py-3 text-sm font-medium text-blue-600 disabled:opacity-50">Load earlier notifications</button>}
      </div>
      <p className="bg-slate-50 px-4 py-2 text-[11px] text-slate-400">Updates every 30 seconds · Your own actions appear as read history</p>
    </section>}
  </div>;
}
