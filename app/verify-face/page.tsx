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

type CameraDiagnostic = {
  status: "idle" | "checking" | "passed" | "failed";
  message?: string;
  deviceLabel?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  errorName?: string;
  awsCompatible?: boolean;
};

const AWS_MIN_SHORT_EDGE = 480;
const AWS_MIN_LONG_EDGE = 640;
const AWS_MIN_FPS = 15;

function isAwsCompatible(width?: number, height?: number, frameRate?: number) {
  if (!width || !height) return false;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const fpsOk = !frameRate || frameRate >= AWS_MIN_FPS;
  return shortEdge >= AWS_MIN_SHORT_EDGE && longEdge >= AWS_MIN_LONG_EDGE && fpsOk;
}

function cameraFailureMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "CameraError";
  const raw = error instanceof Error ? error.message : "The browser could not open the camera.";

  const guidance: Record<string, string> = {
    NotAllowedError: "Camera access was blocked by Chrome or Windows. Allow the camera for this site and enable Windows camera access for desktop apps.",
    PermissionDeniedError: "Camera access was blocked by Chrome or Windows. Allow the camera for this site and enable Windows camera access for desktop apps.",
    NotFoundError: "No usable camera was found. Check that the webcam is connected and enabled in Windows.",
    DevicesNotFoundError: "No usable camera was found. Check that the webcam is connected and enabled in Windows.",
    NotReadableError: "The camera exists but could not be opened. Close Teams, Zoom, Camera, OBS and other apps using the webcam, then retry.",
    TrackStartError: "The camera exists but could not be opened. Close Teams, Zoom, Camera, OBS and other apps using the webcam, then retry.",
    OverconstrainedError: "The selected camera could not satisfy the requested video settings. Try another physical webcam in Chrome camera settings.",
    SecurityError: "The browser blocked camera access for security reasons. Use the HTTPS Vercel/AutoFace URL rather than an insecure page.",
    AbortError: "The camera start was interrupted. Close other camera apps and retry.",
  };

  return { name, message: guidance[name] ?? raw };
}

