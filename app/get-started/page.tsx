"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type Step = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
};

type Readiness = {
  firstName: string;
  authenticityScore: number;
  authenticityLevel: string;
  steps: Step[];
  completed: number;
  total: number;
  readyForDiscovery: boolean;
  activeIntroductions: number;
};

export default function GetStartedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState<"idea"|"problem"|"confusing"|"positive">("idea");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/readiness", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load your setup progress.");
      setData(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your setup progress.");
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    if (!user || sending || feedback.trim().length < 3) return;
    try {
      setSending(true);
      setSent(false);
      const token = await user.getIdToken();
      const response = await fetch("/api/beta-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, message: feedback }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to send feedback.");
      setFeedback("");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send feedback.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !user || !data) {
    return <main><section className="section"><div className="container"><p className="muted">Preparing your AutoFace setup…</p>{error && <p className="notice">{error}</p>}</div></section></main>;
  }

  const percent = Math.round((data.completed / data.total) * 100);
  const nextStep = data.steps.find((step) => !step.complete);

  return <main>
    <section className="page-hero compact-hero beta-hero"><div className="container">
      <span className="eyebrow">Beta Readiness · v0.15</span>
      <h1>{data.readyForDiscovery ? `You're ready, ${data.firstName}.` : `Let's get you ready, ${data.firstName}.`}</h1>
      <p className="lead">A guided setup for the parts of AutoFace that matter before meaningful recommendations begin.</p>
    </div></section>

    <section className="section beta-readiness-section"><div className="container beta-readiness-layout">
      <div className="beta-readiness-main">
        {error && <p className="notice">{error}</p>}

        <div className="card readiness-overview">
          <div className="readiness-head">
            <div><span className="privacy-kicker">YOUR SETUP</span><h2>{data.completed} of {data.total} steps complete</h2></div>
            <strong>{percent}%</strong>
          </div>
          <div className="readiness-meter"><span style={{width:`${percent}%`}} /></div>
          <p>{data.readyForDiscovery ? "Your trust, profile and preferences are ready for Discovery." : "Complete the remaining steps in your own time. AutoFace will not make your profile discoverable until you choose to enable it."}</p>
          {nextStep && <a className="btn btn-primary" href={nextStep.href}>Continue: {nextStep.title}</a>}
          {data.readyForDiscovery && <a className="btn btn-relationship" href="/discover">Open Discover</a>}
        </div>

        <div className="card setup-card">
          <span className="privacy-kicker">GET STARTED</span>
          <h2>Your AutoFace checklist</h2>
          <div className="setup-list">
            {data.steps.map((step,index) => <a key={step.id} href={step.href} className={`setup-step ${step.complete ? "complete" : ""}`}>
              <span>{step.complete ? "✓" : index + 1}</span>
              <div><b>{step.title}</b><small>{step.description}</small></div>
              <strong>{step.complete ? "DONE" : "OPEN →"}</strong>
            </a>)}
          </div>
        </div>

        <div className="card beta-principles">
          <span className="privacy-kicker">BEFORE YOU START</span>
          <h2>What AutoFace will — and won't — do.</h2>
          <div className="beta-principle-grid">
            <div><b>Recommendations, not decisions</b><span>Atlas explains deterministic compatibility. You decide who interests you.</span></div>
            <div><b>Mutual introductions</b><span>Messaging only opens after both people independently express interest.</span></div>
            <div><b>Authenticity is separate</b><span>Verification evidence controls trust eligibility; it is not added to compatibility.</span></div>
            <div><b>Safety is human-led</b><span>Reports go to Safety Operations. Gemini does not suspend or judge members.</span></div>
          </div>
        </div>
      </div>

      <aside className="beta-readiness-side">
        <div className="card readiness-side-card">
          <span className="privacy-kicker">TRUST SNAPSHOT</span>
          <div className="readiness-auth-score">{data.authenticityScore}%</div>
          <b>{data.authenticityLevel}</b>
          <p>Authenticity evidence is independent from compatibility scoring.</p>
          <a className="btn" href="/dashboard">Authenticity Centre</a>
        </div>

        <div className="card readiness-side-card">
          <span className="privacy-kicker">CONNECTIONS</span>
          <div className="readiness-auth-score">{data.activeIntroductions}</div>
          <b>Active introductions</b>
          <p>Only mutual interest becomes an introduction.</p>
          <a className="btn" href="/introductions">View introductions</a>
        </div>

        <form className="card beta-feedback-card" onSubmit={submitFeedback}>
          <span className="privacy-kicker">BETA FEEDBACK</span>
          <h3>Help shape AutoFace.</h3>
          <p>If something feels confusing, unsafe, unnecessary or especially useful, tell us here.</p>
          <label>Feedback type
            <select value={category} onChange={(e)=>setCategory(e.target.value as typeof category)}>
              <option value="idea">Idea</option>
              <option value="problem">Problem</option>
              <option value="confusing">Confusing</option>
              <option value="positive">Working well</option>
            </select>
          </label>
          <label>Your feedback
            <textarea rows={5} maxLength={1200} value={feedback} onChange={(e)=>setFeedback(e.target.value)} placeholder="What happened, or what would make this clearer?" />
            <small>{feedback.length}/1200</small>
          </label>
          <button className="btn btn-primary" disabled={sending || feedback.trim().length < 3}>{sending ? "Sending…" : "Send feedback"}</button>
          {sent && <div className="beta-feedback-sent">✓ Thank you — feedback received.</div>}
        </form>
      </aside>
    </div></section>
  </main>;
}
