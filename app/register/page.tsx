"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function RegisterPage(){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [inviteCode,setInviteCode]=useState("");
  const [inviteRequired,setInviteRequired]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    fetch("/api/beta-access",{cache:"no-store"}).then(r=>r.json()).then(b=>setInviteRequired(b.inviteRequired===true)).catch(()=>{});
  },[]);

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!auth){setMessage("Firebase is not configured.");return;}
    if(!accepted){setMessage("Please accept the Terms and Privacy Notice before creating an account.");return;}

    try{
      setBusy(true);
      setMessage("");

      if(inviteRequired){
        const validate=await fetch("/api/beta-access",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"validate",code:inviteCode})
        });
        const validation=await validate.json().catch(()=>({}));
        if(!validate.ok)throw new Error(validation.error==="INVITE_UNAVAILABLE"?"This beta invitation has already been fully used.":"This beta invitation is not valid.");
      }

      const credential=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(credential.user,{displayName:name});

      if(inviteRequired){
        const token=await credential.user.getIdToken();
        const claim=await fetch("/api/beta-access",{
          method:"POST",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
          body:JSON.stringify({action:"claim",code:inviteCode})
        });
        const claimed=await claim.json().catch(()=>({}));
        if(!claim.ok)throw new Error(claimed.error==="INVITE_UNAVAILABLE"?"The invitation became unavailable. Please contact AutoFace beta support.":"Unable to activate beta access.");
      }

      await sendEmailVerification(credential.user);
      setMessage("Account created. Check your email for the verification link, then continue with Getting Started.");
    }catch(err){
      setMessage(err instanceof Error?err.message:"Could not create account");
    }finally{setBusy(false);}
  }

  return <main>
    <section className="page-hero launch-register-hero"><div className="container">
      <span className="eyebrow">Controlled beta</span>
      <h1>Create your AutoFace account.</h1>
      <p className="lead">Start with an email account, then build your profile and authenticity evidence at your own pace. AutoFace does not ask you to upload identity documents directly.</p>
    </div></section>
    <section className="section launch-register-section"><div className="container launch-register-layout">
      <form className="form launch-register-form" onSubmit={submit}>
        {inviteRequired&&<div className="beta-invite-banner"><b>Invitation-only beta</b><span>Enter the invitation code supplied by AutoFace.</span></div>}
        {inviteRequired&&<div className="field"><label>Beta invitation code</label><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} required placeholder="e.g. BETA-FOUNDERS-01" autoComplete="off"/></div>}
        <div className="field"><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div>
        <div className="field"><label>Password</label><input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password"/><small>Use at least 8 characters. Avoid reusing a password from another service.</small></div>
        <label className="launch-consent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I agree to the <Link href="/terms" target="_blank">Beta Terms</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Notice</Link>.</span></label>
        <button className="btn btn-primary" disabled={busy||!accepted}>{busy?"Creating account…":"Create account"}</button>
        {message&&<p className="notice">{message}</p>}
        <p className="muted">Already registered? <Link href="/sign-in"><b>Sign in</b></Link></p>
      </form>

      <aside className="launch-register-side">
        <div className="card"><span className="privacy-kicker">WHAT HAPPENS NEXT</span><h3>A guided setup, not a rush to match.</h3><div className="launch-step-list"><span><b>1</b>Email verification</span><span><b>2</b>Your profile</span><span><b>3</b>Atlas relationship profile</span><span><b>4</b>Authenticity evidence</span><span><b>5</b>You choose when to enable Discovery</span></div></div>
        <div className="card launch-trust-note"><span className="privacy-kicker">YOUR CONTROL</span><p>You can pause Discovery, export AutoFace-held data or delete your account from Account & Privacy.</p></div>
      </aside>
    </div></section>
  </main>;
}
