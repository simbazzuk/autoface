"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { relationshipIntentLabels } from "@/lib/profile";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type DiscoveryResponse = { eligible: boolean; candidates: SafeDiscoveryProfile[]; preferences?: unknown; curation?: {mode:"daily";limit:number;available:number}; error?: string };
type AiStatus = { enabled:boolean; viewerOptIn:boolean; candidateOptIn:boolean; available:boolean };

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [busyUid, setBusyUid] = useState("");
  const [message, setMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [aiStatuses, setAiStatuses] = useState<Record<string,AiStatus>>({});
  const isTestProfile = Boolean(user?.email?.endsWith("@autoface.test"));

  useEffect(() => { if (!loading && !user) router.replace("/sign-in"); }, [loading, user, router]);
  async function load(signal?: AbortSignal) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/discovery", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({ error: `Discovery request failed (${res.status})` }));
      if (!res.ok) throw new Error(body.error ?? `Discovery request failed (${res.status})`);
      setData(body);
      setMessage("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "Unable to load Discovery.");
      setData({ eligible: false, candidates: [] });
    }
  }
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [user]);

  useEffect(() => {
    if (!user || !data?.candidates?.length) {
      setAiStatuses({});
      return;
    }
    const current = user;
    (async () => {
      try {
        const token = await current.getIdToken();
        const response = await fetch("/api/atlas-ai/discovery-status", {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
          body: JSON.stringify({ candidateUids: data.candidates.map((candidate) => candidate.uid) }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.ok) setAiStatuses(body.statuses ?? {});
      } catch {
        setAiStatuses({});
      }
    })();
  }, [user, data?.candidates]);

  async function resetDemoRecommendations() {
    if (!user || resetBusy) return;
    const current = user;
    try {
      setResetBusy(true);
      setMessage("");
      const token = await current.getIdToken();
      const response = await fetch("/api/demo/recommendations/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to reset demo recommendations.");
      setMessage(body.skippedMutual
        ? `Reset ${body.reset} demo decision(s). ${body.skippedMutual} mutual introduction(s) were preserved.`
        : `Reset ${body.reset} demo recommendation decision(s).`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to reset demo recommendations.");
    } finally {
      setResetBusy(false);
    }
  }

  async function decide(toUid: string, action: "interested" | "saved" | "pass") {
    if (!user || busyUid) return;
    setBusyUid(toUid); setMessage("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/interests", { method: "POST", headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify({ toUid, action }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Unable to save your choice.");
      setMessage(body.matched
        ? "It’s mutual — you now have an introduction."
        : action === "interested"
          ? "Interest saved privately. They are only notified as a match if interest becomes mutual."
          : action === "saved"
            ? "Saved for later. No interest has been sent and they are not notified."
            : "Profile passed. It will not be shown again.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save your choice."); }
    finally { setBusyUid(""); }
  }

  if (loading || !user || !data) return <main><section className="section"><div className="container"><p className="muted">Preparing private recommendations…</p></div></section></main>;

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Atlas Daily Discovery</span>
      <h1>Three people worth considering. Not an endless queue.</h1>
      <p className="lead">Atlas starts with your hard preferences, ranks the eligible pool deterministically, and shows up to three considered introductions at a time so you can focus on quality rather than swiping volume.</p>
    </div></section>
    <section className="section discovery-section"><div className="container"><div className="discovery-toolbar">
        <div><span className="privacy-kicker">TODAY&apos;S ATLAS PICKS</span><p>Eligibility → preferences → deterministic ranking → up to 3 considered introductions</p></div>
        <div className="discovery-toolbar-actions"><a className="btn" href="/recommendations/history">Reviewed recommendations</a><a className="btn" href="/discovery-preferences">Discovery preferences</a></div>
      </div>
      {!data.eligible ? <div className="card discovery-empty"><span className="privacy-kicker">DISCOVERY LOCKED</span><h2>Finish the trust foundation first</h2><p>To enter Discovery, set your profile visibility to <b>Future matches</b>, keep compatibility consent enabled, and have at least 50% authenticity.</p><div className="hero-actions left-actions"><a className="btn btn-primary" href="/profile">Update profile visibility</a><a className="btn" href="/dashboard">Check authenticity</a></div></div>
      : data.candidates.length === 0 ? <div className="card discovery-empty"><span className="privacy-kicker">YOU’RE READY</span><h2>No new introductions yet</h2><p>Your profile is eligible for Discovery. AutoFace found no other eligible members that you have not already reviewed.</p><div className="discovery-empty-actions"><a className="btn btn-primary" href="/recommendations/history">View reviewed recommendations</a><a className="btn" href="/compatibility">Open Compatibility Lab</a>{isTestProfile&&<button className="btn demo-reset-button" disabled={resetBusy} onClick={()=>void resetDemoRecommendations()}>{resetBusy?"Resetting…":"Reset demo recommendations"}</button>}</div>{isTestProfile&&<p className="demo-reset-note">Test profiles only: reset removes your non-mutual review decisions so candidates can appear in Discover again. Existing mutual introductions are preserved.</p>}</div>
      : <div>
        <div className="daily-discovery-intro">
          <div><span className="privacy-kicker">QUALITY OVER QUANTITY</span><h2>Atlas selected {data.candidates.length} introduction{data.candidates.length===1?"":"s"} for you.</h2><p>These are the highest-ranked eligible people currently available under your Discovery preferences. A high score is a reason to look closer — never a prediction of relationship success.</p></div>
          <div className="daily-count"><b>{data.candidates.length}</b><span>of 3 today</span></div>
        </div>
        <div className="discovery-grid daily-discovery-grid">{data.candidates.map((c,index) => <article className="card discovery-card daily-discovery-card" key={c.uid}>
          <div className="daily-rank"><span>ATLAS PICK</span><b>{index+1} of {data.candidates.length}</b></div>
          {c.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}<div className="candidate-identity"><ProfilePhoto uid={c.uid} name={c.firstName} className="discovery-profile-photo"/><div><h2>{c.firstName}{c.age ? `, ${c.age}` : ""}</h2><p>{[c.generalLocation,c.occupation].filter(Boolean).join(" · ") || "Limited profile details"}</p></div></div>
          <div className="trust-pair"><span><b>{c.authenticityScore}%</b><small>Authenticity</small></span><span><b>{c.compatibilityScore}%</b><small>Compatibility</small></span></div>
          <div className="candidate-badges"><span>{c.authenticityLevel}</span><span>{c.compatibilityLevel} alignment</span><span>{relationshipIntentLabels[c.relationshipIntent]}</span></div>
          <p className="candidate-about">{c.aboutMe}</p>
          <div className="discovery-insights"><div><small>STRONG ALIGNMENTS</small><p>{c.strongestAlignments.length ? c.strongestAlignments.join(" · ") : "No dominant alignment"}</p></div><div><small>WORTH DISCUSSING</small><p>{c.conversationPoints.length ? c.conversationPoints.join(" · ") : "No major structured differences"}</p></div></div>
          <div className="why-atlas-card">
            <span className="why-atlas-icon">✦</span>
            <div><small>WHY ATLAS SHOWED YOU {c.firstName.toUpperCase()}</small><p>{c.strongestAlignments.length ? `Strongest current alignment: ${c.strongestAlignments.slice(0,2).join(" and ")}.` : "This profile passed your hard preferences and ranked highly on structured compatibility."}</p></div>
          </div>
          {aiStatuses[c.uid]?.available && <a className="ai-discovery-teaser" href={`/recommendations/${c.uid}`}>
            <span className="ai-teaser-orb">✦</span>
            <span><small>ATLAS AI DISCOVERY AVAILABLE</small><b>Go beyond the score with {c.firstName}</b><em>Gemini can uncover shared themes in your opted-in relationship answers.</em></span>
            <strong>Explore →</strong>
          </a>}
          {aiStatuses[c.uid]?.enabled && aiStatuses[c.uid]?.viewerOptIn && !aiStatuses[c.uid]?.candidateOptIn && <div className="ai-discovery-teaser muted-teaser">
            <span className="ai-teaser-orb">✦</span>
            <span><small>ATLAS AI DISCOVERY</small><b>Semantic insight not available</b><em>{c.firstName} has not opted in to Gemini comparison.</em></span>
          </div>}
          <a className="recommendation-detail-link" href={`/recommendations/${c.uid}`}>View recommendation details →</a>
          <div className="discovery-actions thoughtful-actions">
            <button className="btn" disabled={Boolean(busyUid)} onClick={() => decide(c.uid,"pass")}>Not for me</button>
            <button className="btn save-later-button" disabled={Boolean(busyUid)} onClick={() => decide(c.uid,"saved")}>♡ Save for later</button>
            <button className="btn btn-relationship" disabled={Boolean(busyUid)} onClick={() => decide(c.uid,"interested")}>Interested</button>
          </div>
          <p className="decision-reassurance">Saving is private. {c.firstName} is not notified unless you later choose Interested and it becomes mutual.</p>
        </article>)}</div>
        <div className="daily-discovery-footer"><span>That&apos;s today&apos;s current set.</span><p>Review them at your own pace. AutoFace does not reward rapid decisions or endless swiping.</p></div>
      </div>}
      {message && <p className="notice discovery-message">{message}</p>}
      <div className="card discovery-privacy"><span className="privacy-kicker">MUTUAL BY DESIGN</span><h3>No unsolicited messaging</h3><p>Expressing interest does not expose your email, mobile number or private Atlas answers. Communication remains locked until both people independently choose Interested.</p><a className="btn" href="/introductions">View mutual introductions</a></div>
    </div></section>
  </main>;
}
