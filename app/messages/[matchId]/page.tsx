"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type Message = { id: string; senderUid: string; text: string; createdAt: string | null };
type Conversation = { matchId: string; other: SafeDiscoveryProfile; messages: Message[] };

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
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/match-actions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, action, reason: reportReason, details: reportDetails }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to complete action.");
      if (action === "report") {
        setShowReport(false); setReportDetails(""); setError("Report submitted for review. You can also block or unmatch this member.");
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
      <div><a className="message-back-link" href={`/connections/${matchId}`}>← Connection overview</a><span className="eyebrow">Safe Messaging · v0.10</span><h1>Conversation with {other.firstName}</h1><p className="lead">Messaging is available because interest was mutual. Keep contact details private until you are comfortable sharing them.</p></div>
      <div className="message-trust"><span><b>{other.authenticityScore}%</b><small>Authenticity</small></span><span><b>{other.compatibilityScore}%</b><small>Compatibility</small></span>{other.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}</div>
    </div></section>
    <section className="section message-section"><div className="container message-layout">
      <div className="card chat-card">
        {error && <p className="notice messaging-error">{error}</p>}
        <div className="chat-safety-note">AutoFace never reveals your email or mobile number through messaging. Block, report and unmatch remain available at any time.</div>
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
        <div className="card"><span className="privacy-kicker">YOUR CONTROLS</span><h2>Stay in control.</h2><p>These actions are enforced server-side and immediately affect messaging access.</p>
          <div className="safety-actions"><button className="btn btn-secondary" onClick={() => void matchAction("unmatch")} disabled={actionBusy}>Unmatch</button><button className="btn btn-secondary danger-button" onClick={() => void matchAction("block")} disabled={actionBusy}>Block member</button><button className="btn btn-secondary" onClick={() => setShowReport((v) => !v)} disabled={actionBusy}>Report</button></div>
          {showReport && <div className="report-panel"><label>Reason<select value={reportReason} onChange={(e) => setReportReason(e.target.value)}><option value="fake_identity">Fake identity / impersonation</option><option value="harassment">Harassment</option><option value="financial_request">Asked for money</option><option value="inappropriate_content">Inappropriate content</option><option value="spam">Spam</option><option value="other">Other</option></select></label><label>Optional details<textarea rows={4} maxLength={1000} value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} /></label><button className="btn btn-primary" onClick={() => void matchAction("report")} disabled={actionBusy}>Submit report</button></div>}
        </div>
        <div className="card"><span className="privacy-kicker">SAFETY REMINDER</span><h3>Keep early conversations here.</h3><p>Never send money or financial information to someone you have met through AutoFace. Identity verification confirms identity evidence, not somebody’s intentions.</p></div>
      </aside>
    </div></section>
  </main>;
}
