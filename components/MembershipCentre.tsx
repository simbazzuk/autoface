"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Membership = {
  plan?: string;
  status?: string;
  foundingMemberNumber?: number | null;
  foundingAwardedAt?: string | null;
};

type Programme = {
  founderLimit: number;
  foundersAwarded: number;
  founderPlacesRemaining: number;
  founderProgrammeOpen: boolean;
};

type EligibilityChecks = {
  accountVerified?: boolean;
  profileComplete?: boolean;
  atlasProfileComplete?: boolean;
  profilePhotoPresent?: boolean;
  faceVerificationComplete?: boolean;
};

const featureRows = [
  { label: "Considered introductions", free: "Limited", founding: "Expanded", plus: "Expanded" },
  { label: "Messages per introduction", free: "5", founding: "Unlimited", plus: "Unlimited" },
  { label: "Contact-detail sharing", free: "Locked", founding: "Included", plus: "Included" },
  { label: "Atlas Reflection", free: "Limited", founding: "Full", plus: "Full" },
  { label: "Advanced preferences", free: "Locked", founding: "Included", plus: "Included" },
  { label: "Recommendation history", free: "Limited", founding: "Full", plus: "Full" },
];

function normalisePlan(plan?: string) {
  const value = String(plan ?? "free").toLowerCase();
  if (value === "founding" || value === "founder") return "founding";
  if (value === "plus" || value === "paid" || value === "premium") return "plus";
  return "free";
}

