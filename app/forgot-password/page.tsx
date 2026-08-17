"use client";
import { FormEvent,useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
export default function ForgotPasswordPage(){
 const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [message,setMessage]=useState("");
 async function submit(e:FormEvent){e.preventDefault();if(!auth){setMessage("Password reset is unavailable right now.");return}try{setBusy(true);setMessage("");await sendPasswordResetEmail(auth,email);setSent(true)}catch{setSent(true)}finally{setBusy(false)}}
 return <main><section className="page-hero compact-hero"><div className="container"><span className="eyebrow">Account recovery</span><h1>Reset your password.</h1><p className="lead">Enter the email address used for AutoFace. If an account exists, Firebase will send a secure reset link.</p></div></section><section className="section auth-polish-section"><div className="container auth-polish-layout"><form className="form" onSubmit={submit}>{sent?<><div className="launch-success"><b>Check your email</b><span>If an AutoFace account exists for {email}, a password-reset link has been sent.</span></div><Link className="btn btn-primary" href="/sign-in">Return to sign in</Link></>:<><div className="field"><label>Email</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div><button className="btn btn-primary" disabled={busy}>{busy?"Sending…":"Send reset link"}</button></>}{message&&<p className="notice">{message}</p>}</form><aside className="card auth-side-note"><span className="privacy-kicker">SECURITY</span><h3>Reset links stay with Firebase Authentication.</h3><p>AutoFace never needs to know or email your password.</p></aside></div></section></main>
}
