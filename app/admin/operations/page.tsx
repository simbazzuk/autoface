"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type FunnelItem = { id:string; label:string; count:number; percent:number };
type Feedback = { id:string; email:string; category:string; message:string; status:string; appVersion:string; createdAt:string|null };
type Member = {
  uid:string; email:string; firstName:string; disabled:boolean; testProfile:boolean;
  profileComplete:boolean; atlasComplete:boolean; authenticityReady:boolean;
  preferencesComplete:boolean; discoveryEnabled:boolean; completedSteps:number;
  readyForDiscovery:boolean; authenticityScore:number; createdAt:string|null; lastSignInAt:string|null;
};
type OpsData = {
  environment:string;
  summary:{registered:number;profilesComplete:number;atlasComplete:number;authenticityReady:number;discoveryReady:number;discoveryEnabled:number;mutualIntroductions:number;activeConversations:number;messages:number;openReports:number;feedbackNew:number};
  funnel:FunnelItem[];
  engagement:{interestedActions:number;mutualIntroductions:number;endedIntroductions:number;activeConversations:number;messages:number};
  safety:{reports:number;openReports:number};
  feedback:Feedback[];
  feedbackByCategory:Record<string,number>;
  members:Member[];
  note:string;
};

const feedbackLabels:Record<string,string>={idea:"Ideas",problem:"Problems",confusing:"Confusing",positive:"Working well"};

