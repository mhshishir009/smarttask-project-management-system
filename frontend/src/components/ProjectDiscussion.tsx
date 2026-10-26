import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { LockKeyhole, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDiscussion, sendDiscussionMessage, type DiscussionPage, type ProjectMessage } from "../services/discussionApi";

interface Props { projectId: number; projectName: string; isArchived: boolean; onClose: () => void }

export default function ProjectDiscussion({projectId, projectName, isArchived, onClose}: Props) {
  const {user} = useAuth();
  const [page, setPage] = useState<DiscussionPage>({messages: [], nextBefore: null, isArchived});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [denied, setDenied] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const requests = useRef(new Set<AbortController>());
  const busy = useRef(false);

  const handleError = useCallback((value: unknown) => {
    if (axios.isCancel(value)) return;
    const status = axios.isAxiosError(value) ? value.response?.status : undefined;
    if (status === 403 || status === 404) {setDenied(true); setPage(previous => ({...previous, messages: [], nextBefore: null}));}
    if (status === 409) setPage(previous => ({...previous, isArchived: true}));
    setError(axios.isAxiosError(value) ? value.response?.data?.message || "Unable to reach the discussion. Please try again." : "Unable to load discussion.");
  }, []);

  const load = useCallback((before?: number) => {
    const request = new AbortController();
    requests.current.add(request);
    return getDiscussion(projectId, request.signal, before).then(result => {
      if (request.signal.aborted) return;
      setPage(previous => ({...result, messages: before === undefined ? result.messages :
        [...result.messages, ...previous.messages].filter((message, index, all) => all.findIndex(other => other.messageId === message.messageId) === index)}));
      setReady(true);
      setDenied(false);
      if (before === undefined) requestAnimationFrame(() => end.current?.scrollIntoView({block: "nearest"}));
    }).catch((value: unknown) => {if (!request.signal.aborted) handleError(value);})
      .finally(() => {requests.current.delete(request); if (!request.signal.aborted) setLoading(false);});
  }, [projectId, handleError]);

  useEffect(() => {
    void load();
    const pending = requests.current;
    return () => {pending.forEach(request => request.abort()); pending.clear();};
  }, [load]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy.current) onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      const outside = !panel.current?.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first || document.activeElement === panel.current)) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && (outside || document.activeElement === last || document.activeElement === panel.current)) {event.preventDefault(); first?.focus();}
    };
    document.addEventListener("keydown", keyboard);
    return () => {document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keyboard); previousFocus?.focus();};
  }, [onClose]);

  const refresh = (before?: number) => {if (loading || sending) return; setLoading(true); setError(""); setNotice(""); void load(before);};
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current || loading || !ready || denied || page.isArchived || !draft.trim() || draft.length > 2000) return;
    busy.current = true;
    setSending(true); setError(""); setNotice("");
    const request = new AbortController();
    requests.current.add(request);
    try {
      const message: ProjectMessage = await sendDiscussionMessage(projectId, draft.trim(), request.signal);
      if (request.signal.aborted) return;
      setPage(previous => ({...previous, messages: [...previous.messages, message]}));
      setDraft(""); setNotice("Message sent.");
      requestAnimationFrame(() => end.current?.scrollIntoView({block: "nearest", behavior: "smooth"}));
    } catch (value) {
      if (!request.signal.aborted) {handleError(value); setNotice("Your draft is preserved. If the request timed out, refresh before sending again to check whether it arrived.");}
    } finally {
      requests.current.delete(request); busy.current = false;
      if (!request.signal.aborted) {
        setSending(false);
        requestAnimationFrame(() => panel.current?.querySelector<HTMLTextAreaElement>("textarea:not(:disabled)")?.focus());
      }
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="discussion-title" className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><MessageSquare size={21} /></span><div className="min-w-0"><h2 id="discussion-title" className="text-lg font-bold text-slate-900">Project Discussion</h2><p className="truncate text-sm text-slate-500" title={projectName}>{projectName}</p></div></div>
        <button type="button" onClick={onClose} disabled={sending} aria-label="Close discussion" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <span>{page.isArchived ? "Archived project · Read only" : "Updates and questions for this project"}</span>
        <button type="button" disabled={loading || sending} onClick={() => refresh()} className="inline-flex items-center gap-1.5 font-medium text-blue-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh messages</button>
      </div>
      {error && <p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div aria-label="Discussion messages" aria-busy={loading} tabIndex={0} className="min-h-48 flex-1 space-y-4 overflow-y-auto p-5 sm:min-h-72">
        {page.nextBefore && <div className="text-center"><button type="button" disabled={loading || sending} onClick={() => refresh(page.nextBefore ?? undefined)} className="text-xs font-medium text-blue-600 disabled:opacity-50">Load earlier messages</button></div>}
        {loading && <p role="status" className="text-center text-sm text-slate-400">Loading messages…</p>}
        {!loading && ready && !denied && page.messages.length === 0 && <div className="py-8 text-center"><MessageSquare size={30} className="mx-auto text-blue-300" /><p className="mt-3 font-medium text-slate-700">No messages yet</p><p className="mt-1 text-sm text-slate-400">{page.isArchived ? "This archived project has no discussion history." : "Start the conversation with a project update or question."}</p></div>}
        {page.messages.map(message => <article key={message.messageId} className={`rounded-xl border p-3.5 ${message.authorId === user?.userId ? "ml-6 border-blue-100 bg-blue-50" : "mr-6 border-slate-100 bg-slate-50"}`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="break-words text-sm font-semibold text-slate-800">{message.authorName}{message.authorId === user?.userId && " (you)"}</span><time dateTime={message.createdAt} className="text-xs text-slate-400">{new Date(message.createdAt).toLocaleString()}</time></div>
          {/* Render user messages as plain text; never interpret markup or HTML. */}
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.body}</p>
        </article>)}
        <div ref={end} />
      </div>
      {page.isArchived ? <p className="flex items-center gap-2 border-t border-slate-100 p-5 text-sm text-slate-500"><LockKeyhole size={16} />Archived discussions are read-only.</p> : <form onSubmit={event => void submit(event)} className="border-t border-slate-100 p-5">
        <label htmlFor="discussion-message" className="mb-2 block text-sm font-medium text-slate-700">Your message</label>
        <textarea id="discussion-message" rows={3} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} disabled={sending || denied || !ready} placeholder="Share an update or ask your team a question…" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50" />
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{draft.length}/2000 characters</span><button type="submit" disabled={sending || loading || !ready || denied || !draft.trim()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Send size={15} />{sending ? "Sending…" : "Send message"}</button></div>
      </form>}
      {notice && <p role="status" className="px-5 pb-4 text-xs text-slate-500">{notice}</p>}
    </div>
  </div>;
}
