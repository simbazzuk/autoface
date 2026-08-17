"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { relationshipIntentLabels } from "@/lib/profile";
import type { RelationshipIntent } from "@/lib/profile";

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
  decision:"interested"|"pass";
  reviewedAt:string|null;
  mutual:boolean;
  isTestProfile:boolean;
};

export default function RecommendationHistoryPage(){
  const {user,loading}=useAuth();
  const router=useRouter();
  const [items,setItems]=useState<Item[]|null>(null);
  const [error,setError]=useState("");

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
      }catch(e){setError(e instanceof Error?e.message:"Unable to load reviewed recommendations.");setItems([])}
    })();
  },[user]);

  if(loading||!user||items===null)return <main><section className="section"><div className="container"><p className="muted">Loading reviewed recommendations…</p></div></section></main>;

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Recommendation history</span>
      <h1>Review the people Atlas has already shown you.</h1>
      <p className="lead">A previous decision removes someone from the active Discover queue, but it should not remove the explanation that helped you make it.</p>
    </div></section>
    <section className="section reviewed-section"><div className="container">
      {error&&<p className="notice">{error}</p>}
      <div className="reviewed-toolbar"><span>{items.length} reviewed recommendation{items.length===1?"":"s"}</span><a className="btn" href="/discover">Back to Discover</a></div>
      {items.length===0?<div className="card discovery-empty"><span className="privacy-kicker">NO HISTORY YET</span><h2>Nothing reviewed yet.</h2><p>Profiles appear here after you choose Interested or Not for me.</p><a className="btn btn-primary" href="/discover">Open Discover</a></div>:
      <div className="reviewed-grid">{items.map(item=><article className="card reviewed-card" key={item.uid}>
        <div className="reviewed-card-top">
          <div className="candidate-identity"><div className="profile-placeholder">{item.firstName.slice(0,1).toUpperCase()}</div><div><h2>{item.firstName}{item.age?`, ${item.age}`:""}</h2><p>{[item.generalLocation,item.occupation].filter(Boolean).join(" · ")}</p></div></div>
          <span className={`reviewed-decision ${item.decision}`}>{item.mutual?"MUTUAL INTRODUCTION":item.decision==="interested"?"INTERESTED":"PASSED"}</span>
        </div>
        <div className="trust-pair"><span><b>{item.authenticityScore}%</b><small>Authenticity</small></span><span><b>{item.compatibilityScore}%</b><small>Compatibility</small></span></div>
        <div className="candidate-badges"><span>{item.authenticityLevel}</span><span>{item.compatibilityLevel} alignment</span><span>{relationshipIntentLabels[item.relationshipIntent]}</span></div>
        <div className="reviewed-summary"><div><small>STRONG ALIGNMENTS</small><p>{item.strongestAlignments.join(" · ")||"No dominant alignment"}</p></div><div><small>WORTH DISCUSSING</small><p>{item.conversationPoints.join(" · ")||"No major structured differences"}</p></div></div>
        <div className="reviewed-footer"><span>{item.reviewedAt?`Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}`:"Previously reviewed"}</span><a className="recommendation-detail-link" href={`/recommendations/${item.uid}`}>View recommendation details →</a></div>
      </article>)}</div>}
    </div></section>
  </main>;
}