export function MembershipCentre() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [checks, setChecks] = useState<EligibilityChecks | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const [membershipResponse, programmeResponse] = await Promise.all([
        fetch("/api/membership", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/founding-program", { cache: "no-store" }),
      ]);

      const membershipBody = await membershipResponse.json().catch(() => ({}));
      const programmeBody = await programmeResponse.json().catch(() => ({}));

      if (!membershipResponse.ok) {
        throw new Error(membershipBody.error ?? "Unable to load membership.");
      }

      setMembership(membershipBody.membership ?? null);
      if (programmeResponse.ok) setProgramme(programmeBody.programme ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load membership.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user]);

  async function checkFounderEligibility() {
    if (!user || checking) return;
    try {
      setChecking(true);
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
        setMessage(`Welcome — Founding Member #${body.founderNumber} is now active.`);
      } else if (body.alreadyFounder) {
        setMessage(`Your Founding Membership is already active${body.membership?.foundingMemberNumber ? ` — Founder #${body.membership.foundingMemberNumber}` : ""}.`);
      } else if (!body.programme?.founderProgrammeOpen) {
        setMessage("All Founding Member places have now been allocated.");
      } else {
        setMessage("Complete the remaining eligibility steps to qualify for a Founder place.");
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to check Founder eligibility.");
    } finally {
      setChecking(false);
    }
  }

  const plan = useMemo(() => normalisePlan(membership?.plan), [membership?.plan]);
  const remaining = programme?.founderPlacesRemaining ?? 0;
  const limit = programme?.founderLimit ?? 20;
  const founderNumber = membership?.foundingMemberNumber ?? null;

  if (!user) {
    return (
      <div className="membership-empty card">
        <span className="membership-plan-pill free">AUTOFACE FREE</span>
        <h2>Sign in to see your membership.</h2>
        <p>Your Membership Centre shows your current plan, Founder eligibility and premium feature access.</p>
        <Link className="btn btn-primary" href="/sign-in">Sign in</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="membership-empty card"><h2>Loading your membership…</h2></div>;
  }

  const planTitle =
    plan === "founding" ? `Founding Member${founderNumber ? ` #${String(founderNumber).padStart(2, "0")}` : ""}` :
    plan === "plus" ? "AutoFace Plus" :
    "AutoFace Free";

  const planCopy =
    plan === "founding"
      ? "Lifetime launch membership. Thank you for helping establish the AutoFace community."
      : plan === "plus"
        ? "Your paid AutoFace membership with the full messaging and Atlas experience."
        : "Your starting membership. Complete your profile and verification while Founder places remain.";

  return (
    <div className="membership-centre">
      <section className={`membership-current-card ${plan}`}>
        <div className="membership-current-main">
          <span className={`membership-plan-pill ${plan}`}>
            {plan === "founding" ? "FOUNDING MEMBER" : plan === "plus" ? "AUTOFACE PLUS" : "AUTOFACE FREE"}
          </span>
          <h2>{planTitle}</h2>
          <p>{planCopy}</p>
          <div className="membership-status-row">
            <span><i /> Membership status</span>
            <strong>{String(membership?.status ?? "active").replaceAll("_", " ")}</strong>
          </div>
        </div>

        {plan === "founding" ? (
          <div className="membership-highlight founder">
            <span>YOUR FOUNDER NUMBER</span>
            <strong>#{String(founderNumber ?? "—").padStart(2, "0")}</strong>
            <small>Permanent Founder status</small>
          </div>
        ) : plan === "plus" ? (
          <div className="membership-highlight plus">
            <span>YOUR PLAN</span>
            <strong>PLUS</strong>
            <small>Subscription managed by AutoFace</small>
          </div>
        ) : (
          <div className="membership-highlight free">
            <span>FOUNDING PROGRAMME</span>
            <strong>{remaining}</strong>
            <small>of {limit} Founder places remaining</small>
          </div>
        )}
      </section>

      <section className="membership-feature-card">
        <div className="membership-section-heading">
          <div>
            <span className="privacy-kicker">YOUR ACCESS</span>
            <h2>What your membership includes</h2>
          </div>
          <Link href="/pricing">Compare plans →</Link>
        </div>

        <div className="membership-feature-table">
          <div className="membership-feature-head">
            <span>Feature</span><span>Your access</span>
          </div>
          {featureRows.map((row) => {
            const value = plan === "founding" ? row.founding : plan === "plus" ? row.plus : row.free;
            const locked = value === "Locked";
            return (
              <div className="membership-feature-row" key={row.label}>
                <span>{row.label}</span>
                <strong className={locked ? "locked" : ""}>{locked ? "🔒 " : "✓ "}{value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      {plan === "free" && (
        <section className="membership-founder-card">
          <div>
            <span className="privacy-kicker">FOUNDING MEMBER ELIGIBILITY</span>
            <h2>{remaining > 0 ? `${remaining} of ${limit} Founder places remain` : "Founding Membership is full"}</h2>
            <p>Founder status is not something you buy or switch on. AutoFace automatically awards it to eligible verified members while launch places remain.</p>
          </div>

          {checks && (
            <div className="membership-check-grid">
              {[
                ["Email verified", checks.accountVerified],
                ["Profile completed", checks.profileComplete],
                ["Atlas Profile completed", checks.atlasProfileComplete],
                ["Profile picture added", checks.profilePhotoPresent],
                ["Face Verification completed", checks.faceVerificationComplete],
              ].map(([label, ok]) => (
                <span className={ok ? "complete" : ""} key={String(label)}>
                  <i>{ok ? "✓" : "•"}</i>{String(label)}
                </span>
              ))}
            </div>
          )}

          <div className="membership-actions">
            <button className="btn btn-relationship" disabled={checking || remaining === 0} onClick={() => void checkFounderEligibility()}>
              {checking ? "Checking…" : remaining === 0 ? "Founder places allocated" : "Check my Founder eligibility"}
            </button>
            <Link className="btn" href="/pricing">View Founder programme</Link>
          </div>
        </section>
      )}

      {plan === "founding" && (
        <section className="membership-founder-thanks">
          <div className="membership-founder-mark">★</div>
          <div>
            <span className="privacy-kicker">LIFETIME FOUNDER BENEFITS</span>
            <h2>You helped start AutoFace.</h2>
            <p>Your Founder status is permanent. You do not need a subscription to keep the Founder feature set.</p>
          </div>
        </section>
      )}

      {plan === "plus" && (
        <section className="membership-plus-note card">
          <span className="privacy-kicker">BILLING</span>
          <h2>AutoFace Plus</h2>
          <p>Payment management will appear here when the production subscription integration is enabled.</p>
        </section>
      )}

      {message && <div className="membership-message">{message}</div>}
    </div>
  );
}
