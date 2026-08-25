"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareHeart, Star } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const categories = [
  ["matching", "Matching & recommendations"],
  ["atlas", "Atlas"],
  ["introductions", "Introductions & messaging"],
  ["verification", "Verification & authenticity"],
  ["experience", "App experience"],
  ["other", "Other"],
] as const;

export default function FeedbackPage(){
  const {user,loading}=useAuth(); const router=useRouter();
  const [rating,setRating]=useState(0); const [category,setCategory]=useState("experience");
  const [message,setMessage]=useState(""); const [contact,setContact]=useState(false);
  const [sending,setSending]=useState(false); const [sent,setSent]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{if(!loading&&!user)router.replace("/sign-in")},[loading,user,router]);
  async function submit(e:FormEvent){e.preventDefault();if(!user||sending||rating<1||message.trim().length<3)return;setSending(true);setError("");
    try{const token=await user.getIdToken();const response=await fetch("/api/beta-feedback",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({category,message,rating,contactAllowed:contact,source:"feedback_page"})});const body=await response.json();if(!response.ok)throw new Error(body.error??"Unable to send feedback.");setSent(true);setMessage("");setRating(0);setContact(false)}catch(e){setError(e instanceof Error?e.message:"Unable to send feedback.")}finally{setSending(false)}}
  if(loading||!user)return <main><section className="section"><div className="container"><p className="muted">Preparing feedback…</p></div></section></main>;
  return <main><section className="page-hero compact-hero feedback-hero"><div className="container"><span className="eyebrow">Help shape AutoFace</span><h1>Your experience matters.</h1><p className="lead">Tell us what is working, what feels unclear and what would make AutoFace more useful. Feedback is reviewed as product feedback — it never changes your compatibility or authenticity score.</p></div></section>
  <section className="section"><div className="container feedback-layout"><form className="card feedback-card" onSubmit={submit}><div className="feedback-heading"><MessageSquareHeart/><div><span className="privacy-kicker">PRODUCT FEEDBACK</span><h2>How are we doing?</h2></div></div>
  <label>Overall experience</label><div className="feedback-stars" aria-label="Rate AutoFace from 1 to 5">{[1,2,3,4,5].map(n=><button type="button" key={n} className={rating>=n?"active":""} onClick={()=>setRating(n)} aria-label={`${n} star${n>1?"s":""}`}><Star size={25}/></button>)}</div>
  <label htmlFor="feedback-category">What is this about?</label><select id="feedback-category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>
  <label htmlFor="feedback-message">Your feedback</label><textarea id="feedback-message" maxLength={1200} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What worked well? What could we improve?"/><small className="feedback-count">{message.length}/1200</small>
  <label className="feedback-contact"><input type="checkbox" checked={contact} onChange={e=>setContact(e.target.checked)}/><span><b>AutoFace can contact me about this feedback</b><small>Optional. We will use the email on your account only to follow up on this feedback.</small></span></label>
  {error&&<p className="notice">{error}</p>}{sent&&<p className="feedback-success">✓ Thank you. Your feedback has been received.</p>}<button className="btn btn-primary" disabled={sending||rating<1||message.trim().length<3}>{sending?"Sending…":"Send feedback"}</button></form>
  <aside className="card feedback-side"><span className="privacy-kicker">PRIVATE BY DESIGN</span><h2>Feedback is separate from matching.</h2><p>Your rating and comments are used to improve AutoFace. Atlas does not use this feedback to alter who you see, your compatibility score or your authenticity score.</p><div className="feedback-side-rule"/><h3>Founding members help build the product</h3><p>Early feedback helps us decide which parts of AutoFace deserve the most attention before wider launch.</p></aside></div></section></main>
}
