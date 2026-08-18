"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  multiFactor,
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
    weight: "+10",
    available: true,
    summary: "Confirms access to the email address on your AutoFace account.",
    detail: "Email verification is a basic account signal. It confirms that you control the email address used to register, but it does not establish your real-world identity.",
  },
  {
    key: "phoneVerified",
    label: "Mobile verification",
    weight: "+15",
    available: true,
    summary: "Confirms access to a mobile number linked to your account.",
    detail: "Mobile verification adds a second independent account signal and makes disposable or automated account creation harder. It still does not mean AutoFace has verified your legal identity.",
  },
  {
    key: "mfaEnabled",
    label: "MFA / passkey",
    weight: "+10",
    available: false,
    summary: "Strengthens account security with an additional sign-in factor.",
    detail: "This is planned for the next security iteration. MFA or passkeys reduce the risk of account takeover even if a password is compromised.",
  },
  {
    key: "identityVerified",
    label: "Identity verification",
    weight: "+30",
    available: true,
    summary: "Confirms a real-world identity check through the identity-verification boundary.",
    detail: "In development, AutoFace uses a clearly labelled simulator. In production this signal must come from a specialist identity provider; AutoFace stores the outcome and provider reference rather than identity-document images.",
  },
  {
    key: "livenessVerified",
    label: "Liveness verification",
    weight: "+20",
    available: true,
    summary: "Confirms that liveness evidence formed part of the identity-verification result.",
    detail: "The external verification boundary is responsible for any liveness processing. AutoFace records only the completed check, provider reference and timestamp—not raw liveness media or biometric templates.",
  },
  {
    key: "photoVerified",
    label: "Facial verification",
    weight: "+15",
    available: false,
    summary: "Coming soon — a secure live facial check to strengthen authenticity.",
    detail: "Facial verification is planned as a specialist-provider integration. It will be used for authenticity only and will never influence compatibility, ranking or Atlas recommendations.",
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

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

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
    mfaEnabled: Boolean(user ? multiFactor(user).enrolledFactors.length : false),
    identityVerified: identitySignals.identityVerified,
    livenessVerified: identitySignals.livenessVerified,
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
      if (!recaptcha.current) {
        recaptcha.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      }
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(phone, recaptcha.current);
      setVerificationId(id);
      setMessage("Verification code ready. For Firebase test numbers, use the code configured in the Firebase console.");
    } catch (e) {
      recaptcha.current?.clear();
      recaptcha.current = null;
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
      setMessage("Mobile number verified. Upintroductions your authenticity score…");
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
          <p className="lead">Your score comes from explicit verification evidence—not AI judgement, popularity or profile attractiveness.</p>
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

            <div className="security-action identity-action">
              <div className="action-copy">
                <strong>Identity + liveness verification</strong>
                <p>Continue to the identity-verification boundary. In development this uses a clearly labelled simulator; production will use a specialist provider.</p>
              </div>
              {signals.identityVerified && signals.livenessVerified ? (
                <p className="notice">✓ Identity and liveness evidence recorded.</p>
              ) : (
                <button className="btn btn-primary" onClick={() => router.push("/verify-identity")}>Verify identity</button>
              )}
            </div>

            <div className="security-action identity-action facial-coming-soon">
              <div className="action-copy">
                <div className="facial-title-row"><strong>Facial verification</strong><span className="coming-soon">COMING SOON</span></div>
                <p>Use a secure live facial check to strengthen your authenticity. A specialist provider will perform liveness and verification outside the AutoFace matching engine.</p>
                <div className="facial-principle">Used for authenticity, never matching.</div>
              </div>
              <button className="btn" disabled>Verify my face · Coming soon</button>
            </div>

            <div className="privacy-box">
              <span className="privacy-kicker">PRIVACY BY DESIGN</span>
              <b>Zero-ID Storage</b>
              <p>AutoFace does not store passport images, driving-licence images, raw verification selfies or biometric templates.</p>
              <p className="privacy-note">Identity and liveness results are written server-side after a provider session; users cannot self-award these verification signals.</p>
            </div>

            <button className="btn danger" onClick={() => auth && signOut(auth)}>Sign out</button>
          </div>
        </div>
      </section>
    </main>
  );
}
