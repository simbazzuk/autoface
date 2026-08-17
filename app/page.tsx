import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Brain, LockKeyhole, ShieldCheck, UserCheck, UsersRound } from "lucide-react";

export default function Home() {
  return <main>
    <section className="hero"><div className="container">
      <Image src="/autoface-logo.png" alt="AutoFace robot logo" width={128} height={128} className="hero-logo" priority />
      <span className="eyebrow">AutoFace v0.1 · Security-first foundation</span>
      <h1>Real people.<br/>Real compatibility.</h1>
      <p className="lead">Meaningful relationships should start with confidence. AutoFace is being designed around authenticity, privacy and explainable compatibility — not endless swiping.</p>
      <div className="hero-actions"><Link href="/early-access" className="btn btn-primary">Join early access</Link><Link href="/trust" className="btn">Explore our trust approach</Link></div>
      <div className="trust-strip">
        <div className="mini"><strong>Identity without data hoarding</strong><span>Designed so AutoFace does not need to store passport or driving licence images.</span></div>
        <div className="mini"><strong>Authenticity by evidence</strong><span>Verification levels are based on clear security signals, not opaque AI judgement.</span></div>
        <div className="mini"><strong>Privacy by default</strong><span>Personal information is only collected when it has a defined purpose.</span></div>
      </div>
    </div></section>

    <section className="section"><div className="container">
      <div className="section-head"><span className="eyebrow">Why AutoFace</span><h2>Trust before matching.</h2><p>Version 0.1 deliberately focuses on the foundation. Matching, messaging and matrimonial profiles come later, after the security and privacy model is established.</p></div>
      <div className="grid-3">
        <div className="card"><div className="icon"><UserCheck size={21}/></div><h3>Real people</h3><p>A progressive verification model can distinguish a basic account from a strongly identity-verified member.</p></div>
        <div className="card"><div className="icon"><ShieldCheck size={21}/></div><h3>Security first</h3><p>Email, mobile, MFA/passkeys and later third-party identity verification form independent layers of assurance.</p></div>
        <div className="card"><div className="icon"><Brain size={21}/></div><h3>Atlas later</h3><p>Atlas will eventually explain compatibility. It does not decide whether a person's identity is genuine.</p></div>
      </div>
    </div></section>

    <section className="section"><div className="container callout">
      <div className="grid-2"><div><span className="eyebrow">Zero-ID storage principle</span><h2 style={{marginTop:18}}>Verify the person. Don't keep the document.</h2><p className="muted">The intended verification architecture sends identity-document and liveness checks to a specialist provider. AutoFace stores the verification outcome and minimal reference data, not copies of identity documents.</p><Link href="/trust" className="btn" style={{marginTop:10}}>See the privacy model</Link></div>
      <div className="card"><LockKeyhole size={28}/><h3 style={{marginTop:18}}>Designed not to store</h3><div className="checklist"><div className="check"><span>Passport image</span><b>Not stored</b></div><div className="check"><span>Driving licence image</span><b>Not stored</b></div><div className="check"><span>Biometric template</span><b>Not stored</b></div><div className="check"><span>Verification outcome</span><b className="ok">Stored minimally</b></div></div></div></div>
    </div></section>

    <section className="section"><div className="container"><div className="section-head"><span className="eyebrow">Future journey</span><h2>From identity to introduction.</h2></div><div className="flow"><div className="step"><b>01 · Verify</b><p>Establish the account and authenticity signals.</p></div><div className="step"><b>02 · Understand</b><p>Build a relationship profile only after privacy foundations are ready.</p></div><div className="step"><b>03 · Match</b><p>Use deterministic compatibility dimensions with Atlas explanations.</p></div><div className="step"><b>04 · Introduce</b><p>Mutual consent before private communication.</p></div></div></div></section>

    <section className="section"><div className="container"><div className="callout" style={{textAlign:'center'}}><BadgeCheck size={32}/><h2 style={{marginTop:16}}>Help shape AutoFace.</h2><p className="lead">Join early access while we build the trust and authenticity layer first.</p><Link href="/early-access" className="btn btn-primary" style={{marginTop:24}}><UsersRound size={18}/>Join early access</Link></div></div></section>
  </main>;
}
