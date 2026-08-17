import { Database, Fingerprint, KeyRound, ShieldCheck } from "lucide-react";

export default function Trust(){
  return <main><section className="page-hero"><div className="container"><span className="eyebrow">Trust & Privacy</span><h1>Designed to know less, not more.</h1><p className="lead">AutoFace follows a data-minimisation approach: collect only what is needed, separate identity assurance from relationship data, and avoid holding identity documents wherever possible.</p></div></section>
  <section className="section"><div className="container"><div className="grid-2">
    <div className="card"><div className="icon"><Database size={21}/></div><h3>Minimal data model</h3><p>AutoFace should retain the verification result, level, timestamp and provider reference — not copies of passports or driving licences.</p></div>
    <div className="card"><div className="icon"><Fingerprint size={21}/></div><h3>External identity verification</h3><p>Future document and liveness checks are intended to be performed by a specialist provider, with AutoFace receiving only the minimum result needed.</p></div>
    <div className="card"><div className="icon"><KeyRound size={21}/></div><h3>Layered account security</h3><p>Email verification, mobile verification and MFA/passkeys create a baseline before stronger identity verification is added.</p></div>
    <div className="card"><div className="icon"><ShieldCheck size={21}/></div><h3>Explainable authenticity</h3><p>Authenticity is based on visible evidence such as verification methods. It is not a judgement of whether somebody is trustworthy or safe.</p></div>
  </div></div></section>
  <section className="section"><div className="container callout"><span className="eyebrow">Important</span><h2 style={{marginTop:18}}>Identity Verified does not mean “Safe Person”.</h2><p className="muted">Verification can provide confidence that a profile belongs to the person presenting it. It cannot guarantee intentions, conduct or future behaviour. Reporting, moderation and user controls will remain separate safeguards.</p></div></section>
  </main>
}
