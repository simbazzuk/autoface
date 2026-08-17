"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function VerifyIdentityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  async function startVerification() {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/verification/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to start identity verification.");
      window.location.assign(data.redirectUrl);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to start verification.";
      setMessage(raw === "SERVER_NOT_CONFIGURED"
        ? "Server-side Firebase Admin is not configured yet. Add the v0.3 server environment variables and restart AutoFace."
        : raw === "PROVIDER_NOT_CONFIGURED"
          ? "A production identity provider has not been connected yet. Use demo mode for development or configure a provider adapter."
          : raw);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main><section className="section"><div className="container"><p className="muted">Loading secure verification…</p></div></section></main>;

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Identity Verification · v0.3</span>
          <h1>Prove you’re really you.</h1>
          <p className="lead">AutoFace is designed to receive verification evidence from a specialist provider—not your passport, driving licence or biometric files.</p>
        </div>
      </section>

      <section className="section dashboard-section">
        <div className="container verification-layout">
          <div className="card provider-card">
            <span className="privacy-kicker">VERIFICATION BOUNDARY</span>
            <h2>Identity + liveness</h2>
            <p>A production provider will perform document and liveness checks in its own hosted verification journey. AutoFace receives only the outcome and a provider reference needed for audit and support.</p>

            <div className="data-boundary">
              <div><b>Provider processes</b><span>ID document</span><span>Selfie / liveness</span><span>Identity comparison</span></div>
              <div className="boundary-arrow">→</div>
              <div><b>AutoFace stores</b><span>Verified / not verified</span><span>Checks completed</span><span>Provider reference</span><span>Verification timestamp</span></div>
            </div>

            <div className="notice verification-warning"><b>Development mode:</b> v0.3 includes a simulator so you can test the integration boundary before selecting a production verification provider. It does not perform a real identity check.</div>

            <button className="btn btn-primary" disabled={busy} onClick={startVerification}>{busy ? "Starting…" : "Start identity verification"}</button>
            {message && <p className="notice status-message">{message}</p>}
          </div>

          <aside className="card verification-sidecard">
            <span className="privacy-kicker">ZERO-ID STORAGE</span>
            <h3>What AutoFace will not ask you to upload</h3>
            <div className="no-store-list">
              <span>✕ Passport image</span>
              <span>✕ Driving-licence image</span>
              <span>✕ Passport number</span>
              <span>✕ Biometric template</span>
              <span>✕ Raw liveness video</span>
            </div>
            <p>When a production provider is selected, its processing and retention terms must be reviewed before launch.</p>
            <Link className="btn" href="/dashboard">Back to Authenticity Centre</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
