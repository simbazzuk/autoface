"use client";

import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function DevelopmentToolsPage(){
  const {user,loading}=useAuth();
  const router=useRouter();
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [readiness,setReadiness]=useState<{ready:boolean;checks:{profileExists:boolean;profileVisible:boolean;atlasProfileExists:boolean;compatibilityConsent:boolean;authenticityReady:boolean};authenticityScore:number;atlasCompleteness:number}|null>(null);

  useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);
  useEffect(()=>{
    let active=true;
    if(!user){setAllowed(null);return()=>{active=false}};
    if(process.env.NODE_ENV==="production"){setAllowed(false);return()=>{active=false}};
    (async()=>{
      try{
        const token=await user.getIdToken();
        const response=await fetch("/api/dev/status",{headers:{Authorization:`Bearer ${token}`}});
        if(active)setAllowed(response.ok&&Boolean((await response.json()).developmentTools));
      }catch{if(active)setAllowed(false)}
    })();
    return()=>{active=false};
  },[user]);

  async function loadReadiness(){
    if(!user||process.env.NODE_ENV==="production")return;
    try{
      const token=await user.getIdToken();
      const response=await fetch("/api/dev/readiness",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      if(response.ok)setReadiness(await response.json());
    }catch{setReadiness(null)}
  }
  useEffect(()=>{void loadReadiness()},[user]);

  async function run(action:"reset_me"|"seed_community"|"remove_seed_community"|"make_discovery_ready"){
    if(!user||busy)return;
    const confirmations={
      reset_me:"Reset your test profile journey? Your Firebase login will be kept, but your profile, Atlas answers, preferences, decisions, introductions and profile photo will be cleared.",
      seed_community:"Create or refresh 8 synthetic Sikh test profiles in the connected development Firebase project?",
      remove_seed_community:"Remove the 8 synthetic Sikh test profiles and their generated test data?",
      make_discovery_ready:"Prepare this local test account for Discovery? This makes the Profile visible, enables compatibility if an Atlas Profile exists, and applies the synthetic development trust baseline."
    };
    if(!window.confirm(confirmations[action]))return;
    try{
      setBusy(action);setMessage("");
      const token=await user.getIdToken();
      const response=await fetch("/api/dev/reset",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error??"Development action failed.");
      setMessage(body.message??"Done.");
      await loadReadiness();
      if(action==="reset_me")setTimeout(()=>router.push("/profile"),700);
    }catch(error){setMessage(error instanceof Error?error.message:"Development action failed.")}
    finally{setBusy("")}
  }

  if(loading||!user||allowed===null)return <main><section className="section"><div className="container"><p className="muted">Loading development tools…</p></div></section></main>;
  if(process.env.NODE_ENV==="production"||!allowed)return <main><section className="section"><div className="container narrow"><div className="card dev-denied"><span className="privacy-kicker">DEVELOPMENT ONLY</span><h1>Development tools are unavailable.</h1><p>These controls are restricted to local development test profiles.</p></div></div></section></main>;

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Development Tools</span>
      <h1>Reset. Rebuild. Test again.</h1>
      <p className="lead">Start the AutoFace journey from a clean test state without repeatedly creating Firebase Authentication accounts.</p>
    </div></section>

    <section className="section"><div className="container dev-tools-layout">
      <div className="card dev-tools-card dev-reset-card">
        <span className="privacy-kicker">MY TEST PROFILE</span><h2>Reset my journey</h2>
        <p>Keep your Firebase login and test marker, but clear the AutoFace application journey so you can rebuild the profile from scratch.</p>
        <div className="dev-reset-flow">
          <span><b>KEEP</b>Authentication login</span><span><b>KEEP</b>Test profile marker</span>
          <span><b>RESET</b>Member + Sikh profile</span><span><b>RESET</b>Atlas answers</span>
          <span><b>RESET</b>Discovery preferences</span><span><b>RESET</b>Recommendations/history</span>
          <span><b>RESET</b>Interests + introductions</span><span><b>RESET</b>Profile photo</span>
        </div>
        <button className="btn danger-button dev-action" disabled={Boolean(busy)} onClick={()=>void run("reset_me")}>{busy==="reset_me"?"Resetting…":"Reset my test journey"}</button>
      </div>

      <div className="card dev-tools-card dev-seed-card">
        <span className="privacy-kicker">SYNTHETIC COMMUNITY</span><h2>Seed Sikh test profiles</h2>
        <p>Create eight synthetic members with deliberately varied Sikh identity, lifestyle and Atlas relationship answers so Discovery has a useful population to rank.</p>
        <div className="dev-seed-people"><span>Harpreet · Manchester</span><span>Simran · London</span><span>Jaspreet · Birmingham</span><span>Priya · Leeds</span><span>Gurpreet · Leicester</span><span>Navdeep · Toronto</span><span>Aman · Nairobi</span><span>Kiran · Melbourne</span></div>
        <div className="dev-action-row">
          <button className="btn btn-primary dev-action" disabled={Boolean(busy)} onClick={()=>void run("seed_community")}>{busy==="seed_community"?"Seeding…":"Seed / refresh community"}</button>
          <button className="btn dev-action" disabled={Boolean(busy)} onClick={()=>void run("remove_seed_community")}>{busy==="remove_seed_community"?"Removing…":"Remove seeded profiles"}</button>
        </div>
      </div>

      <div className="card dev-readiness-card">
        <div className="dev-readiness-heading"><div><span className="privacy-kicker">DISCOVERY READINESS</span><h2>{readiness?.ready?"Your test account is ready":"Why seeded people may not appear"}</h2></div><span className={`status-pill ${readiness?.ready?"ready-pill":"attention-pill"}`}>{readiness?.ready?"READY":"CHECK SETUP"}</span></div>
        <p>Seeding creates candidates. Your own account must also pass Discovery eligibility before those candidates can be returned.</p>
        <div className="dev-readiness-grid">
          <span className={readiness?.checks.profileExists?"ok":"bad"}><b>{readiness?.checks.profileExists?"✓":"!"}</b><em>Profile saved</em></span>
          <span className={readiness?.checks.profileVisible?"ok":"bad"}><b>{readiness?.checks.profileVisible?"✓":"!"}</b><em>Visible for introductions</em></span>
          <span className={readiness?.checks.atlasProfileExists?"ok":"bad"}><b>{readiness?.checks.atlasProfileExists?"✓":"!"}</b><em>Atlas Profile completed</em></span>
          <span className={readiness?.checks.compatibilityConsent?"ok":"bad"}><b>{readiness?.checks.compatibilityConsent?"✓":"!"}</b><em>Compatibility enabled</em></span>
          <span className={readiness?.checks.authenticityReady?"ok":"bad"}><b>{readiness?.checks.authenticityReady?"✓":"!"}</b><em>Authenticity {readiness?.authenticityScore??0}%</em></span>
        </div>
        {!readiness?.ready&&<div className="dev-readiness-actions">
          <button className="btn btn-primary" disabled={Boolean(busy)} onClick={()=>void run("make_discovery_ready")}>{busy==="make_discovery_ready"?"Preparing…":"Make my test account Discovery-ready"}</button>
          {!readiness?.checks.atlasProfileExists&&<a className="btn" href="/relationship-profile">Complete Atlas Profile</a>}
          {!readiness?.checks.profileExists&&<a className="btn" href="/profile">Create Profile</a>}
        </div>}
        <small className="dev-readiness-note">The helper never fabricates Atlas relationship answers. If your Atlas Profile does not exist yet, complete it before testing Discover.</small>
      </div>

      <div className="card dev-warning">
        <span>⚠</span><div><b>Local development only</b><p>These controls deliberately refuse to run when Next.js is in production mode. Seeded people are synthetic test profiles and must never be presented as real AutoFace members.</p></div>
      </div>
      {message&&<p className="notice dev-tools-message">{message}</p>}
    </div></section>
  </main>
}
