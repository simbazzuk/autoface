"use client";

import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";
import { Clock3, HeartHandshake, MessageCircle, Bookmark, Sparkles, ArrowRight } from "lucide-react";

type Pending=SafeDiscoveryProfile&{interestId:string;state:"waiting"};
type Mutual=SafeDiscoveryProfile&{matchId:string;state:"introduced"|"talking"|"getting_to_know"|"met"|"progressing";createdAt:string|null};
type Response={waiting:Pending[];mutual:Mutual[];saved:Pending[];counts:{waiting:number;mutual:number;saved:number};error?:string};
const stageLabels={introduced:"Introduced",talking:"Talking",getting_to_know:"Getting to know",met:"Met",progressing:"Connection progressing"} as const;

export default function IntroductionsPage(){
  const {user,loading}=useAuth();
  const router=useRouter();
  const [data,setData]=useState<Response|null>(null);
  const [tab,setTab]=useState<"mutual"|"waiting"|"saved">("mutual");
  const [error,setError]=useState("");

  useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);
  useEffect(()=>{
    if(!user)return;
    const controller=new AbortController();
    (async()=>{
      try{
        const token=await user.getIdToken();
        const response=await fetch("/api/introductions",{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:"no-store"});
        const body=await response.json().catch(()=>({error:`Introductions request failed (${response.status})`}));
        if(!response.ok)throw new Error(body.error??"Unable to load introductions.");
        setData(body);setError("");
      }catch(err){
        if(err instanceof DOMException&&err.name==="AbortError")return;
        setError(err instanceof Error?err.message:"Unable to load introductions.");
        setData({waiting:[],mutual:[],saved:[],counts:{waiting:0,mutual:0,saved:0}});
      }
    })();
    return()=>controller.abort();
  },[user]);

  if(loading||!user||!data)return <main><section className="section"><div className="container"><p className="muted">Preparing your introductions…</p></div></section></main>;

  const items=tab==="mutual"?data.mutual:tab==="waiting"?data.waiting:data.saved;

  return <main>
    <section className="page-hero compact-hero introductions-hero"><div className="container">
      <span className="eyebrow">My Introductions</span>
      <h1>From interest to a real introduction.</h1>
      <p className="lead">Keep track of the people you&apos;re considering, the choices waiting quietly in the background, and the introductions where interest became mutual.</p>
      <div className="intro-summary-strip">
        <span><Clock3 size={16}/><b>{data.counts.waiting}</b><small>Waiting privately</small></span>
        <span><HeartHandshake size={16}/><b>{data.counts.mutual}</b><small>Mutual introductions</small></span>
        <span><Bookmark size={16}/><b>{data.counts.saved}</b><small>Saved for later</small></span>
      </div>
    </div></section>

    <section className="section introductions-section"><div className="container">
      {error&&<p className="notice">{error}</p>}
      <div className="intro-tabs" role="tablist" aria-label="Introduction status">
        <button className={tab==="mutual"?"active":""} onClick={()=>setTab("mutual")}><HeartHandshake size={15}/>Introductions <span>{data.counts.mutual}</span></button>
        <button className={tab==="waiting"?"active":""} onClick={()=>setTab("waiting")}><Clock3 size={15}/>Waiting <span>{data.counts.waiting}</span></button>
        <button className={tab==="saved"?"active":""} onClick={()=>setTab("saved")}><Bookmark size={15}/>Saved <span>{data.counts.saved}</span></button>
      </div>

      {items.length===0?<div className="card intro-empty-state">
        <div className="intro-empty-icon">{tab==="mutual"?<HeartHandshake size={25}/>:tab==="waiting"?<Clock3 size={25}/>:<Bookmark size={25}/>}</div>
        <span className="privacy-kicker">{tab==="mutual"?"MUTUAL BY DESIGN":tab==="waiting"?"PRIVATE INTEREST":"YOUR SHORTLIST"}</span>
        <h2>{tab==="mutual"?"No mutual introductions yet":tab==="waiting"?"Nobody waiting right now":"Nothing saved for later"}</h2>
        <p>{tab==="mutual"?"When someone you chose also independently chooses you, they will appear here and your private Connection space will open.":tab==="waiting"?"Choosing Interested remains private here until it becomes mutual. The other person cannot message you from this state.":"Save profiles in Discovery when you want more time before making a decision."}</p>
        <a className="btn btn-primary" href="/discover">Open Discovery</a>
      </div>:<div className="intro-journey-grid">
        {items.map(item=><article className="card intro-journey-card" key={"matchId" in item?item.matchId:item.interestId}>
          <div className="intro-card-top">
            <div className="candidate-identity">
              <ProfilePhoto uid={item.uid} name={item.firstName} className="intro-profile-photo"/>
              <div><h2>{item.firstName}{item.age?`, ${item.age}`:""}</h2><p>{item.generalLocation??"Location hidden"}</p></div>
            </div>
            {item.isTestProfile&&<span className="status-pill test-profile-pill">TEST</span>}
          </div>
          <div className="intro-card-status">
            {tab==="mutual"?<><HeartHandshake size={16}/><div><small>MUTUAL INTRODUCTION</small><b>{stageLabels[(item as Mutual).state]}</b></div></>:tab==="waiting"?<><Clock3 size={16}/><div><small>INTEREST SAVED PRIVATELY</small><b>Waiting for mutual choice</b></div></>:<><Bookmark size={16}/><div><small>SAVED FOR LATER</small><b>No interest sent</b></div></>}
          </div>
          <div className="intro-mini-signals">
            <span><b>{item.compatibilityScore}%</b><small>Compatibility</small></span>
            <span><b>{item.authenticityScore}%</b><small>Authenticity</small></span>
          </div>
          {tab==="mutual"?<>
            <div className="intro-progress">
              {(["introduced","talking","getting_to_know","met","progressing"] as const).map((stage,index)=>{
                const current=["introduced","talking","getting_to_know","met","progressing"].indexOf((item as Mutual).state);
                return <span className={index<=current?"complete":""} key={stage}><i/><small>{stageLabels[stage]}</small></span>
              })}
            </div>
            <a className="btn btn-relationship intro-open-button" href={`/connections/${(item as Mutual).matchId}`}><MessageCircle size={15}/>Open introduction <ArrowRight size={15}/></a>
          </>:tab==="waiting"?<p className="intro-reassurance"><Sparkles size={14}/>Nothing else is required. If interest becomes mutual, AutoFace will move this person into Introductions and notify you.</p>:<a className="btn intro-review-button" href={`/recommendations/${item.uid}`}>Review recommendation</a>}
        </article>)}
      </div>}

      <div className="card intro-principle"><HeartHandshake size={20}/><div><small>AUTOFACE PRINCIPLE</small><h3>Interested is not a match. Mutual interest creates an introduction.</h3><p>Your choices remain controlled and private until both people independently decide they would like to be introduced.</p></div></div>
    </div></section>
  </main>;
}
