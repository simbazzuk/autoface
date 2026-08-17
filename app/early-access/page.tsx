"use client";
import { FormEvent, useState } from "react";

export default function EarlyAccess(){
 const [status,setStatus]=useState<"idle"|"sending"|"done"|"error">("idle");
 async function submit(e:FormEvent<HTMLFormElement>){
   e.preventDefault(); setStatus("sending");
   const fd=new FormData(e.currentTarget);
   const res=await fetch("/api/early-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:fd.get("name"),email:fd.get("email")})});
   setStatus(res.ok?"done":"error");
 }
 return <main><section className="page-hero"><div className="container"><span className="eyebrow">Early access</span><h1>Help shape AutoFace.</h1><p className="lead">Version 0.1 is focused on security, privacy and authenticity. Join the early-access list for future product testing.</p></div></section><section className="section"><div className="container">
   <form className="form" onSubmit={submit}>
     <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required placeholder="Your name"/></div>
     <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required placeholder="you@example.com"/></div>
     <button className="btn btn-primary" disabled={status==="sending"}>{status==="sending"?"Joining...":"Join early access"}</button>
     {status==="done"&&<p className="notice" style={{marginTop:16}}>Thanks — your interest has been captured for this demo build.</p>}
     {status==="error"&&<p className="notice" style={{marginTop:16}}>Something went wrong. Please try again.</p>}
     <p className="muted" style={{fontSize:13}}>v0.1 stores early-access submissions locally in the application data file for development only. Replace this with your production datastore before launch.</p>
   </form>
 </div></section></main>
}