export default function BetaOperationsPage(){
  const {user,loading}=useAuth();
  const router=useRouter();
  const [data,setData]=useState<OpsData|null>(null);
  const [forbidden,setForbidden]=useState(false);
  const [error,setError]=useState("");
  const [feedbackFilter,setFeedbackFilter]=useState("all");
  const [busy,setBusy]=useState("");

  useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);

  const load=useCallback(async()=>{
    if(!user)return;
    try{
      const token=await user.getIdToken();
      const response=await fetch("/api/admin/operations",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const body=await response.json();
      if(response.status===403){setForbidden(true);return}
      if(!response.ok)throw new Error(body.error??"Unable to load beta operations.");
      setData(body);setForbidden(false);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Unable to load beta operations.")}
  },[user]);

  useEffect(()=>{void load()},[load]);

  const filteredFeedback=useMemo(()=>{
    if(!data)return[];
    return feedbackFilter==="all"?data.feedback:data.feedback.filter(item=>item.status===feedbackFilter);
  },[data,feedbackFilter]);

  async function updateFeedback(id:string,status:string){
    if(!user||busy)return;
    try{
      setBusy(id);
      const token=await user.getIdToken();
      const response=await fetch("/api/admin/operations",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({feedbackId:id,status})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error??"Unable to update feedback.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to update feedback.")}
    finally{setBusy("")}
  }

  if(loading||!user)return <main><section className="section"><div className="container"><p className="muted">Loading beta operations…</p></div></section></main>;
  if(forbidden)return <main><section className="section"><div className="container narrow"><div className="card admin-denied"><span className="privacy-kicker">OPERATOR ACCESS</span><h1>Admin access required.</h1><p>Beta Operations uses the same server-side admin allowlist as Safety Operations.</p><a className="btn" href="/">Return to AutoFace</a></div></div></section></main>;
  if(!data)return <main><section className="section"><div className="container"><p className="muted">Loading beta operations…</p>{error&&<p className="notice">{error}</p>}</div></section></main>;

  return <main>
    <section className="page-hero compact-hero ops-hero"><div className="container">
      <span className="eyebrow">Beta Operations · v0.17</span>
      <h1>Is the product actually working for people?</h1>
      <p className="lead">A privacy-conscious operational view of onboarding, Discovery readiness, engagement, safety and beta feedback.</p>
      <div className="ops-hero-actions"><a className="btn" href="/admin">Safety Operations</a><button className="btn btn-primary" onClick={()=>void load()}>Refresh metrics</button></div>
    </div></section>

    <section className="section ops-section"><div className="container">
      {error&&<p className="notice">{error}</p>}
      <div className={`ops-environment ${data.environment==="demo_only"?"demo":""}`}><b>{data.environment==="demo_only"?"DEMO DATA":"BETA DATA"}</b><span>{data.note}</span></div>

      <div className="ops-stat-grid">
        <div className="card ops-stat"><span>Registered</span><b>{data.summary.registered}</b><small>Beta members</small></div>
        <div className="card ops-stat"><span>Discovery ready</span><b>{data.summary.discoveryReady}</b><small>All 5 setup steps</small></div>
        <div className="card ops-stat"><span>Introductions</span><b>{data.summary.mutualIntroductions}</b><small>Mutual matches</small></div>
        <div className="card ops-stat"><span>Messages</span><b>{data.summary.messages}</b><small>Conversation activity</small></div>
        <div className="card ops-stat"><span>Open reports</span><b>{data.summary.openReports}</b><small>Needs review</small></div>
        <div className="card ops-stat"><span>New feedback</span><b>{data.summary.feedbackNew}</b><small>Needs triage</small></div>
      </div>

      <div className="ops-grid">
        <div className="card ops-funnel-card">
          <span className="privacy-kicker">ONBOARDING FUNNEL</span>
          <h2>Where do people stop?</h2>
          <p>Each stage shows the percentage of current beta members who have completed that readiness step.</p>
          <div className="ops-funnel">
            {data.funnel.map((item)=><div className="ops-funnel-row" key={item.id}>
              <div><b>{item.label}</b><span>{item.count} member{item.count===1?"":"s"}</span></div>
              <div className="ops-funnel-meter"><i style={{width:`${item.percent}%`}} /></div>
              <strong>{item.percent}%</strong>
            </div>)}
          </div>
        </div>

        <div className="card ops-engagement-card">
          <span className="privacy-kicker">ENGAGEMENT</span>
          <h2>Intentional activity</h2>
          <div className="ops-metric-list">
            <span><b>Interested actions</b>{data.engagement.interestedActions}</span>
            <span><b>Mutual introductions</b>{data.engagement.mutualIntroductions}</span>
            <span><b>Active conversations</b>{data.engagement.activeConversations}</span>
            <span><b>Messages sent</b>{data.engagement.messages}</span>
            <span><b>Ended introductions</b>{data.engagement.endedIntroductions}</span>
          </div>
          <p className="ops-note">These metrics show product usage only. AutoFace does not rank users by engagement or use activity to change compatibility recommendations.</p>
        </div>
      </div>

      <div className="card ops-members-card">
        <div className="ops-section-head"><div><span className="privacy-kicker">RECENT MEMBERS</span><h2>Readiness at a glance</h2></div><span className="status-pill">NO PRIVATE ATLAS ANSWERS</span></div>
        <div className="ops-member-table">
          <div className="ops-member-row header"><span>Member</span><span>Setup</span><span>Authenticity</span><span>Discovery</span><span>Status</span></div>
          {data.members.map(member=><div className="ops-member-row" key={member.uid}>
            <span><b>{member.firstName||member.email.split("@")[0]||"Member"}</b><small>{member.email}</small>{member.testProfile&&<em>TEST</em>}</span>
            <span><b>{member.completedSteps}/5</b><small>steps complete</small></span>
            <span><b>{member.authenticityScore}%</b><small>{member.authenticityReady?"Ready":"Below threshold"}</small></span>
            <span><b>{member.readyForDiscovery?"Ready":"Not ready"}</b><small>{member.discoveryEnabled?"Enabled":"Paused/private"}</small></span>
            <span><b>{member.disabled?"Suspended":"Active"}</b><small>{member.lastSignInAt?`Last sign-in ${new Date(member.lastSignInAt).toLocaleDateString()}`:"No sign-in timestamp"}</small></span>
          </div>)}
        </div>
      </div>

      <div className="ops-grid feedback-grid">
        <div className="card">
          <span className="privacy-kicker">FEEDBACK SIGNALS</span>
          <h2>What beta users are telling you</h2>
          <div className="ops-feedback-summary">
            {Object.entries(feedbackLabels).map(([key,label])=><span key={key}><b>{data.feedbackByCategory[key]??0}</b><small>{label}</small></span>)}
          </div>
          <p className="ops-note">Feedback is explicitly submitted by users through Getting Started. It is not inferred from private conversations.</p>
        </div>

        <div className="card">
          <span className="privacy-kicker">SAFETY</span>
          <h2>Operational health</h2>
          <div className="ops-feedback-summary">
            <span><b>{data.safety.reports}</b><small>Total reports</small></span>
            <span><b>{data.safety.openReports}</b><small>Open reports</small></span>
          </div>
          <a className="btn" href="/admin">Open Safety Operations</a>
        </div>
      </div>

      <div className="ops-feedback-heading">
        <div><span className="privacy-kicker">BETA FEEDBACK QUEUE</span><h2>Triage feedback without leaving AutoFace</h2></div>
        <div className="admin-filter">{["all","new","reviewed","planned","closed"].map(item=><button key={item} className={feedbackFilter===item?"active":""} onClick={()=>setFeedbackFilter(item)}>{item}</button>)}</div>
      </div>

      {filteredFeedback.length===0?<div className="card admin-empty"><h3>No {feedbackFilter==="all"?"":feedbackFilter} feedback.</h3><p>Feedback submitted from Getting Started will appear here.</p></div>:
      <div className="ops-feedback-list">{filteredFeedback.map(item=><article className={`card ops-feedback-item ${item.status}`} key={item.id}>
        <div className="ops-feedback-top"><div><span className="privacy-kicker">{feedbackLabels[item.category]??item.category}</span><h3>{item.email||"Authenticated beta member"}</h3></div><span className="status-pill">{item.status.toUpperCase()}</span></div>
        <p>{item.message}</p>
        <div className="ops-feedback-meta"><span>{item.createdAt?new Date(item.createdAt).toLocaleString():"Unknown date"}</span><span>{item.appVersion?`Submitted on v${item.appVersion}`:"Version not recorded"}</span></div>
        <div className="ops-feedback-actions">
          {(["new","reviewed","planned","closed"] as const).filter(status=>status!==item.status).map(status=><button className="btn" disabled={Boolean(busy)} key={status} onClick={()=>void updateFeedback(item.id,status)}>Mark {status}</button>)}
        </div>
      </article>)}</div>}

      <div className="card ops-privacy-card">
        <span className="privacy-kicker">OPERATING BOUNDARY</span>
        <h2>Measure the product, not people's private relationships.</h2>
        <p>v0.17 reports completion, usage and explicit feedback metadata. It does not expose private message contents, private Atlas free-text answers, attractiveness scores or behavioural engagement ranking.</p>
      </div>
    </div></section>
  </main>;
}
