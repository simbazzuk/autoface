"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { relationshipIntentLabels } from "@/lib/profile";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type DiscoveryResponse = { eligible: boolean; candidates: SafeDiscoveryProfile[]; preferences?: unknown; error?: string };

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [busyUid, setBusyUid] = useState("");
  const [message, setMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
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

  async function decide(toUid: string, action: "interested" | "pass") {
    if (!user || busyUid) return;
    setBusyUid(toUid); setMessage("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/interests", { method: "POST", headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify({ toUid, action }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Unable to save your choice.");
      setMessage(body.matched ? "It’s mutual — you now have an introduction." : action === "interested" ? "Interest saved privately. They are only notified as a match if interest becomes mutual." : "Profile passed. It will not be shown again.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save your choice."); }
    finally { setBusyUid(""); }
  }

  if (loading || !user || !data) return <main><section className="section"><div className="container"><p className="muted">Preparing private recommendations…</p></div></section></main>;

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Discovery</span>
      <h1>Introductions, not endless swiping.</h1>
      <p className="lead">Your hard preferences define the eligible pool. Atlas ranks eligible members deterministically. On recommendation details, opted-in members can also use Atlas AI Discovery to uncover semantic themes Gemini notices in their relationship answers.</p>
    </div></section>
    <section className="section discovery-section"><div className="container"><div className="discovery-toolbar">
        <div><span className="privacy-kicker">ATLAS RECOMMENDATIONS</span><p>Eligibility → preferences → deterministic ranking → optional AI insight</p></div>
        <div className="discovery-toolbar-actions"><a className="btn" href="/recommendations/history">Reviewed recommendations</a><a className="btn" href="/discovery-preferences">Discovery preferences</a></div>
      </div>
      {!data.eligible ? <div className="card discovery-empty"><span className="privacy-kicker">DISCOVERY LOCKED</span><h2>Finish the trust foundation first</h2><p>To enter Discovery, set your profile visibility to <b>Future matches</b>, keep compatibility consent enabled, and have at least 50% authenticity.</p><div className="hero-actions left-actions"><a className="btn btn-primary" href="/profile">Update profile visibility</a><a className="btn" href="/dashboard">Check authenticity</a></div></div>
      : data.candidates.length === 0 ? <div className="card discovery-empty"><span className="privacy-kicker">YOU’RE READY</span><h2>No new introductions yet</h2><p>Your profile is eligible for Discovery. AutoFace found no other eligible members that you have not already reviewed.</p><div className="discovery-empty-actions"><a className="btn btn-primary" href="/recommendations/history">View reviewed recommendations</a><a className="btn" href="/compatibility">Open Compatibility Lab</a>{isTestProfile&&<button className="btn demo-reset-button" disabled={resetBusy} onClick={()=>void resetDemoRecommendations()}>{resetBusy?"Resetting…":"Reset demo recommendations"}</button>}</div>{isTestProfile&&<p className="demo-reset-note">Test profiles only: reset removes your non-mutual review decisions so candidates can appear in Discover again. Existing mutual introductions are preserved.</p>}</div>
      : <div className="discovery-grid">{data.candidates.map((c) => <article className="card discovery-card" key={c.uid}>
          {c.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}<div className="candidate-identity"><div className="profile-placeholder">{c.firstName.slice(0,1).toUpperCase()}</div><div><h2>{c.firstName}{c.age ? `, ${c.age}` : ""}</h2><p>{[c.generalLocation,c.occupation].filter(Boolean).join(" · ") || "Limited profile details"}</p></div></div>
          <div className="trust-pair"><span><b>{c.authenticityScore}%</b><small>Authenticity</small></span><span><b>{c.compatibilityScore}%</b><small>Compatibility</small></span></div>
          <div className="candidate-badges"><span>{c.authenticityLevel}</span><span>{c.compatibilityLevel} alignment</span><span>{relationshipIntentLabels[c.relationshipIntent]}</span></div>
          <p className="candidate-about">{c.aboutMe}</p>
          <div className="discovery-insights"><div><small>STRONG ALIGNMENTS</small><p>{c.strongestAlignments.length ? c.strongestAlignments.join(" · ") : "No dominant alignment"}</p></div><div><small>WORTH DISCUSSING</small><p>{c.conversationPoints.length ? c.conversationPoints.join(" · ") : "No major structured differences"}</p></div></div>
          <a className="recommendation-detail-link" href={`/recommendations/${c.uid}`}>View recommendation details →</a><div className="discovery-actions"><button className="btn" disabled={Boolean(busyUid)} onClick={() => decide(c.uid,"pass")}>Not for me</button><button className="btn btn-relationship" disabled={Boolean(busyUid)} onClick={() => decide(c.uid,"interested")}>Interested</button></div>
        </article>)}</div>}
      {message && <p className="notice discovery-message">{message}</p>}
      <div className="card discovery-privacy"><span className="privacy-kicker">MUTUAL BY DESIGN</span><h3>No unsolicited messaging</h3><p>Expressing interest does not expose your email, mobile number or private Atlas answers. Communication remains locked until both people independently choose Interested.</p><a className="btn" href="/introductions">View mutual introductions</a></div>
    </div></section>
  </main>;
}
