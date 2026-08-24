"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { calculateAuthenticity, type AuthenticitySignals } from "@/lib/authenticity";

type CheckKey = keyof AuthenticitySignals;

type VerificationCheck = {
  key: CheckKey;
  label: string;
  weight: string;
  available: boolean;
  summary: string;
  detail: string;
};

const checks: VerificationCheck[] = [
  {
    key: "emailVerified",
    label: "Email verification",
    weight: "+20",
    available: true,
    summary: "Confirms access to the email address on your AutoFace account.",
    detail: "Email verification confirms that you control the email address used to register. It is an account-trust signal and does not establish your legal identity.",
  },
  {
    key: "phoneVerified",
    label: "Mobile verification",
    weight: "+25",
    available: true,
    summary: "Confirms access to a mobile number linked to your account.",
    detail: "Mobile verification adds an independent account signal and makes disposable or automated account creation harder. It does not mean AutoFace has verified a government-issued identity document.",
  },
  {
    key: "photoVerified",
    label: "Face verification",
    weight: "+55",
    available: true,
    summary: "Confirms a successful live face check and one-to-one match with your current profile photo.",
    detail: "Amazon Rekognition performs a short Face Liveness check and AutoFace compares the resulting reference image one-to-one with your current profile photo. This is used only for authenticity and never for compatibility scoring.",
  },
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [identitySignals, setIdentitySignals] = useState({ identityVerified: false, livenessVerified: false, photoVerified: false });
  const recaptcha = useRef<RecaptchaVerifier | null>(null);
  const recaptchaAttempt = useRef(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    return () => {
      recaptcha.current?.clear();
      recaptcha.current = null;
      const container = document.getElementById("recaptcha-container");
      if (container) container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(doc(db, "identity", user.uid), (snapshot) => {
      const data = snapshot.data();
      setIdentitySignals({
        identityVerified: data?.identityVerified === true,
        livenessVerified: data?.livenessVerified === true,
        photoVerified: data?.photoVerified === true,
      });
    });
  }, [user]);

  const signals = useMemo<AuthenticitySignals>(() => ({
    emailVerified: Boolean(user?.emailVerified),
    phoneVerified: Boolean(user?.phoneNumber),
    mfaEnabled: false,
    identityVerified: false,
    livenessVerified: false,
    photoVerified: identitySignals.photoVerified,
  }), [user, identitySignals]);

  const result = calculateAuthenticity(signals);
  const nextCheck = checks.find((check) => !signals[check.key] && check.available);

  async function resend() {
    if (!user || busy) return;
    try {
      setBusy(true);
      await sendEmailVerification(user);
      setMessage("Verification email sent. Open the email and then return to AutoFace.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to send verification email.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPhone() {
    if (!auth || !user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      // A Firebase reCAPTCHA widget may only be rendered once into a given DOM container.
      // Dispose any previous verifier and empty the host before each new SMS attempt.
      recaptcha.current?.clear();
      recaptcha.current = null;
      const container = document.getElementById("recaptcha-container");
      if (!container) throw new Error("Phone verification is not ready. Please refresh and try again.");
      container.replaceChildren();
      recaptchaAttempt.current += 1;
      recaptcha.current = new RecaptchaVerifier(auth, container, { size: "invisible" });
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(phone.trim(), recaptcha.current);
      setVerificationId(id);
      setMessage("Verification code ready. For Firebase test numbers, use the code configured in the Firebase console.");
    } catch (e) {
      recaptcha.current?.clear();
      recaptcha.current = null;
      const container = document.getElementById("recaptcha-container");
      if (container) container.replaceChildren();
      setMessage(e instanceof Error ? e.message : "Unable to send verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone() {
    if (!user || !verificationId || busy) return;
    try {
      setBusy(true);
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await linkWithCredential(user, credential);
      await user.reload();
      setMessage("Mobile number verified. Updating your authenticity score…");
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to verify the code.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <main><section className="section"><div className="container"><p className="muted">Loading secure identity…</p></div></section></main>;
  }

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Authenticity Centre</span>
          <h1>Build your authenticity.</h1>
          <p className="lead">Your authenticity status reflects verification checks that AutoFace actually performs today—not AI judgement, popularity or profile attractiveness.</p>
        </div>
      </section>

      <section className="section dashboard-section">
        <div className="container grid-2 dashboard-grid">
          <div className="card score-card">
            <div className="score-head">
              <div>
                <span className="muted">Authenticity</span>
                <div className="score">{result.score}%</div>
              </div>
              <span className="status-pill">{result.level}</span>
            </div>

            <div className="meter" aria-label={`Authenticity score ${result.score}%`}>
              <span style={{ width: `${result.score}%` }} />
            </div>
            <div className="progress-meta">
              <span>{result.completed} of {result.total} verification signals completed</span>
              <span>{100 - result.score}% still available</span>
            </div>

            {nextCheck && (
              <div className="next-step">
                <span className="next-label">NEXT STEP</span>
                <strong>{nextCheck.label}</strong>
                <span>{nextCheck.summary}</span>
              </div>
            )}

            <div className="verification-list">
              {checks.map((check) => {
                const done = signals[check.key];
                return (
                  <details className="verification-item" key={check.key}>
                    <summary>
                      <span className="verification-name">
                        <span className={`verification-mark ${done ? "done" : ""}`}>{done ? "✓" : "○"}</span>
                        <span>
                          <strong>{check.label}</strong>
                          <small>{check.summary}</small>
                        </span>
                      </span>
                      <span className={done ? "ok" : "verification-weight"}>{done ? "Verified" : check.weight}</span>
                    </summary>
                    <p>{check.detail}</p>
                    {!check.available && !done && <span className="coming-soon">Planned capability</span>}
                  </details>
                );
              })}
            </div>
          </div>

          <div className="card security-card">
            <div className="card-title-row">
              <div>
                <h3>Secure your account</h3>
                <p className="account-email">{user.email}</p>
              </div>
            </div>

            {!signals.emailVerified && (
              <div className="security-action">
                <div>
                  <strong>Verify your email</strong>
                  <p>Confirm access to the email address used for this account.</p>
                </div>
                <button className="btn" disabled={busy} onClick={resend}>Resend verification</button>
              </div>
            )}

            <div className="security-action mobile-action">
              <div className="action-copy">
                <strong>Verify mobile</strong>
                <p>Add an independent verification signal to your AutoFace account.</p>
              </div>

              {signals.phoneVerified ? (
                <p className="notice">✓ {user.phoneNumber} is verified.</p>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="mobile">Mobile number including country code</label>
                    <input id="mobile" inputMode="tel" autoComplete="tel" placeholder="+447700900000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <button className="btn" disabled={busy || !phone.trim()} onClick={sendPhone}>Send verification code</button>

                  {verificationId && (
                    <div className="otp-panel">
                      <div className="field">
                        <label htmlFor="verification-code">Verification code</label>
                        <input id="verification-code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" disabled={busy || !code.trim()} onClick={verifyPhone}>Verify mobile</button>
                    </div>
                  )}
                  <div id="recaptcha-container" />
                </>
              )}
            </div>

            {message && <p className="notice status-message">{message}</p>}

            <div className="security-action identity-action face-verification-action">
              <div className="face-verification-header">
                <div>
                  <strong>Face verification</strong>
                  <p>Live camera check + one-to-one comparison with your current profile photo.</p>
                </div>
                <span className={`face-status-badge ${signals.photoVerified ? "verified" : "pending"}`}>
                  {signals.photoVerified ? "✓ Verified" : "Verification needed"}
                </span>
              </div>

              {signals.photoVerified ? (
                <div className="face-verification-result verified">
                  <div className="face-result-icon" aria-hidden="true">✓</div>
                  <div className="face-result-copy">
                    <b>Verification complete</b>
                    <span>Your current profile photo has been successfully face verified.</span>
                  </div>
                </div>
              ) : (
                <div className="face-verification-result pending">
                  <div className="face-result-icon" aria-hidden="true">•</div>
                  <div className="face-result-copy">
                    <b>Verification required</b>
                    <span>Complete the live face check to strengthen your authenticity status.</span>
                  </div>
                </div>
              )}

              <div className="face-verification-footer">
                <div className="facial-principle">Used for authenticity only — never compatibility or ranking.</div>
                <button className={`btn ${signals.photoVerified ? "" : "btn-primary"}`} onClick={() => router.push("/verify-face")}>
                  {signals.photoVerified ? "View verification" : "Verify my face"}
                </button>
              </div>
            </div>

            <div className="privacy-box">
              <span className="privacy-kicker">PRIVACY BY DESIGN</span>
              <b>Minimal verification data</b>
              <p>AutoFace does not ask for or store passport or driving-licence images as part of the current authenticity journey.</p>
              <p className="privacy-note">Face Verification uses AWS Face Liveness and a one-to-one profile-photo comparison. AutoFace records the verification outcome and security metadata; users cannot self-award verification status.</p>
            </div>

            <button className="btn danger" onClick={() => auth && signOut(auth)}>Sign out</button>
          </div>
        </div>
      </section>
    </main>
  );
}
