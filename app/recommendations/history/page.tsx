"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { relationshipIntentLabels, type RelationshipIntent } from "@/lib/profile";

type Item = {
  uid:string;
  firstName:string;
  age:number|null;
  generalLocation:string|null;
  occupation:string|null;
  relationshipIntent:RelationshipIntent;
  authenticityScore:number;
  authenticityLevel:string;
  compatibilityScore:number;
  compatibilityLevel:string;
  strongestAlignments:string[];
  conversationPoints:string[];
  decision:"interested"|"saved"|"pass";
  reviewedAt:string|null;
  mutual:boolean;
  isTestProfile:boolean;
};

type Filter = "all"|"saved"|"interested"|"pass";

export default function RecommendationHistoryPage(){
  const {user,loading}=useAuth();
  const router=useRouter();
  const [items,setItems]=useState<Item[]|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [filter,setFilter]=useState<Filter>("all");
  const [busyUid,setBusyUid]=useState("");
  const [aiStatuses,setAiStatuses]=useState<Record<string,{available:boolean;enabled:boolean;viewerOptIn:boolean;candidateOptIn:boolean}>>({});

  useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);

  useEffect(()=>{
    if(!user)return;
    const current=user;
    (async()=>{
      try{
        const token=await current.getIdToken();
        const response=await fetch("/api/recommendations/history",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
        const body=await response.json();
        if(!response.ok)throw new Error(body.error??"Unable to load reviewed recommendations.");
        setItems(body.items??[]);
      }catch(e){
        setError(e instanceof Error?e.message:"Unable to load reviewed recommendations.");
        setItems([]);
      }
    })();
  },[user]);

  useEffect(()=>{
    if(!user||!items?.length){setAiStatuses({});return}
    const current=user;
    (async()=>{
      try{
        const token=await current.getIdToken();
        const response=await fetch("/api/atlas-ai/discovery-status",{
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
          body:JSON.stringify({candidateUids:items.map(item=>item.uid)})
        });
        const body=await response.json().catch(()=>({}));
        if(response.ok)setAiStatuses(body.statuses??{});
      }catch{
        setAiStatuses({});
      }
    })();
  },[user,items]);

  async function updateDecision(toUid:string,action:"interested"|"saved"|"pass"){
    if(!user||busyUid)return;
    setBusyUid(toUid);
    setMessage("");
    try{
      const token=await user.getIdToken();
      const response=await fetch("/api/interests",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({toUid,action})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error??"Unable to update your decision.");

      setItems(current=>(current??[]).map(item=>
        item.uid===toUid
          ? {...item,decision:action,mutual:Boolean(body.matched)||item.mutual,reviewedAt:new Date().toISOString()}
          : item
      ));

      setMessage(
        body.matched
          ? "It’s mutual — your introduction is ready."
          : action==="interested"
            ? "Interest saved privately."
            : action==="saved"
              ? "Saved for later. No notification was sent."
              : "Moved to Not for me."
      );
    }catch(e){
      setMessage(e instanceof Error?e.message:"Unable to update your decision.");
    }finally{
      setBusyUid("");
    }
  }

  if(loading||!user||items===null){
    return <main><section className="section"><div className="container"><p className="muted">Loading reviewed recommendations…</p></div></section></main>;
  }

  const visibleItems=items.filter(item=>filter==="all"||item.decision===filter);
  const counts={
    all:items.length,
    saved:items.filter(item=>item.decision==="saved").length,
    interested:items.filter(item=>item.decision==="interested").length,
    pass:items.filter(item=>item.decision==="pass").length,
  };

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Recommendation history</span>
          <h1>Revisit people you’ve already considered.</h1>
          <p className="lead">Save someone for later, reconsider a previous choice, or revisit the Atlas explanation that helped you decide.</p>
        </div>
      </section>

      <section className="section reviewed-section">
        <div className="container">
          {error&&<p className="notice">{error}</p>}
          {message&&<p className="notice">{message}</p>}

          <div className="reviewed-toolbar">
            <span>{items.length} considered recommendation{items.length===1?"":"s"}</span>
            <a className="btn" href="/discover">Back to Discover</a>
          </div>

          {items.length===0 ? (
            <div className="card discovery-empty">
              <span className="privacy-kicker">NO HISTORY YET</span>
              <h2>Nothing considered yet.</h2>
              <p>Profiles appear here after you choose Interested, Save for later or Not for me.</p>
              <a className="btn btn-primary" href="/discover">Open Discover</a>
            </div>
          ) : (
            <>
              <div className="history-filters">
                <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All <b>{counts.all}</b></button>
                <button className={filter==="saved"?"active":""} onClick={()=>setFilter("saved")}>Saved <b>{counts.saved}</b></button>
                <button className={filter==="interested"?"active":""} onClick={()=>setFilter("interested")}>Interested <b>{counts.interested}</b></button>
                <button className={filter==="pass"?"active":""} onClick={()=>setFilter("pass")}>Not for me <b>{counts.pass}</b></button>
              </div>

              {visibleItems.length===0 ? (
                <div className="card history-filter-empty">
                  <h3>No recommendations in this view.</h3>
                  <p>Choose another filter or return to Discover.</p>
                </div>
              ) : (
                <div className="reviewed-grid">
                  {visibleItems.map(item=>(
                    <article className="card reviewed-card" key={item.uid}>
                      <div className="reviewed-card-top">
                        <div className="candidate-identity">
                          <div className="profile-placeholder">{item.firstName.slice(0,1).toUpperCase()}</div>
                          <div>
                            <h2>{item.firstName}{item.age?`, ${item.age}`:""}</h2>
                            <p>{[item.generalLocation,item.occupation].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                        <span className={`reviewed-decision ${item.decision}`}>
                          {item.mutual
                            ? "MUTUAL INTRODUCTION"
                            : item.decision==="interested"
                              ? "INTERESTED"
                              : item.decision==="saved"
                                ? "SAVED FOR LATER"
                                : "NOT FOR ME"}
                        </span>
                      </div>

                      <div className="trust-pair">
                        <span><b>{item.authenticityScore}%</b><small>Authenticity</small></span>
                        <span><b>{item.compatibilityScore}%</b><small>Compatibility</small></span>
                      </div>

                      <div className="candidate-badges">
                        <span>{item.authenticityLevel}</span>
                        <span>{item.compatibilityLevel} alignment</span>
                        <span>{relationshipIntentLabels[item.relationshipIntent]}</span>
                      </div>

                      <div className="reviewed-summary">
                        <div><small>STRONG ALIGNMENTS</small><p>{item.strongestAlignments.join(" · ")||"No dominant alignment"}</p></div>
                        <div><small>WORTH DISCUSSING</small><p>{item.conversationPoints.join(" · ")||"No major structured differences"}</p></div>
                      </div>

                      {aiStatuses[item.uid]?.available&&(
                        <a className="ai-history-teaser" href={`/recommendations/${item.uid}`}>
                          <span>✦</span>
                          <div><small>ATLAS AI DISCOVERY</small><b>Gemini insight available for this recommendation</b></div>
                          <strong>Open →</strong>
                        </a>
                      )}

                      {!item.mutual&&(
                        <div className="history-decision-actions">
                          {item.decision!=="saved"&&<button className="btn" disabled={Boolean(busyUid)} onClick={()=>void updateDecision(item.uid,"saved")}>♡ Save</button>}
                          {item.decision!=="interested"&&<button className="btn btn-relationship" disabled={Boolean(busyUid)} onClick={()=>void updateDecision(item.uid,"interested")}>Interested</button>}
                          {item.decision!=="pass"&&<button className="btn" disabled={Boolean(busyUid)} onClick={()=>void updateDecision(item.uid,"pass")}>Not for me</button>}
                        </div>
                      )}

                      <div className="reviewed-footer">
                        <span>{item.reviewedAt?`Considered ${new Date(item.reviewedAt).toLocaleDateString()}`:"Previously considered"}</span>
                        <a className="recommendation-detail-link" href={`/recommendations/${item.uid}`}>View recommendation details →</a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
