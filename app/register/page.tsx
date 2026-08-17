"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function RegisterPage(){
 const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault(); if(!auth){setMessage("Firebase is not configured. Add your keys to .env.local first.");return;} try{setBusy(true); const c=await createUserWithEmailAndPassword(auth,email,password); await updateProfile(c.user,{displayName:name}); await sendEmailVerification(c.user); setMessage("Account created. We sent a verification link to your email.");}catch(err){setMessage(err instanceof Error?err.message:"Could not create account");}finally{setBusy(false)}}
 return <main><section className="page-hero"><div className="container"><span className="eyebrow">AutoFace Identity · v0.2</span><h1>Create your secure identity.</h1><p className="lead">Start with email verification. AutoFace does not ask you to upload identity documents in this release.</p></div></section><section className="section"><div className="container"><form className="form" onSubmit={submit}><div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} required /></div><div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div><div className="field"><label>Password</label><input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></div><button className="btn btn-primary" disabled={busy}>{busy?"Creating…":"Create secure account"}</button>{message&&<p className="notice">{message}</p>}<p className="muted">Already registered? <Link href="/sign-in"><b>Sign in</b></Link></p></form></div></section></main>
}
