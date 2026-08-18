"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ArrowRight, BadgeCheck, Camera, Check, Compass, HeartHandshake, ListFilter, ShieldCheck, Sparkles, UserRound } from "lucide-react";

type Step = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  complete: boolean;
  href: string;
  optional: boolean;
};

type Readiness = {
  firstName: string;
  authenticityScore: number;
  authenticityLevel: string;
  profileCompleteness: number;
  atlasCompleteness: number;
  photoAdded: boolean;
  steps: Step[];
  completed: number;
  total: number;
  setupPercent: number;
  nextStep: Step | null;
  readyForDiscovery: boolean;
  activeIntroductions: number;
  discoveryEnabled: boolean;
};

const icons:Record<string,React.ReactNode>={
  profile:<UserRound size={20}/>,
  photo:<Camera size={20}/>,
  atlas:<Sparkles size={20}/>,
  preferences:<ListFilter size={20}/>,
  authenticity:<ShieldCheck size={20}/>,
  discovery:<Compass size={20}/>,
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

  useEffect(() => { if (!loading && !user) router.replace("/sign-in"); }, [loading,user,router]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/readiness", {headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load your setup progress.");
      setData(body);setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your setup progress."); }
  }, [user]);

  useEffect(()=>{void load()},[load]);

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    if (!user || sending || feedback.trim().length < 3) return;
    try {
      setSending(true);setSent(false);
      const token = await user.getIdToken();
      const response = await fetch("/api/beta-feedback",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({category,message:feedback})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Unable to send feedback.");
      setFeedback("");setSent(true);
    } catch(e){setError(e instanceof Error?e.message:"Unable to send feedback.")}
    finally{setSending(false)}
  }

  if(loading||!user||!data)return <main><section className="section"><div className="container"><p className="muted">Preparing your AutoFace journey…</p>{error&&<p className="notice">{error}</p>}</div></section></main>;

  return <main>
    <section className="page-hero compact-hero onboarding-hero"><div className="container onboarding-hero-grid">
      <div>
        <span className="eyebrow">Your AutoFace Journey</span>
        <h1>{data.readyForDiscovery?`You’re ready, ${data.firstName}.`:`Let’s build this properly, ${data.firstName}.`}</h1>
        <p className="lead">AutoFace guides you through the parts that make considered introductions possible. You stay in control of when your profile becomes discoverable.</p>
        {data.nextStep?<a className="btn btn-primary onboarding-next-cta" href={data.nextStep.href}>Continue with {data.nextStep.shortTitle}<ArrowRight size={16}/></a>:<a className="btn btn-relationship onboarding-next-cta" href="/discover">Open Discover<ArrowRight size={16}/></a>}
      </div>
      <div className="onboarding-progress-orb">
        <strong>{data.setupPercent}%</strong><span>setup complete</span>
        <div className="onboarding-orb-ring" style={{"--progress":`${data.setupPercent*3.6}deg`} as React.CSSProperties}/>
      </div>
    </div></section>

    <section className="section onboarding-section"><div className="container onboarding-layout">
      <div className="onboarding-main">
        {error&&<p className="notice">{error}</p>}

        <div className="card simple-journey-card">
          <span className="privacy-kicker">THE SIMPLE VERSION</span><h2>Three things. Then you can meet people.</h2>
          <div className="simple-journey-grid">
            <div><span>01</span><UserRound size={20}/><b>About you</b><p>Build your profile, add a photo and establish enough trust to participate.</p></div>
            <i>→</i>
            <div><span>02</span><Sparkles size={20}/><b>What matters to you</b><p>Complete Atlas and tell us the practical preferences that shape an introduction.</p></div>
            <i>→</i>
            <div><span>03</span><Compass size={20}/><b>Meet people</b><p>Discover a small number of considered profiles and understand why Atlas showed them.</p></div>
          </div>
        </div>

        <div className="card onboarding-roadmap">
          <div className="onboarding-card-head"><div><span className="privacy-kicker">YOUR ROADMAP</span><h2>{data.completed} of {data.total} steps complete</h2></div><span className={data.readyForDiscovery?"status-pill ready-pill":"status-pill"}>{data.readyForDiscovery?"DISCOVERY READY":"IN PROGRESS"}</span></div>
          <div className="onboarding-rail">
            {data.steps.map((step,index)=><a className={`onboarding-rail-step ${step.complete?"complete":data.nextStep?.id===step.id?"current":""}`} href={step.href} key={step.id}>
              <div className="onboarding-step-marker">{step.complete?<Check size={15}/>:icons[step.id]}</div>
              <span className="onboarding-step-line"/>
              <div className="onboarding-step-copy"><small>STEP {String(index+1).padStart(2,"0")}</small><b>{step.title}</b><p>{step.description}</p></div>
              <strong>{step.complete?"DONE":data.nextStep?.id===step.id?"NEXT":"OPEN"}</strong>
            </a>)}
          </div>
        </div>

        <div className="onboarding-detail-grid">
          <div className="card onboarding-detail-card profile-detail"><UserRound size={19}/><div><small>PROFILE</small><b>{data.profileCompleteness}% complete</b><p>Identity, lifestyle, profession, education and interests help someone understand the person behind the recommendation.</p></div><a href="/profile">Review profile →</a></div>
          <div className="card onboarding-detail-card atlas-detail"><Sparkles size={19}/><div><small>ATLAS</small><b>{data.atlasCompleteness}% complete</b><p>Your structured relationship answers power the deterministic compatibility model and Atlas explanations.</p></div><a href="/relationship-profile">Review Atlas →</a></div>
          <div className="card onboarding-detail-card trust-detail"><ShieldCheck size={19}/><div><small>AUTHENTICITY</small><b>{data.authenticityScore}% · {data.authenticityLevel}</b><p>Trust evidence is deliberately separate from compatibility and controls eligibility rather than desirability.</p></div><a href="/dashboard">Review trust →</a></div>
        </div>

        <div className="card onboarding-after-ready">
          <span className="privacy-kicker">WHAT HAPPENS AFTER SETUP?</span>
          <h2>Setup is only the beginning.</h2>
          <div className="after-ready-flow">
            <span><Compass size={18}/><b>Discover</b><small>Consider a small number of Atlas recommendations.</small></span>
            <i>→</i>
            <span><HeartHandshake size={18}/><b>Choose privately</b><small>Interested, saved, or not for me.</small></span>
            <i>→</i>
            <span><BadgeCheck size={18}/><b>Mutual introduction</b><small>Conversation opens only when interest is mutual.</small></span>
          </div>
          <a className="btn" href="/introductions">View My Introductions</a>
        </div>
      </div>

      <aside className="onboarding-side">
        <div className="card onboarding-next-card">
          <span className="privacy-kicker">{data.readyForDiscovery?"YOU’RE READY":"NEXT BEST ACTION"}</span>
          <div className="onboarding-next-icon">{data.readyForDiscovery?<Compass size={24}/>:icons[data.nextStep?.id??"profile"]}</div>
          <h3>{data.readyForDiscovery?"Start discovering":data.nextStep?.title}</h3>
          <p>{data.readyForDiscovery?"Your setup meets the current Discovery foundation. Atlas can now show considered introductions.":data.nextStep?.description}</p>
          <a className="btn btn-primary" href={data.readyForDiscovery?"/discover":data.nextStep?.href??"/profile"}>{data.readyForDiscovery?"Open Discover":"Continue"} <ArrowRight size={14}/></a>
        </div>

        <div className="card onboarding-control-card">
          <span className="privacy-kicker">YOU STAY IN CONTROL</span>
          <h3>{data.discoveryEnabled?"Discovery is enabled":"You are not discoverable yet"}</h3>
          <p>{data.discoveryEnabled?"Your profile can be considered for introductions that satisfy eligibility and preference controls.":"Completing setup does not automatically expose your profile. You choose when to make it available for introductions."}</p>
          <a className="btn" href="/profile">Profile visibility</a>
        </div>

        <div className="card onboarding-intro-count"><HeartHandshake size={20}/><div><strong>{data.activeIntroductions}</strong><span>active mutual introduction{data.activeIntroductions===1?"":"s"}</span></div><a href="/introductions">Open →</a></div>

        <form className="card beta-feedback-card" onSubmit={submitFeedback}>
          <span className="privacy-kicker">BETA FEEDBACK</span><h3>Help shape AutoFace.</h3>
          <p>If any step feels confusing or unnecessary, tell us.</p>
          <label>Feedback type<select value={category} onChange={(e)=>setCategory(e.target.value as typeof category)}><option value="idea">Idea</option><option value="problem">Problem</option><option value="confusing">Confusing</option><option value="positive">Working well</option></select></label>
          <label>Your feedback<textarea rows={4} maxLength={1200} value={feedback} onChange={(e)=>setFeedback(e.target.value)} placeholder="What would make this journey clearer?"/><small>{feedback.length}/1200</small></label>
          <button className="btn btn-primary" disabled={sending||feedback.trim().length<3}>{sending?"Sending…":"Send feedback"}</button>
          {sent&&<div className="beta-feedback-sent">✓ Thank you — feedback received.</div>}
        </form>
      </aside>
    </div></section>
  </main>;
}
