"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type Message = { id: string; senderUid: string; text: string; createdAt: string | null };
type Conversation = { matchId: string; other: SafeDiscoveryProfile; messages: Message[] };
type CoachStarter = { theme:string; question:string; basis:"shared_theme"|"discussion_point" };
type CoachResult = { intro:string; starters:CoachStarter[] };

export default function MessagePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = String(params.matchId ?? "");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Conversation | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("fake_identity");
  const [reportDetails, setReportDetails] = useState("");
  const [blockAfterReport, setBlockAfterReport] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [coachStatus, setCoachStatus] = useState<{enabled:boolean;viewerOptIn:boolean;otherOptIn:boolean;available:boolean}|null>(null);
  const [coach, setCoach] = useState<CoachResult|null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachConsent, setCoachConsent] = useState(false);
  const [coachError, setCoachError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) router.replace("/sign-in"); }, [loading, user, router]);

  const load = useCallback(async (quiet = false) => {
    if (!user || !matchId) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const body = await response.json().catch(() => ({ error: `Messages request failed (${response.status})` }));
      if (!response.ok) throw new Error(body.error ?? "Unable to load messages.");
      setData(body);
      setError("");
      if (!quiet) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages.");
    }
  }, [user, matchId]);

  useEffect(() => {
    if (!user) return;
    void load();
    const timer = window.setInterval(() => void load(true), 4000);
    return () => window.clearInterval(timer);
  }, [user, load]);

  useEffect(() => {
    if (!user || !matchId) return;
    const current = user;
    (async () => {
      try {
        const token = await current.getIdToken();
        const response = await fetch(`/api/atlas-ai/introduction-coach?matchId=${encodeURIComponent(matchId)}`, { headers:{Authorization:`Bearer ${token}`}, cache:"no-store" });
        const body = await response.json().catch(() => ({}));
        if (response.ok) setCoachStatus(body);
      } catch { setCoachStatus(null); }
    })();
  }, [user, matchId]);

  async function generateCoach() {
    if (!user || !coachConsent || coachBusy) return;
    const current = user;
    try {
      setCoachBusy(true); setCoachError("");
      const token = await current.getIdToken();
      const response = await fetch("/api/atlas-ai/introduction-coach", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({matchId,consent:true}) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to generate conversation starters.");
      setCoach(body.coach ?? null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to generate conversation starters.";
      setCoachError(
        raw === "ATLAS_AI_TIMEOUT" || /operation was aborted/i.test(raw)
          ? "Atlas is taking longer than expected. Please try again."
          : raw.startsWith("ATLAS_AI_INVALID_") || raw === "ATLAS_AI_EMPTY_RESPONSE"
            ? "Gemini could not produce a valid set of conversation starters. Please try again."
            : raw,
      );
    }
    finally { setCoachBusy(false); }
  }

  function useStarter(question:string) {
    setText(question);
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".message-composer textarea")?.focus(), 20);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!user || !text.trim() || sending) return;
    setSending(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, text }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to send message.");
      setText("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); }
    finally { setSending(false); }
  }

  async function matchAction(action: "unmatch" | "block" | "report") {
    if (!user || actionBusy) return;
    if (action === "unmatch" && !window.confirm("End this introduction? Messaging will stop for both people.")) return;
    if (action === "block" && !window.confirm("Block this member? They will no longer be able to message you.")) return;
    setActionBusy(true);
    setStatusMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/match-actions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, action, reason: reportReason, details: reportDetails, blockAfterReport }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to complete action.");
      if (action === "report") {
        setShowReport(false);
        setReportDetails("");
        if (body.blocked) {
          router.replace("/introductions");
        } else {
          setStatusMessage("Report submitted to AutoFace Safety Operations for human review.");
        }
      } else {
        router.replace("/introductions");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete action."); }
    finally { setActionBusy(false); }
  }

  if (loading || !user || !data) return <main><section className="section"><div className="container"><p className="muted">Loading secure conversation…</p>{error && <p className="notice messaging-error">{error}</p>}</div></section></main>;
  const other = data.other;

  return <main>
    <section className="page-hero compact-hero"><div className="container message-hero-row">
      <div><a className="message-back-link" href={`/connections/${matchId}`}>← Connection overview</a><span className="eyebrow">Safe Messaging</span><h1>Conversation with {other.firstName}</h1><p className="lead">Messaging is available because interest was mutual. Keep contact details private until you are comfortable sharing them.</p></div>
      <div className="message-trust"><span><b>{other.authenticityScore}%</b><small>Authenticity</small></span><span><b>{other.compatibilityScore}%</b><small>Compatibility</small></span>{other.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}</div>
    </div></section>
    <section className="section message-section"><div className="container message-layout">
      <div className="card chat-card">
        {error && <p className="notice messaging-error">{error}</p>}
        {statusMessage && <p className="notice safety-success">{statusMessage}</p>}
        <div className="chat-safety-note">AutoFace never reveals your email or mobile number through messaging. Block, report and unmatch remain available at any time.</div>
        <div className="atlas-coach">
          <div className="atlas-coach-head"><span className="atlas-coach-orb">✦</span><div><small>ATLAS INTRODUCTION COACH</small><h2>Need a way to start?</h2><p>Optional Gemini-generated conversation starters based on the relationship themes you both chose to share.</p></div></div>
          {!coachStatus?.enabled ? <div className="coach-note">Atlas Introduction Coach is currently disabled.</div>
          : !coachStatus.viewerOptIn ? <div className="coach-note">Enable Atlas AI Discovery in your Atlas Profile to use Introduction Coach.</div>
          : !coachStatus.otherOptIn ? <div className="coach-note">Introduction Coach is unavailable because {other.firstName} has not opted in to Gemini comparison.</div>
          : coach ? <div className="coach-results"><p>{coach.intro}</p><div className="coach-starters">{coach.starters.map((starter,index)=><div className="coach-starter" key={`${starter.theme}-${index}`}><div><small>{starter.basis==="discussion_point"?"WORTH EXPLORING":"SHARED THEME"}</small><b>{starter.theme}</b></div><blockquote>“{starter.question}”</blockquote><button type="button" className="btn" onClick={()=>useStarter(starter.question)}>Use this question</button></div>)}</div><button type="button" className="coach-regenerate" onClick={()=>void generateCoach()} disabled={coachBusy}>{coachBusy?"Generating… please wait":"Show me another set"}</button></div>
          : <div className="coach-ready"><label className="consent-card"><input type="checkbox" checked={coachConsent} onChange={(e)=>setCoachConsent(e.target.checked)}/><span><b>Generate conversation starters with Gemini</b><small>Both members have opted in. The starters are generated for you, are not saved, and nothing is sent until you choose and send it yourself.</small></span></label><button type="button" className="btn btn-primary" disabled={!coachConsent||coachBusy} onClick={()=>void generateCoach()}>{coachBusy?"Atlas is thinking… this can take up to 45 seconds":"Suggest conversation starters"}</button></div>}
          {coachError&&<p className="notice">{coachError}</p>}
          <p className="atlas-disclaimer">Atlas can suggest a question, but you stay in control. “Use this question” only places text in the composer — it never sends automatically.</p>
        </div>
        <div className="message-list">
          {data.messages.length === 0 && <div className="message-empty"><h2>Start the conversation</h2><p>You both chose to be introduced. A simple hello is enough.</p></div>}
          {data.messages.map((message, index) => {
            const mine = message.senderUid === user.uid;
            const currentDate = message.createdAt ? new Date(message.createdAt) : null;
            const previous = index > 0 ? data.messages[index - 1] : null;
            const previousDate = previous?.createdAt ? new Date(previous.createdAt) : null;
            const showDate = currentDate && (!previousDate || currentDate.toDateString() !== previousDate.toDateString());
            const today = currentDate && currentDate.toDateString() === new Date().toDateString();
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterday = currentDate && currentDate.toDateString() === yesterdayDate.toDateString();
            const dateLabel = currentDate ? (today ? "Today" : yesterday ? "Yesterday" : currentDate.toLocaleDateString()) : "";
            const senderLabel = mine ? "You" : `${other.firstName}${other.isTestProfile ? " [TEST]" : ""}`;
            const initial = mine ? "Y" : (other.firstName?.charAt(0).toUpperCase() || "?");

            return <div key={message.id}>
              {showDate && <div className="message-date-divider"><span>{dateLabel}</span></div>}
              <div className={`message-row ${mine ? "mine" : "theirs"}`}>
                {!mine && <div className="message-avatar" aria-hidden="true">{initial}</div>}
                <div className={`message-bubble ${mine ? "mine" : "theirs"}`}>
                  <div className="message-sender">{senderLabel}</div>
                  <p>{message.text}</p>
                  <small>{currentDate ? currentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Sending…"}</small>
                </div>
                {mine && <div className="message-avatar mine-avatar" aria-hidden="true">{initial}</div>}
              </div>
            </div>;
          })}
          <div ref={bottomRef} />
        </div>
        <form className="message-composer" onSubmit={send}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Message ${other.firstName}…`} rows={3} />
          <div className="composer-footer"><small>{text.length}/1000</small><button className="btn btn-primary" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send message"}</button></div>
        </form>
      </div>
      <aside className="message-side">
        <div className="card safety-control-card">
          <span className="privacy-kicker">YOUR SAFETY CONTROLS</span>
          <h2>Stay in control.</h2>
          <p>Blocking and reporting are enforced server-side. The other member is not told who submitted a report.</p>

          <div className="safety-actions">
            <button className="btn btn-secondary" onClick={() => void matchAction("unmatch")} disabled={actionBusy}>End introduction</button>
            <button className="btn btn-secondary danger-button" onClick={() => void matchAction("block")} disabled={actionBusy}>Block member</button>
            <button className={`btn btn-secondary ${showReport ? "report-open" : ""}`} onClick={() => setShowReport((v) => !v)} disabled={actionBusy}>
              {showReport ? "Cancel report" : "Report member"}
            </button>
          </div>

          {showReport && (
            <div className="report-panel member-report-panel">
              <div className="report-panel-head">
                <span className="privacy-kicker">REPORT {other.firstName.toUpperCase()}</span>
                <h3>Tell AutoFace what happened.</h3>
                <p>Reports go to the human Safety Operations queue. AutoFace does not automatically suspend someone because a report was submitted.</p>
              </div>

              <label>
                <span>Reason</span>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  <option value="fake_identity">Fake identity / impersonation</option>
                  <option value="harassment">Harassment</option>
                  <option value="financial_request">Asked for money</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="spam">Spam</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                <span>What would help the safety team understand? · optional</span>
                <textarea
                  rows={5}
                  maxLength={1000}
                  placeholder="Describe the behaviour you are reporting. Do not include unnecessary sensitive information."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
                <small>{reportDetails.length}/1000</small>
              </label>

              <label className="report-block-choice">
                <input
                  type="checkbox"
                  checked={blockAfterReport}
                  onChange={(e) => setBlockAfterReport(e.target.checked)}
                />
                <span>
                  <b>Also block {other.firstName}</b>
                  <small>Recommended if you do not want any further contact. Blocking closes this conversation immediately.</small>
                </span>
              </label>

              <div className="report-privacy-note">
                <b>Privacy boundary</b>
                <span>Your report reason and the details you enter above are sent to Safety Operations. v0.14.1 does not automatically copy your private conversation history into the report.</span>
              </div>

              <button className="btn btn-relationship" onClick={() => void matchAction("report")} disabled={actionBusy}>
                {actionBusy ? "Submitting…" : blockAfterReport ? "Submit report & block" : "Submit report"}
              </button>
            </div>
          )}
        </div>
        <div className="card"><span className="privacy-kicker">SAFETY REMINDER</span><h3>Keep early conversations here.</h3><p>Never send money or financial information to someone you have met through AutoFace. Identity verification confirms identity evidence, not somebody’s intentions.</p></div>
      </aside>
    </div></section>
  </main>;
}
