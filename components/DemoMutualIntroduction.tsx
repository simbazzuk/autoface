"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Candidate = {
  uid:string;
  firstName:string;
  age:number|null;
  generalLocation:string|null;
  compatibilityScore:number;
  targetAiOptIn:boolean;
  blocked:boolean;
  existingMutual:boolean;
  state:"ready"|"blocked"|"mutual";
};

export function DemoMutualIntroduction() {
  const { user } = useAuth();
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [selected,setSelected]=useState("");
  const [enableTargetAi,setEnableTargetAi]=useState(true);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [connectionUrl,setConnectionUrl]=useState("");

  const load=useCallback(async()=>{
    if(!user)return;
    try{
      setLoading(true);
      const token=await user.getIdToken();
      const response=await fetch("/api/demo/mutual-introduction",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===403){setCandidates([]);return;}
        throw new Error(body.error??"Unable to load demo profiles.");
      }
      const rows=(body.candidates??[]) as Candidate[];
      setCandidates(rows);
      setSelected(current=>current&&rows.some(r=>r.uid===current)?current:(rows[0]?.uid??""));
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to load demo profiles.")}
    finally{setLoading(false)}
  },[user]);

  useEffect(()=>{void load()},[load]);

  if(!user || (!loading && candidates.length===0)) return null;
  const chosen=candidates.find(c=>c.uid===selected);

  async function clearBlock(){
    if(!user||!selected||busy)return;
    try{
      setBusy(true);setMessage("");setConnectionUrl("");
      const token=await user.getIdToken();
      const response=await fetch("/api/demo/mutual-introduction",{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({targetUid:selected,action:"clear_block"}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error??"Unable to clear demo block.");
      setMessage(body.notice??"Demo block cleared.");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to clear demo block.")}
    finally{setBusy(false)}
  }

  async function create(){
    if(!user||!selected||busy)return;
    try{
      setBusy(true);setMessage("");setConnectionUrl("");
      const token=await user.getIdToken();
      const response=await fetch("/api/demo/mutual-introduction",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({targetUid:selected,enableTargetAi}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error??"Unable to create demo mutual introduction.");
      setMessage(`Mutual demo introduction created with ${body.target?.firstName??"test profile"}.`);
      setConnectionUrl(body.connectionUrl??"");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to create demo mutual introduction.")}
    finally{setBusy(false)}
  }

  return <div className="card demo-mutual-card">
    <div className="demo-mutual-head">
      <div><span className="privacy-kicker">TEST PROFILE HARNESS</span><h3>Create a demo mutual introduction</h3></div>
      <span className="status-pill test-profile-pill">DEMO ONLY</span>
    </div>
    <p>Create both Interested decisions and a mutual introduction without signing in as the synthetic target. This control is server-restricted to test profiles.</p>

    {loading?<p className="muted">Loading eligible test profiles…</p>:<>
      <label className="demo-mutual-select">
        <span>Demo person</span>
        <select value={selected} onChange={e=>{setSelected(e.target.value);setMessage("");setConnectionUrl("")}}>
          {candidates.map(c=><option key={c.uid} value={c.uid}>{c.firstName}{c.age?`, ${c.age}`:""} · {c.compatibilityScore}% · {c.blocked?"BLOCKED":c.existingMutual?"MUTUAL":"READY"}</option>)}
        </select>
      </label>

      {chosen&&<div className="demo-mutual-preview">
        <span><b>{chosen.firstName}{chosen.age?`, ${chosen.age}`:""}</b><small>{chosen.generalLocation??"Location hidden"}</small></span>
        <span><b>{chosen.compatibilityScore}%</b><small>Compatibility</small></span>
        <span><b>{chosen.targetAiOptIn?"AI ON":"AI OFF"}</b><small>Target AI Discovery</small></span>
        <span><b className={`demo-state-${chosen.state}`}>{chosen.state.toUpperCase()}</b><small>Pair state</small></span>
      </div>}

      <label className="consent-card demo-ai-toggle">
        <input type="checkbox" checked={enableTargetAi} onChange={e=>setEnableTargetAi(e.target.checked)}/>
        <span><b>Enable Atlas AI Discovery on the synthetic target</b><small>Demo harness only. This makes it possible to test Atlas AI Discovery and Introduction Coach without needing the target profile&apos;s login. Your own AI Discovery permission is not changed.</small></span>
      </label>

      {chosen?.blocked&&<div className="demo-block-panel">
        <div><b>⚠ Demo pair is currently blocked</b><span>The production block is respected. For testing only, you can explicitly clear this demo pair&apos;s block before creating a new introduction.</span></div>
        <button className="btn demo-clear-block" type="button" disabled={busy} onClick={()=>void clearBlock()}>{busy?"Clearing…":"Clear demo block"}</button>
      </div>}
      <button className="btn btn-primary" type="button" disabled={busy||!selected||Boolean(chosen?.blocked)} onClick={()=>void create()}>
        {busy?"Working…":chosen?.existingMutual?"Refresh demo mutual introduction":"Create mutual introduction"}
      </button>
      {message&&<p className="notice">{message}</p>}
      {connectionUrl&&<div className="demo-mutual-actions"><a className="btn btn-relationship" href={connectionUrl}>Open connection</a><a className="btn" href={connectionUrl.replace("/connections/","/messages/")}>Open conversation & Coach</a></div>}
    </>}
    <p className="atlas-disclaimer">The harness never bypasses blocks and is unavailable to normal AutoFace accounts.</p>
  </div>;
}
