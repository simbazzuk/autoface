"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Programme = {
  founderLimit: number;
  foundersAwarded: number;
  founderPlacesRemaining: number;
  founderProgrammeOpen: boolean;
};

const DISMISS_KEY = "autoface-founder-discovery-dismissed-at";
const DISMISS_MS = 24 * 60 * 60 * 1000;

export function FounderDiscovery() {
  const { user, loading } = useAuth();
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [membershipPlan, setMembershipPlan] = useState("free");
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/founding-program", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setProgramme(body.programme ?? null);
      } catch {
        if (!cancelled) setProgramme(null);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) {
      setMembershipPlan("free");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/membership", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));

        if (!cancelled && response.ok) {
          setMembershipPlan(String(body.membership?.plan ?? "free").toLowerCase());
        }
      } catch {
        if (!cancelled) setMembershipPlan("free");
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (
      loading ||
      user ||
      !programme?.founderProgrammeOpen ||
      programme.founderPlacesRemaining <= 0
    ) {
      setShowPopup(false);
      return;
    }

    let dismissedRecently = false;

    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      const dismissedAt = raw ? Number(raw) : 0;
      dismissedRecently =
        Number.isFinite(dismissedAt) &&
        Date.now() - dismissedAt < DISMISS_MS;
    } catch {
      dismissedRecently = false;
    }

    if (!dismissedRecently) {
      const timer = window.setTimeout(() => setShowPopup(true), 1400);
      return () => window.clearTimeout(timer);
    }
  }, [loading, user, programme]);

  const plan = useMemo(() => {
    if (membershipPlan === "founding" || membershipPlan === "founder") return "founding";
    if (membershipPlan === "plus" || membershipPlan === "paid" || membershipPlan === "premium") return "plus";
    return "free";
  }, [membershipPlan]);

  const remaining = programme?.founderPlacesRemaining ?? 0;
  const limit = programme?.founderLimit ?? 20;
  const open =
    programme?.founderProgrammeOpen === true &&
    remaining > 0;

  function dismiss() {
    setShowPopup(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage is only used to avoid repeatedly showing the welcome card.
    }
  }

  if (!open || plan === "founding") return null;

  return (
    <>
      <section className="founder-discovery-banner" aria-label="AutoFace Founding Programme">
        <div className="founder-discovery-banner-icon" aria-hidden="true">✦</div>

        <div className="founder-discovery-banner-content">
          <span className="founder-discovery-banner-kicker">FOUNDING PROGRAMME</span>
          <h2>Become one of the first 20 AutoFace members</h2>
          <p>
            Complete your profile and verification journey to qualify for permanent
            Founding Member status.
          </p>

          <div className="founder-discovery-banner-status">
            <strong>{remaining} of {limit}</strong>
            <span>Founder places remaining</span>
          </div>
        </div>

        <div className="founder-discovery-banner-action">
          {user ? (
            <Link className="btn btn-relationship" href="/membership">
              Check my eligibility
            </Link>
          ) : (
            <Link className="btn btn-relationship" href="/register">
              Create my profile →
            </Link>
          )}
        </div>
      </section>

      {showPopup && !user && (
        <div
          className="founder-discovery-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <section
            className="founder-discovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="founder-discovery-title"
          >
            <button
              className="founder-discovery-close"
              type="button"
              onClick={dismiss}
              aria-label="Close"
            >
              ×
            </button>

            <div className="founder-discovery-icon" aria-hidden="true">✦</div>
            <span className="privacy-kicker">AUTOFACE FOUNDING PROGRAMME</span>
            <h2 id="founder-discovery-title">
              Become one of AutoFace&apos;s first 20 Founding Members.
            </h2>
            <p>
              Help shape the AutoFace community from the beginning. Complete your
              profile and verification journey to qualify for permanent Founding
              Member status and the full Founder feature set.
            </p>

            <div className="founder-discovery-count">
              <strong>{remaining}</strong>
              <span>of {limit} Founder places remaining</span>
            </div>

            <div className="founder-discovery-benefits">
              <span>✓ Lifetime Founder status</span>
              <span>✓ Unlimited messaging</span>
              <span>✓ Full Atlas features</span>
              <span>✓ Permanent Founder number</span>
            </div>

            <div className="founder-discovery-actions">
              <Link
                className="btn btn-relationship"
                href="/register"
                onClick={dismiss}
              >
                Create my profile
              </Link>
              <Link className="btn" href="/pricing" onClick={dismiss}>
                See Founder benefits
              </Link>
            </div>

            <small>
              Founder places are allocated automatically to the first {limit} eligible
              verified members. Founder status cannot be purchased or manually selected.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
