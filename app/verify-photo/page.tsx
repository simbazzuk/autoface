"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";

export default function VerifyPhotoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !db) return;
    (async () => {
      const snap = await getDoc(doc(db, "identity", user.uid));
      const data = snap.data();
      if (data?.photoVerified === true) {
        setMessage("Your photo verification signal is already complete.");
        setEligible(false);
        return;
      }
      setEligible(data?.identityVerified === true && data?.livenessVerified === true);
    })().catch(() => {
      setEligible(false);
      setMessage("Unable to read your verification status.");
    });
  }, [user]);

  async function start() {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/photo-verification/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to start photo verification.");
      window.location.assign(data.redirectUrl);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to start photo verification.";
      setMessage(raw === "IDENTITY_REQUIRED"
        ? "Complete identity + liveness verification first."
        : raw === "SERVER_NOT_CONFIGURED"
          ? "Server-side Firebase Admin is not configured."
          : raw === "PROVIDER_NOT_CONFIGURED"
            ? "A production photo-verification provider has not been configured. Use demo mode for development."
            : raw);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || eligible === null) {
    return <main><section className="section"><div className="container"><p className="muted">Loading photo verification…</p></div></section></main>;
  }

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Photo Verification · v0.9</span>
      <h1>Connect the profile image to the verified person.</h1>
      <p className="lead">A production provider can compare profile imagery against verified identity evidence in its hosted journey. AutoFace records the verification result—not the biometric comparison data.</p>
    </div></section>

    <section className="section dashboard-section"><div className="container verification-layout">
      <div className="card provider-card">
        <span className="privacy-kicker">PHOTO VERIFICATION BOUNDARY</span>
        <h2>One more authenticity signal</h2>
        <p>Photo verification is worth <b>+15 authenticity points</b>. It is intentionally separate from identity and liveness so members can see exactly which evidence has been completed.</p>

        <div className="data-boundary">
          <div><b>Provider processes</b><span>Profile image presented for verification</span><span>Verified identity evidence</span><span>Face/photo comparison</span></div>
          <div className="boundary-arrow">→</div>
          <div><b>AutoFace stores</b><span>Photo verified: yes / no</span><span>Provider reference</span><span>Verification timestamp</span><span>Assurance type</span></div>
        </div>

        <div className="notice verification-warning"><b>Development mode:</b> v0.9 uses a simulator. It performs no facial comparison and requests no selfie or biometric information.</div>

        {eligible
          ? <button className="btn btn-primary" disabled={busy} onClick={start}>{busy ? "Starting…" : "Start photo verification"}</button>
          : <Link className="btn btn-primary" href="/dashboard">Back to Authenticity Centre</Link>}
        {message && <p className="notice status-message">{message}</p>}
      </div>

      <aside className="card verification-sidecard">
        <span className="privacy-kicker">DATA MINIMISATION</span>
        <h3>AutoFace does not need the biometric payload.</h3>
        <div className="no-store-list">
          <span>✕ Raw verification selfie</span>
          <span>✕ Face embedding / template</span>
          <span>✕ Biometric similarity vector</span>
          <span>✕ Raw liveness video</span>
          <span>✕ Identity-document image</span>
        </div>
        <p>The eventual provider contract and DPIA must validate this boundary before production use.</p>
        <Link className="btn" href="/trust">Trust & Privacy</Link>
      </aside>
    </div></section>
  </main>;
}
