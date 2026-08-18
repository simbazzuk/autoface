"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { MemberJourney } from "@/components/MemberJourney";
import { relationshipIntentLabels } from "@/lib/profile";
import { BriefcaseBusiness, CircleUserRound, GraduationCap, HandHeart, Leaf, Sparkles } from "lucide-react";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type DiscoveryResponse = { eligible: boolean; candidates: SafeDiscoveryProfile[]; preferences?: unknown; curation?: {mode:"daily";limit:number;available:number;skippedStaleProfiles?:number}; error?: string };
type AiStatus = { enabled:boolean; viewerOptIn:boolean; candidateOptIn:boolean; available:boolean };
type SetupReadiness={steps:Array<{id:string;title:string;complete:boolean;href:string}>;readyForDiscovery:boolean;authenticityScore:number;setupPercent:number};

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [busyUid, setBusyUid] = useState("");
  const [message, setMessage] = useState("");
  const [loadError,setLoadError]=useState<{code:string;message:string}|null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [aiStatuses, setAiStatuses] = useState<Record<string,AiStatus>>({});
  const [setup,setSetup]=useState<SetupReadiness|null>(null);
  const [developmentTools,setDevelopmentTools]=useState(false);
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
      if (!res.ok) {
        setLoadError({code:String(body.code??"DISCOVERY_ERROR"),message:String(body.error??`Discovery request failed (${res.status})`)});
        setData({eligible:false,candidates:[]});
        setMessage("");
        return;
      }
      setData(body);
      setLoadError(null);
      setMessage("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError({code:"DISCOVERY_ERROR",message:error instanceof Error ? error.message : "Unable to load Discovery."});
      setData({ eligible: false, candidates: [] });
      setMessage("");
    }
  }
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [user]);
  useEffect(()=>{
    if(!user)return;
    let active=true;
    (async()=>{try{const token=await user.getIdToken();const response=await fetch("/api/readiness",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});if(response.ok&&active)setSetup(await response.json())}catch{}})();
    return()=>{active=false};
  },[user]);
  useEffect(()=>{
    if(!user||process.env.NODE_ENV==="production"){setDevelopmentTools(false);return}
    let active=true;
    (async()=>{try{
      const token=await user.getIdToken();
      const response=await fetch("/api/dev/status",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      if(active)setDevelopmentTools(response.ok&&Boolean((await response.json()).developmentTools));
    }catch{if(active)setDevelopmentTools(false)}})();
    return()=>{active=false};
  },[user]);

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
      {loadError ? <div className="card discovery-empty discovery-account-error">
        <span className="privacy-kicker">{loadError.code==="ACCOUNT_RECORD_MISSING"?"ACCOUNT SESSION NEEDS ATTENTION":"DISCOVERY TEMPORARILY UNAVAILABLE"}</span>
        <h2>{loadError.code==="ACCOUNT_RECORD_MISSING"?"Your setup is complete — this is an account record issue.":"Atlas could not load Discovery."}</h2>
        <p>{loadError.message}</p>
        {loadError.code==="ACCOUNT_RECORD_MISSING"?<div className="discovery-empty-actions"><a className="btn btn-primary" href="/sign-out">Sign out</a><a className="btn" href="/sign-in">Sign in again</a></div>:<div className="discovery-empty-actions"><button className="btn btn-primary" onClick={()=>void load()}>Try again</button><a className="btn" href="/get-started">Open My Journey</a></div>}
        <p className="account-error-note">Your Profile, Atlas answers and preferences have not been changed by this error.</p>
      </div>
      : !data.eligible ? <div className="card discovery-empty discovery-guided-lock"><span className="privacy-kicker">ONE MORE STEP BEFORE DISCOVERY</span><h2>Atlas is not ready to introduce people yet.</h2><p>AutoFace only opens Discovery after the parts needed for a considered recommendation are complete. Finish the next item below and come back when you&apos;re ready.</p>
        {setup&&<div className="discover-readiness-list">{setup.steps.map(step=><a href={step.href} key={step.id} className={step.complete?"complete":""}><span>{step.complete?"✓":"○"}</span><b>{step.title}</b><small>{step.complete?"Complete":"Needs attention"}</small></a>)}</div>}
        <div className="hero-actions left-actions">{setup?.steps.find(step=>!step.complete)?<a className="btn btn-primary" href={setup.steps.find(step=>!step.complete)!.href}>Continue: {setup.steps.find(step=>!step.complete)!.title}</a>:<a className="btn btn-primary" href="/get-started">Open My Journey</a>}<a className="btn" href="/get-started">View setup</a></div>
      </div>
      : data.candidates.length === 0 ? <div className="card discovery-empty"><span className="privacy-kicker">YOU’RE READY</span><h2>No new introductions yet</h2><p>Your profile is eligible for Discovery. AutoFace found no other eligible members that you have not already reviewed.</p><div className="discovery-empty-actions"><a className="btn btn-primary" href="/recommendations/history">View reviewed recommendations</a><a className="btn" href="/compatibility">Open Compatibility Lab</a>{(isTestProfile||developmentTools)&&<button className="btn demo-reset-button" disabled={resetBusy} onClick={()=>void resetDemoRecommendations()}>{resetBusy?"Resetting…":"Reset reviewed profiles"}</button>}</div>{(isTestProfile||developmentTools)&&<p className="demo-reset-note">Development testing: reset clears your non-mutual Interested, Saved and Not for me decisions so synthetic profiles can appear in Discovery again. Existing mutual introductions are preserved.</p>}</div>
      : <div>
        {Boolean(data.curation?.skippedStaleProfiles)&&isTestProfile&&<p className="notice stale-profile-notice">Development note: {data.curation?.skippedStaleProfiles} stale test profile record(s) were ignored because they are no longer eligible or no longer have an Authentication account.</p>}
        <div className="daily-discovery-intro">
          <div><span className="privacy-kicker">QUALITY OVER QUANTITY</span><h2>Atlas selected {data.candidates.length} introduction{data.candidates.length===1?"":"s"} for you.</h2><p>These are the highest-ranked eligible people currently available under your Discovery preferences. A high score is a reason to look closer — never a prediction of relationship success.</p></div>
          <div className="daily-count"><b>{data.candidates.length}</b><span>of 3 today</span></div>
        </div>
        <div className="discovery-grid daily-discovery-grid discovery-grid-wide">{data.candidates.map((c,index) => <article className="card discovery-card daily-discovery-card discovery-card-wide" key={c.uid}>
          <div className="daily-rank"><span>ATLAS PICK</span><b>{index+1} of {data.candidates.length}</b></div>
          {c.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}<div className="candidate-identity"><ProfilePhoto uid={c.uid} name={c.firstName} className="discovery-profile-photo"/><div><h2>{c.firstName}{c.age ? `, ${c.age}` : ""}</h2><p>{[c.generalLocation,c.occupation].filter(Boolean).join(" · ") || "Limited profile details"}</p></div></div>
          <div className="trust-pair"><span><b>{c.authenticityScore}%</b><small>Authenticity</small></span><span><b>{c.compatibilityScore}%</b><small>Compatibility</small></span></div>
          <div className="candidate-badges"><span>{c.authenticityLevel}</span><span>{c.compatibilityLevel} alignment</span><span>{relationshipIntentLabels[c.relationshipIntent]}</span></div>
          <div className="candidate-person-card candidate-person-card-vivid">
            <div className="candidate-person-heading"><small>ABOUT {c.firstName.toUpperCase()}</small><b>Who they are, not just the score.</b></div>
            <div className="candidate-about-highlight">
              <Sparkles size={15} aria-hidden="true"/>
              <p className="candidate-about">{c.aboutMe}</p>
            </div>

            <div className="candidate-trait-title"><small>AT A GLANCE</small><span>Profile characteristics</span></div>
            <div className="candidate-trait-icons">
              {c.educationLevel&&<div className="trait-icon-card trait-education"><span><GraduationCap size={19}/></span><b>{["postgraduate","doctorate","professional_qualification"].includes(c.educationLevel)?"Highly educated":"Educated"}</b><small>{c.educationLevel.replaceAll("_"," ")}</small></div>}
              {(c.occupation||c.professionArea)&&<div className="trait-icon-card trait-profession"><span><BriefcaseBusiness size={19}/></span><b>Professional</b><small>{c.occupation||c.professionArea?.replaceAll("_"," ")}</small></div>}
              {c.sikhAppearance&&c.sikhAppearance!=="prefer_not_to_say"&&c.sikhAppearance!=="not_applicable"&&<div className="trait-icon-card trait-appearance"><span><CircleUserRound size={19}/></span><b>{c.sikhAppearance==="turbaned"?"Turbaned":"Non-turbaned"}</b><small>Appearance</small></div>}
              {c.diet&&c.diet!=="prefer_not_to_say"&&<div className="trait-icon-card trait-diet"><span><Leaf size={19}/></span><b>{c.diet==="non_vegetarian"?"Non-vegetarian":c.diet.charAt(0).toUpperCase()+c.diet.slice(1)}</b><small>Diet</small></div>}
              {c.sikhPractice&&c.sikhPractice!=="prefer_not_to_say"&&<div className="trait-icon-card trait-practice"><span><HandHeart size={19}/></span><b>{c.sikhPractice==="cultural_not_religious"?"Cultural":c.sikhPractice.charAt(0).toUpperCase()+c.sikhPractice.slice(1)}</b><small>Sikh practice</small></div>}
            </div>

            <div className="candidate-life-grid">
              {(c.occupation||c.professionArea)&&<span><small>PROFESSION</small><b>{c.occupation||"Professional"}</b><em>{c.professionArea?c.professionArea.replaceAll("_"," "):""}</em></span>}
              {c.educationLevel&&<span><small>EDUCATION</small><b>{c.educationLevel.replaceAll("_"," ")}</b><em>{c.educationField||c.educationInstitution||""}</em></span>}
            </div>
            <div className="candidate-community-pills">
              {c.caste&&<span>{c.caste}</span>}
              {c.careerPreferenceFit==="preferred"&&<span className="career-fit-pill">Preferred profession area</span>}
              {c.careerPreferenceFit==="similar_outlook"&&<span className="career-fit-pill">Similar career outlook</span>}
            </div>
          </div>
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
          <a className="recommendation-detail-link recommendation-detail-button" href={`/recommendations/${c.uid}`}>
            <span className="recommendation-detail-icon">✦</span>
            <span className="recommendation-detail-copy"><small>ATLAS INTRODUCTION</small><b>View full recommendation</b></span>
            <span className="recommendation-detail-arrow">→</span>
          </a>
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
