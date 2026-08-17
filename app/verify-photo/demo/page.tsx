"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

function DemoPhotoVerification() {
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
      const response = await fetch("/api/photo-verification/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, outcome }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to complete simulated photo verification.");
      router.replace(outcome === "verified" ? "/dashboard?photoVerification=completed" : "/dashboard?photoVerification=cancelled");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete simulated photo verification.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main><section className="section"><div className="container"><p className="muted">Loading development photo verifier…</p></div></section></main>;

  return <main><section className="section demo-provider-shell"><div className="container">
    <div className="demo-provider card">
      <span className="demo-badge">DEVELOPMENT SIMULATOR — NOT REAL FACE VERIFICATION</span>
      <h1>Profile photo verification simulation</h1>
      <p className="lead">This represents a future provider-hosted photo/face comparison. AutoFace receives only a result and reference. No photo, selfie or biometric template is collected by this simulator.</p>
      <div className="demo-checks">
        <div><span>1</span><div><b>Receive image inside provider boundary</b><small>Simulated outside AutoFace</small></div><strong>Ready</strong></div>
        <div><span>2</span><div><b>Compare against verified identity</b><small>Simulated outside AutoFace</small></div><strong>Ready</strong></div>
        <div><span>3</span><div><b>Return photo-verification outcome</b><small>Status + reference only</small></div><strong>Ready</strong></div>
      </div>
      <div className="hero-actions">
        <button className="btn btn-primary" disabled={busy || !sessionId} onClick={() => finish("verified")}>Simulate successful photo verification</button>
        <button className="btn" disabled={busy || !sessionId} onClick={() => finish("cancelled")}>Cancel verification</button>
      </div>
      {message && <p className="notice status-message">{message}</p>}
    </div>
  </div></section></main>;
}

export default function DemoPhotoVerificationPage() {
  return <Suspense fallback={<main><section className="section"><div className="container"><p className="muted">Loading photo-verification session…</p></div></section></main>}>
    <DemoPhotoVerification />
  </Suspense>;
}
