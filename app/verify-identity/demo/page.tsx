"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function DemoVerification() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  async function finish(outcome: "verified" | "cancelled") {
    if (!user || !sessionId || busy) return;
    try {
      setBusy(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/verification/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, outcome }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to complete simulated verification.");
      if (outcome === "verified") router.replace("/dashboard?verification=completed");
      else router.replace("/dashboard?verification=cancelled");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete simulated verification.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main><section className="section"><div className="container"><p className="muted">Loading development verifier…</p></div></section></main>;

  return (
    <main>
      <section className="section demo-provider-shell">
        <div className="container">
          <div className="demo-provider card">
            <span className="demo-badge">DEVELOPMENT SIMULATOR — NOT REAL ID VERIFICATION</span>
            <h1>External provider simulation</h1>
            <p className="lead">This page represents the hosted journey a real identity provider would own. No passport, driving licence, selfie or biometric information is requested here.</p>

            <div className="demo-checks">
              <div><span>1</span><div><b>Identity document check</b><small>Simulated outside AutoFace</small></div><strong>Ready</strong></div>
              <div><span>2</span><div><b>Selfie + liveness</b><small>Simulated outside AutoFace</small></div><strong>Ready</strong></div>
              <div><span>3</span><div><b>Return verification result</b><small>Only status and reference return to AutoFace</small></div><strong>Ready</strong></div>
            </div>

            <div className="hero-actions">
              <button className="btn btn-primary" disabled={busy || !sessionId} onClick={() => finish("verified")}>Simulate successful verification</button>
              <button className="btn" disabled={busy || !sessionId} onClick={() => finish("cancelled")}>Cancel verification</button>
            </div>
            {message && <p className="notice status-message">{message}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DemoVerificationPage() {
  return <Suspense fallback={<main><section className="section"><div className="container"><p className="muted">Loading verification session…</p></div></section></main>}><DemoVerification /></Suspense>;
}