export default function VerifyFacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [cameraDiagnostic, setCameraDiagnostic] = useState<CameraDiagnostic>({ status: "idle" });
  const [biometricConsent, setBiometricConsent] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  const browserReady = useMemo(() => Boolean(identityPoolId), []);

  async function runCameraDiagnostic() {
    if (typeof window === "undefined" || !window.isSecureContext) {
      const diagnostic: CameraDiagnostic = {
        status: "failed",
        errorName: "SecurityError",
        message: "Camera access requires a secure HTTPS page. Open the deployed AutoFace HTTPS URL and retry.",
      };
      setCameraDiagnostic(diagnostic);
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const diagnostic: CameraDiagnostic = {
        status: "failed",
        errorName: "MediaDevicesUnavailable",
        message: "This browser does not expose camera access to AutoFace. Update Chrome or try a supported device/browser.",
      };
      setCameraDiagnostic(diagnostic);
      return false;
    }

    setCameraDiagnostic({ status: "checking", message: "Opening your camera for a quick pre-flight check…" });

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          frameRate: { min: AWS_MIN_FPS, ideal: 30 },
        },
        audio: false,
      });
      const [track] = stream.getVideoTracks();
      if (!track) throw new DOMException("No video track was returned by the selected camera.", "NotFoundError");

      // Ask the browser to favour an AWS-compatible capture mode even when the
      // camera's default mode is a very low resolution such as 160x120.
      try {
        await track.applyConstraints({
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 },
          frameRate: { min: AWS_MIN_FPS, ideal: 30 },
        });
      } catch {
        // getUserMedia already negotiated the best available stream. The
        // compatibility check below will explain if the result is insufficient.
      }

      const settings = track.getSettings();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const selectedDevice = devices.find((device) => device.kind === "videoinput" && device.deviceId === settings.deviceId);
      const label = track.label || selectedDevice?.label || "Physical camera detected";
      const compatible = isAwsCompatible(settings.width, settings.height, settings.frameRate);

      setCameraDiagnostic({
        status: compatible ? "passed" : "failed",
        message: compatible
          ? "AWS-compatible camera mode confirmed. AutoFace can access this webcam at a suitable resolution and frame rate."
          : `The camera opened, but the negotiated video mode does not meet the AWS Face Liveness minimum. AutoFace needs at least ${AWS_MIN_SHORT_EDGE}×${AWS_MIN_LONG_EDGE} (either orientation) and ${AWS_MIN_FPS} fps. Try another camera or update the webcam driver.`,
        deviceLabel: label,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        awsCompatible: compatible,
        errorName: compatible ? undefined : "AwsCameraRequirementsNotMet",
      });
      return compatible;
    } catch (error) {
      const mapped = cameraFailureMessage(error);
      setCameraDiagnostic({ status: "failed", errorName: mapped.name, message: mapped.message });
      return false;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async function startVerification() {
    if (!user || busy) return;
    if (!biometricConsent) {
      setMessage("Please confirm your biometric verification consent before continuing.");
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      setResult(null);

      const cameraReady = await runCameraDiagnostic();
      if (!cameraReady) return;

      // Give Windows/Chrome a moment to release the pre-flight camera stream before
      // AWS Amplify opens the same physical webcam for the liveness session.
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      configureAmplify();
      const token = await user.getIdToken();
      const response = await fetch("/api/face-verification/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ biometricConsent: true, consentVersion: "2026-08-v1" }),
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
      const raw = error instanceof Error ? error.message : "Unable to read verification result.";
      setMessage(raw === "PROFILE_PHOTO_CHANGED"
        ? "Your primary profile photo changed during verification. Start a new face check so AutoFace can verify the current photo."
        : raw);
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

          <div className="biometric-privacy-panel">
            <div className="biometric-privacy-heading">
              <span className="biometric-privacy-shield" aria-hidden="true">✓</span>
              <div>
                <span className="privacy-kicker">YOUR FACE DATA & PRIVACY</span>
                <h3>How AutoFace uses your photo and live face check</h3>
                <p>We are transparent about how your photo and face verification are used.</p>
              </div>
            </div>

            <div className="biometric-privacy-grid">
              <div className="biometric-info-row info-blue">
                <span className="biometric-info-icon" aria-hidden="true">◉</span>
                <div><strong>Profile photo</strong><p>Your profile photo is stored with your AutoFace profile and is used only as the reference photo for this one-to-one verification.</p></div>
              </div>
              <div className="biometric-info-row info-green">
                <span className="biometric-info-icon" aria-hidden="true">✓</span>
                <div><strong>Live face check</strong><p>Amazon Rekognition performs a short liveness check to confirm that a real person is present in front of the camera.</p></div>
              </div>
              <div className="biometric-info-row info-purple">
                <span className="biometric-info-icon" aria-hidden="true">⌁</span>
                <div><strong>Face match</strong><p>The resulting live reference image is compared one-to-one with your profile photo. AutoFace does not search your face against other members or create an AWS face collection for member identification.</p></div>
              </div>
              <div className="biometric-info-row info-orange">
                <span className="biometric-info-icon" aria-hidden="true">▣</span>
                <div><strong>What AutoFace records</strong><p>AutoFace records the verification outcome, provider, date and security event information needed to operate the trust feature. Face verification is separate from compatibility scoring.</p></div>
              </div>
              <div className="biometric-info-row info-teal">
                <span className="biometric-info-icon" aria-hidden="true">i</span>
                <div><strong>Your privacy rights</strong><p>Biometric verification involves processing facial biometric data. You can choose not to verify. Read the <Link href="/privacy#biometric-verification">Biometric Verification privacy information</Link> before continuing.</p></div>
              </div>
            </div>

            <label className={`biometric-consent ${biometricConsent ? "consent-selected" : ""}`}>
              <input type="checkbox" checked={biometricConsent} onChange={(event) => setBiometricConsent(event.target.checked)} />
              <span className="biometric-consent-icon" aria-hidden="true">✓</span>
              <span><strong>I explicitly consent to AutoFace processing my biometric data for face verification.</strong><small>I understand that I can choose not to verify my face and can withdraw consent for future biometric processing through AutoFace privacy controls.</small></span>
            </label>
          </div>

          <div className="camera-diagnostic-actions">
            <button className="btn" disabled={busy} onClick={runCameraDiagnostic}>
              {cameraDiagnostic.status === "checking" ? "Testing camera…" : "Test camera"}
            </button>
            <button className="btn btn-primary" disabled={busy || !browserReady || !biometricConsent} onClick={startVerification}>{busy ? "Starting…" : "Verify my face"}</button>
          </div>

          {cameraDiagnostic.status !== "idle" && <div className={`camera-diagnostic ${cameraDiagnostic.status}`}>
            <div className="camera-diagnostic-icon">{cameraDiagnostic.status === "passed" ? "✓" : cameraDiagnostic.status === "failed" ? "!" : "…"}</div>
            <div>
              <strong>{cameraDiagnostic.status === "passed" ? "Camera ready" : cameraDiagnostic.status === "failed" ? "AWS camera compatibility check failed" : "Checking camera"}</strong>
              {cameraDiagnostic.message && <p>{cameraDiagnostic.message}</p>}
              {cameraDiagnostic.deviceLabel && <small>Camera: {cameraDiagnostic.deviceLabel}</small>}
              {(cameraDiagnostic.width || cameraDiagnostic.height || cameraDiagnostic.frameRate) && <small>Video: {cameraDiagnostic.width ?? "?"}×{cameraDiagnostic.height ?? "?"}{cameraDiagnostic.frameRate ? ` • ${cameraDiagnostic.frameRate.toFixed(0)} fps` : ""}</small>}
              {cameraDiagnostic.errorName && <small>Browser error: <code>{cameraDiagnostic.errorName}</code></small>}
            </div>
          </div>}

          {!browserReady && <p className="muted face-helper">The page is intentionally disabled until the Cognito Identity Pool is configured.</p>}
        </>}

        {sessionId && <div className="aws-liveness-shell">
          <ThemeProvider>
            <FaceLivenessDetector
              sessionId={sessionId}
              region={region}
              onAnalysisComplete={finishVerification}
              onError={(error) => {
                const awsMessage = error?.error?.message ?? "The live face check could not be completed.";
                setMessage(`${awsMessage} If the camera pre-flight above passes, this points to the AWS liveness session rather than Chrome camera permission.`);
              }}
            />
          </ThemeProvider>
        </div>}

        {result && result.verified && <div className="face-result success">
          <span className="face-result-icon">✓</span>
          <div>
            <h3>Face Verified</h3>
            <p>Your live check passed and matched your AutoFace profile photo.</p>
            {typeof result.livenessConfidence === "number" && <small>Liveness confidence: {result.livenessConfidence.toFixed(1)}%</small>}
            {typeof result.faceSimilarity === "number" && <small>Face similarity: {result.faceSimilarity.toFixed(1)}%</small>}
          </div>
        </div>}

        {result && !result.verified && <div className="face-failure-wrap">
          <div className="face-failure-hero">
            <span className="face-failure-icon" aria-hidden="true">×</span>
            <div>
              <h3>We couldn't verify this attempt</h3>
              <p>Your live check did not match your profile photo closely enough, so no Face Verified badge has been added.</p>
              <strong>You can try again.</strong>
              <span>Use a clear, front-facing profile photo and make sure your face is well lit and fully visible to the camera.</span>
            </div>
          </div>

          <div className="face-failure-details">
            <h4>What happened</h4>
            <div className="face-failure-metrics">
              {typeof result.livenessConfidence === "number" && <div className="face-metric metric-live">
                <span className="metric-icon" aria-hidden="true">✓</span>
                <div><small>Liveness confidence</small><strong>{result.livenessConfidence.toFixed(1)}%</strong><em>{result.livenessConfidence >= 90 ? "Passed" : "Needs another check"}</em><p>{result.livenessConfidence >= 90 ? "We detected a real person in front of the camera." : "The live-person check did not meet the verification threshold."}</p></div>
              </div>}
              {typeof result.faceSimilarity === "number" && <div className="face-metric metric-match">
                <span className="metric-icon" aria-hidden="true">⌁</span>
                <div><small>Face similarity</small><strong>{result.faceSimilarity.toFixed(1)}%</strong><em>{result.faceSimilarity >= 90 ? "Matched" : "Too low"}</em><p>{result.faceSimilarity >= 90 ? "The live reference image matched your profile photo." : "Your live face did not match the current profile photo closely enough."}</p></div>
              </div>}
            </div>
            <div className="face-failure-tips">
              <strong>Tips to improve your next attempt</strong>
              <span>✓ Use a recent, clear, front-facing profile photo</span>
              <span>✓ Face the camera directly in good lighting</span>
              <span>✓ Remove sunglasses, hats or heavy filters</span>
            </div>
          </div>
        </div>}

        {message && <p className="notice status-message">{message}</p>}
        {result && <div className="face-result-actions"><Link className="btn btn-primary" href="/dashboard">Back to Authenticity Centre</Link>{!result.verified && <button className="btn face-retry-btn" onClick={() => setResult(null)}>↻ Try again</button>}</div>}
      </div>

      <aside className="card verification-sidecard">
        <span className="privacy-kicker">PRIVACY BY DESIGN</span>
        <h3>Verification, not a searchable face database.</h3>
        <p>v0.35.3 uses Rekognition as a one-to-one verification step and validates the webcam against AWS Face Liveness resolution and frame-rate requirements before starting the session. AutoFace does not create an AWS face collection for member discovery or identification.</p>
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
