"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type Stage = "introduced"|"chatting"|"getting_to_know"|"met"|"connected";
type Data = {matchId:string;other:SafeDiscoveryProfile;myStage:Stage;otherStage:Stage;conversationStarter:string};
const stages: Array<{id:Stage;label:string;copy:string}> = [
  {id:"introduced",label:"Introduced",copy:"Mutual interest established"},
  {id:"chatting",label:"Chatting",copy:"Conversation has started"},
  {id:"getting_to_know",label:"Getting to know",copy:"Learning more about each other"},
  {id:"met",label:"Met",copy:"You've chosen to meet"},
  {id:"connected",label:"Connected",copy:"Continuing the connection"},
];

export default function ConnectionPage(){
 const params=useParams<{matchId:string}>(); const matchId=String(params.matchId??"");
 const {user,loading}=useAuth(); const router=useRouter();
 const [data,setData]=useState<Data|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);
 const load=useCallback(async()=>{if(!user)return;try{const token=await user.getIdToken();const r=await fetch(`/api/connections?matchId=${encodeURIComponent(matchId)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const b=await r.json();if(!r.ok)throw new Error(b.error??"Unable to load connection.");setData(b);setError("")}catch(e){setError(e instanceof Error?e.message:"Unable to load connection.")}},[user,matchId]);
 useEffect(()=>{void load()},[load]);
 async function setStage(stage:Stage){if(!user||busy)return;setBusy(true);try{const token=await user.getIdToken();const r=await fetch("/api/connections",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({matchId,stage})});const b=await r.json();if(!r.ok)throw new Error(b.error??"Unable to update connection.");setData(v=>v?{...v,myStage:stage}:v)}catch(e){setError(e instanceof Error?e.message:"Unable to update connection.")}finally{setBusy(false)}}
 if(loading||!user||!data)return <main><section className="section"><div className="container"><p className="muted">Loading connection…</p>{error&&<p className="notice">{error}</p>}</div></section></main>;
 const o=data.other; const active=stages.findIndex(s=>s.id===data.myStage);
 return <main>
  <section className="page-hero compact-hero"><div className="container">
   <span className="eyebrow">Connection · v0.10.1</span><h1>Your introduction with {o.firstName}.</h1>
   <p className="lead">A private place to understand why Atlas introduced you, start a conversation and record how the connection is progressing.</p>
  </div></section>
  <section className="section connection-section"><div className="container connection-layout">
   <div className="connection-main">
    {error&&<p className="notice">{error}</p>}
    <div className="card connection-summary connection-hero-card">
     <div className="connection-person">
      <div className="connection-avatar">{o.firstName.slice(0,1).toUpperCase()}</div>
      <div><span className="privacy-kicker">MUTUAL INTRODUCTION</span><h2>{o.firstName}{o.age?`, ${o.age}`:""}</h2><p>{o.generalLocation??"Location hidden"}{o.occupation?` · ${o.occupation}`:""}</p></div>
     </div>
     <div className="connection-scores"><span className="auth-score"><b>{o.authenticityScore}%</b><small>Authenticity</small></span><span className="compat-score"><b>{o.compatibilityScore}%</b><small>Compatibility</small></span></div>
    </div>
    <div className="card"><span className="privacy-kicker">WHY ATLAS INTRODUCED YOU</span><h2>Compatibility you can understand.</h2>
     <div className="connection-reasons">
      <div><h3>Good alignment</h3>{o.strongestAlignments.length?o.strongestAlignments.map(x=><p key={x}>✓ {x}</p>):<p>No single dimension dominates this introduction.</p>}</div>
      <div><h3>Worth discussing</h3>{o.conversationPoints.length?o.conversationPoints.map(x=><p key={x}>○ {x}</p>):<p>No major structured differences were identified.</p>}</div>
     </div>
     <p className="atlas-disclaimer">Atlas explains structured compatibility. It does not predict whether a relationship will succeed.</p>
    </div>
    <div className="card starter-card"><span className="privacy-kicker">CONVERSATION STARTER</span><h2>Need somewhere to start?</h2><blockquote>“{data.conversationStarter}”</blockquote><a className="btn btn-relationship" href={`/messages/${matchId}`}>Open conversation</a></div>
   </div>
   <aside className="connection-side">
    <div className="card"><span className="privacy-kicker">YOUR CONNECTION JOURNEY</span><h2>How is it progressing?</h2><p>Your stage is yours to control. AutoFace does not declare a relationship on your behalf.</p>
     <div className="journey-list">{stages.map((s,i)=><button key={s.id} disabled={busy} onClick={()=>void setStage(s.id)} className={`journey-step ${s.id===data.myStage?"active":""} ${i<active?"complete":""}`}><span>{i<active?"✓":i+1}</span><b>{s.label}<small>{s.copy}</small></b></button>)}</div>
     <div className="journey-privacy">Your current stage: <b>{stages.find(s=>s.id===data.myStage)?.label}</b>. {o.firstName}'s stage is not used to pressure or score you.</div>
    </div>
    <div className="card safety-compact"><span className="privacy-kicker">SAFETY</span><h3>Stay in control.</h3><p>Block, report and end-introduction controls remain available inside the conversation.</p><a className="btn btn-secondary" href={`/messages/${matchId}`}>Conversation & safety controls</a></div>
   </aside>
  </div></section>
 </main>
}
