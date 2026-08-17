"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
export default function VerifyEmailPage(){
 const {user,loading}=useAuth();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function refresh(){if(!user)return;await user.reload();window.location.reload()}
 async function resend(){if(!user)return;try{setBusy(true);await sendEmailVerification(user);setMessage("Verification email sent. Check your inbox and spam folder.")}catch{setMessage("Please wait before requesting another verification email.")}finally{setBusy(false)}}
 if(loading)return <main><section className="section"><div className="container"><p className="muted">Checking your account…</p></div></section></main>;
 return <main><section className="page-hero compact-hero"><div className="container"><span className="eyebrow">Email verification</span><h1>{user?.emailVerified?"Email verified.":"Verify your email."}</h1><p className="lead">{user?.emailVerified?"Your account email is confirmed. You can continue setting up AutoFace.":"Open the verification link sent by Firebase, then return here and check again."}</p></div></section><section className="section auth-polish-section"><div className="container"><div className="card verify-email-card">{!user?<><h2>Sign in first</h2><p>Sign in to check or resend your verification email.</p><Link className="btn btn-primary" href="/sign-in">Sign in</Link></>:user.emailVerified?<><div className="launch-success"><b>Verified</b><span>{user.email}</span></div><Link className="btn btn-primary" href="/get-started">Continue Getting Started</Link></>:<><span className="privacy-kicker">SENT TO</span><h2>{user.email}</h2><p>After clicking the link in your email, use “I’ve verified” to refresh your Firebase account status.</p><div className="verify-actions"><button className="btn btn-primary" onClick={()=>void refresh()}>I've verified</button><button className="btn" disabled={busy} onClick={()=>void resend()}>{busy?"Sending…":"Resend email"}</button></div>{message&&<p className="notice">{message}</p>}</>}</div></div></section></main>
}
