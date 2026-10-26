import type { ReactNode } from "react";
import { ArrowUpRight, Check, ClipboardCheck, FolderKanban, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
import "./auth.css";

type AuthMode = "login" | "register" | "security";
interface Props {mode: AuthMode; title: string; description: string; children: ReactNode}

const content = {
  login: {eyebrow: "A LITTLE LESS CHAOS. A LOT MORE CLARITY.", first: "Good work starts", accent: "with a clear plan.", description: "Bring your projects, people, and next steps together. Make room for the work that matters.", label: "Sign in to your workspace", note: "Your team. Your projects. One shared direction."},
  register: {eyebrow: "MAKE SPACE FOR YOUR NEXT BIG IDEA.", first: "One team.", accent: "A clearer way forward.", description: "Join your workspace, find your next task, and keep the conversation moving. Great work is a team effort.", label: "Create your SmartTask account", note: "A fresh start for your team's next chapter."},
  security: {eyebrow: "A SMALL STEP FOR A SAFER WORKSPACE.", first: "Your work matters.", accent: "Keep it protected.", description: "Give your account a fresh password, then get back to your projects with a little more peace of mind.", label: "Account security", note: "A new password. The same workspace."},
} as const;

// Presentation only: the three pages retain their own state, validation and API handlers.
export default function AuthShell({mode, title, description, children}: Props) {
  const copy = content[mode];
  return <main className={`auth-screen auth-screen--${mode}`}>
    <div className="auth-frame">
      <aside className="auth-story" aria-label="About SmartTask">
        <div className="auth-brand"><span className="auth-brand-icon"><ClipboardCheck size={27} strokeWidth={1.8} /></span><div><span className="auth-brand-name">SmartTask<span className="auth-brand-dot">.</span></span><span className="auth-brand-caption">PROJECT MANAGEMENT, TOGETHER</span></div></div>
        <div className="auth-story-copy"><p className="auth-eyebrow">{copy.eyebrow}</p><h2>{copy.first}<br /><span>{copy.accent}</span></h2><p className="auth-story-description">{copy.description}</p></div>
        {mode === "security" ? <div className="auth-security-visual" aria-hidden="true">
          <div className="auth-shield-orbit"><div className="auth-shield-inner"><ShieldCheck size={54} strokeWidth={1.4} /></div><span className="auth-orbit-check"><Check size={15} /></span></div>
          <div className="auth-security-steps"><span><Check size={14} />12+ characters</span><span><Check size={14} />A different password</span><span><Check size={14} />A fresh sign in</span></div>
        </div> : <div className="auth-workspace-visual" aria-hidden="true">
          <div className="auth-board-heading"><div className="auth-board-dots"><i /><i /><i /></div><span>THE BIG PICTURE</span><ArrowUpRight size={15} /></div>
          <div className="auth-board-body"><div className="auth-board-topline"><span className="auth-board-mark"><FolderKanban size={18} /></span><div><strong>From idea to done.</strong><small>A place for every next step</small></div><span className="auth-live-dot" /></div>
            <div className="auth-board-columns"><div><span className="auth-column-title">PLAN</span><div className="auth-mini-card"><span className="auth-mini-label">PROJECTS</span><strong>See the whole picture</strong><div className="auth-mini-lines"><i /><i /></div><span className="auth-mini-tag">Clear direction</span></div></div><div><span className="auth-column-title">COLLABORATE</span><div className="auth-mini-card auth-mini-card--blue"><MessageSquare size={19} /><strong>Keep everyone in sync</strong><span className="auth-mini-tag">One conversation</span></div></div></div>
            <div className="auth-board-complete"><span><Check size={13} /></span><p>Small steps. Meaningful progress.</p><div className="auth-avatar-stack"><i>ST</i><i>+ </i></div></div>
          </div>
          <span className="auth-visual-caption">A glimpse of a more organized workday</span>
        </div>}
        <div className="auth-story-footer"><span className="auth-footer-line" /><p>{copy.note}</p><span>SMARTTASK / WORK BETTER</span></div>
      </aside>
      <section className="auth-surface" aria-labelledby="auth-title">
        <div className="auth-form-topline"><span className="auth-form-section"><span />{mode === "security" ? "SECURE YOUR ACCOUNT" : "WELCOME TO YOUR WORKSPACE"}</span><LockKeyhole size={15} aria-hidden="true" /></div>
        <div className="auth-form-content">
          <div className="auth-form-intro"><p className="auth-form-kicker">{copy.label}</p><h1 id="auth-title">{title}</h1><p>{description}</p></div>
          {children}
        </div>
        <p className="auth-form-footnote"><ShieldCheck size={13} aria-hidden="true" />Built for focused work and connected teams.</p>
      </section>
    </div>
  </main>;
}
