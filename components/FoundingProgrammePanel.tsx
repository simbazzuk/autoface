"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Programme = {
  founderLimit: number;
  foundersAwarded: number;
  founderPlacesRemaining: number;
  nextFounderNumber: number;
  founderProgrammeOpen: boolean;
};

type EligibilityChecks = {
  accountVerified: boolean;
  profileComplete: boolean;
  atlasProfileComplete: boolean;
  profilePhotoPresent: boolean;
  faceVerificationComplete: boolean;
};

export function FoundingProgrammePanel() {
  const { user } = useAuth();
  const [programme,setProgramme] = useState<Programme | null>(null);
  const [checks,setChecks] = useState<EligibilityChecks | null>(null);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/founding-program", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (response.ok) setProgramme(body.programme ?? null);
    } catch {
      setProgramme(null);
    }
  }

  useEffect(() => { void load(); }, []);

  async function checkEligibility() {
    if (!user || busy) return;
    try {
      setBusy(true);
      setMessage("");
      const token = await user.getIdToken();
      const response = await fetch("/api/founding-program", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to check Founder eligibility.");

      setProgramme(body.programme ?? null);
      setChecks(body.eligibility?.checks ?? null);

      if (body.awarded) {
        setMessage(`Welcome — you are AutoFace Founding Member #${body.founderNumber}. Your Founder benefits are now active.`);
      } else if (body.alreadyFounder) {
        setMessage(`Your Founding Membership is already active${body.membership?.foundingMemberNumber ? ` — Founder #${body.membership.foundingMemberNumber}` : ""}.`);
      } else if (!body.programme?.founderProgrammeOpen) {
        setMessage("All 20 Founding Member places have now been allocated.");
      } else {
        setMessage("Your Founder place is not allocated yet. Complete the eligibility steps shown below and check again.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check Founder eligibility.");
    } finally {
      setBusy(false);
    }
  }

  const limit = programme?.founderLimit ?? 20;
  const awarded = programme?.foundersAwarded ?? 0;
  const remaining = programme?.founderPlacesRemaining ?? Math.max(0, limit - awarded);
  const percentage = limit > 0 ? Math.min(100, Math.round((awarded / limit) * 100)) : 0;

  const requirements = [
    ["Email verified", checks?.accountVerified],
    ["Profile completed", checks?.profileComplete],
    ["Atlas Profile completed", checks?.atlasProfileComplete],
    ["Profile picture added", checks?.profilePhotoPresent],
    ["Face Verification completed", checks?.faceVerificationComplete],
  ] as const;

  return <section className="founder-programme-pricing">
    <div className="founder-programme-header">
      <div>
        <span className="privacy-kicker">LAUNCH FOUNDING PROGRAMME</span>
        <h2>The first 20 verified members become Founding Members.</h2>
        <p>Founder status is awarded automatically when an eligible member completes the AutoFace setup and verification journey. It cannot be selected manually in Profile or Settings.</p>
      </div>
      <div className={`founder-availability ${remaining === 0 ? "full" : ""}`}>
        <strong>{remaining}</strong>
        <span>of {limit} Founder places remaining</span>
      </div>
    </div>

    <div className="founder-counter">
      <div><span>{awarded} allocated</span><b>{remaining} remaining</b></div>
      <div className="founder-counter-track"><i style={{width:`${percentage}%`}} /></div>
      <small>Founder numbers are permanent and are never recycled.</small>
    </div>

    <div className="founder-tier-grid">
      <article>
        <span className="founder-tier-badge">FREE</span>
        <h3>AutoFace Free</h3>
        <strong>£0</strong>
        <p>The default plan for every new member while they complete their profile and start meeting people.</p>
        <ul>
          <li>Profile + Atlas Profile</li>
          <li>Face Verification</li>
          <li>Limited Discover</li>
          <li>Mutual introductions</li>
          <li>5 messages per introduction</li>
        </ul>
      </article>

      <article className="founder-tier-featured">
        <span className="founder-tier-badge">FIRST 20 VERIFIED MEMBERS</span>
        <h3>Founding Member</h3>
        <strong>Lifetime launch access</strong>
        <p>Automatically awarded — there is no Founder switch and no payment required to claim a launch place.</p>
        <ul>
          <li>Unlimited messaging</li>
          <li>Contact-detail sharing</li>
          <li>Expanded Discover</li>
          <li>Atlas Reflection</li>
          <li>Advanced preferences + full history</li>
          <li>Permanent Founder number</li>
        </ul>
      </article>

      <article>
        <span className="founder-tier-badge">COMING SOON</span>
        <h3>AutoFace Plus</h3>
        <strong>Paid membership</strong>
        <p>After the Founder places are allocated, members will be able to purchase Plus for premium AutoFace capabilities.</p>
        <ul>
          <li>Unlimited messaging</li>
          <li>Contact-detail sharing</li>
          <li>Premium Atlas capabilities</li>
          <li>Expanded matching controls</li>
          <li>Managed through payment/subscription status</li>
        </ul>
      </article>
    </div>

    <div className="founder-eligibility-box">
      <div>
        <span className="privacy-kicker">HOW FOUNDER STATUS IS AWARDED</span>
        <h3>Complete AutoFace — we handle the rest.</h3>
        <p>When all requirements are complete, AutoFace atomically checks whether a Founder place remains and allocates the next permanent number.</p>
      </div>

      <div className="founder-requirements">
        {requirements.map(([label,passed]) => <span className={passed === true ? "complete" : passed === false ? "incomplete" : ""} key={label}>
          <i>{passed === true ? "✓" : "•"}</i>{label}
        </span>)}
      </div>

      {user
        ? <button className="btn btn-relationship" disabled={busy || remaining === 0} onClick={() => void checkEligibility()}>
            {busy ? "Checking…" : remaining === 0 ? "Founder places allocated" : "Check my Founder eligibility"}
          </button>
        : <a className="btn btn-relationship" href="/sign-in">Sign in to check eligibility</a>}
      {message && <p className="notice">{message}</p>}
    </div>
  </section>;
}
