"use client";

import "@aws-amplify/ui-react/styles.css";
import "@aws-amplify/ui-react-liveness/styles.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Amplify } from "aws-amplify";
import { FaceLivenessDetector } from "@aws-amplify/ui-react-liveness";
import { ThemeProvider } from "@aws-amplify/ui-react";
import { useAuth } from "@/components/AuthProvider";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "eu-west-1";
const identityPoolId = process.env.NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID || "";

let amplifyConfigured = false;
function configureAmplify() {
  if (amplifyConfigured || !identityPoolId) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        identityPoolId,
        allowGuestAccess: true,
      },
    },
  });
  amplifyConfigured = true;
}

type Result = {
  verified?: boolean;
  status?: string;
  livenessConfidence?: number;
  faceSimilarity?: number;
  error?: string;
};

export default function VerifyFacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  const browserReady = useMemo(() => Boolean(identityPoolId), []);

  async function startVerification() {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      setResult(null);
      configureAmplify();
      const token = await user.getIdToken();
      const response = await fetch("/api/face-verification/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to start face verification.");
      if (data.status === "already_verified") {
        setResult({ verified: true, status: "VERIFIED" });
        return;
      }
      if (!data.sessionId) throw new Error("AWS_SESSION_NOT_CREATED");
      setSessionId(data.sessionId);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to start face verification.";
      setMessage(raw === "PROFILE_PHOTO_REQUIRED"
        ? "Add a profile photo before starting face verification."
        : raw === "AWS_REKOGNITION_NOT_CONFIGURED"
          ? "AWS Rekognition is not configured on the server yet. Add the v0.35.0 AWS environment variables first."
          : raw);
    } finally {
      setBusy(false);
    }
  }

  async function finishVerification() {
    if (!user || !sessionId) return;
    try {
      setBusy(true);
      setMessage("Checking your liveness result and matching it to your profile photo…");
      const token = await user.getIdToken();
      const response = await fetch("/api/face-verification/result", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to read verification result.");
      setResult(data);
      setMessage("");
      setSessionId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read verification result.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main><section className="section"><div className="container"><p className="muted">Loading face verification…</p></div></section></main>;

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">AutoFace Trust • AWS Rekognition</span>
      <h1>Prove the person is real — and matches the profile photo.</h1>
      <p className="lead">A short live camera check confirms liveness. AutoFace then performs a one-to-one comparison against your existing profile photo before displaying the Face Verified signal.</p>
    </div></section>

    <section className="section dashboard-section"><div className="container verification-layout">
      <div className="card provider-card face-verification-card">
        <span className="privacy-kicker">FACE VERIFICATION</span>
        <h2>{sessionId ? "Complete your live face check" : result?.verified ? "Face verification complete" : "Ready when you are"}</h2>

        {!sessionId && !result?.verified && <>
          <div className="face-check-steps">
            <div><b>1</b><span><strong>Profile photo</strong><small>Your existing AutoFace photo is used for the 1:1 comparison.</small></span></div>
            <div><b>2</b><span><strong>Live camera check</strong><small>AWS Rekognition checks that a real person is in front of the camera.</small></span></div>
            <div><b>3</b><span><strong>Face match</strong><small>The live reference image is compared with your profile photo.</small></span></div>
          </div>

          {!browserReady && <div className="notice verification-warning"><b>AWS browser setup required:</b> add <code>NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID</code>. This Identity Pool is only used to sign the Rekognition liveness stream; Firebase remains the AutoFace login system.</div>}

          <button className="btn btn-primary" disabled={busy || !browserReady} onClick={startVerification}>{busy ? "Starting…" : "Verify my face"}</button>
          {!browserReady && <p className="muted face-helper">The page is intentionally disabled until the Cognito Identity Pool is configured.</p>}
        </>}

        {sessionId && <div className="aws-liveness-shell">
          <ThemeProvider>
            <FaceLivenessDetector
              sessionId={sessionId}
              region={region}
              onAnalysisComplete={finishVerification}
              onError={(error) => setMessage(error?.error?.message ?? "The live face check could not be completed.")}
            />
          </ThemeProvider>
        </div>}

        {result && <div className={`face-result ${result.verified ? "success" : "failed"}`}>
          <span className="face-result-icon">{result.verified ? "✓" : "!"}</span>
          <div>
            <h3>{result.verified ? "Face Verified" : "We couldn't verify this attempt"}</h3>
            <p>{result.verified ? "Your live check passed and matched your AutoFace profile photo." : "No badge has been added. You can retry when you're ready."}</p>
            {typeof result.livenessConfidence === "number" && <small>Liveness confidence: {result.livenessConfidence.toFixed(1)}%</small>}
            {typeof result.faceSimilarity === "number" && <small>Face similarity: {result.faceSimilarity.toFixed(1)}%</small>}
          </div>
        </div>}

        {message && <p className="notice status-message">{message}</p>}
        {result && <div className="face-result-actions"><Link className="btn btn-primary" href="/dashboard">Back to Authenticity Centre</Link>{!result.verified && <button className="btn" onClick={() => setResult(null)}>Try again</button>}</div>}
      </div>

      <aside className="card verification-sidecard">
        <span className="privacy-kicker">PRIVACY BY DESIGN</span>
        <h3>Verification, not a searchable face database.</h3>
        <p>v0.35.0 uses Rekognition as a one-to-one verification step. AutoFace does not create an AWS face collection for member discovery or identification.</p>
        <div className="no-store-list">
          <span>✓ Firebase remains your account identity</span>
          <span>✓ Only the verification outcome is trusted by AutoFace</span>
          <span>✓ No public biometric score</span>
          <span>✓ No face search across other members</span>
        </div>
        <Link className="btn" href="/trust">Trust & Privacy</Link>
      </aside>
    </div></section>
  </main>;
}
