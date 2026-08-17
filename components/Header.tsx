"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { auth, db } from "@/lib/firebase";
import { calculateAuthenticity } from "@/lib/authenticity";
import { NotificationBell } from "@/components/NotificationBell";
import { AdminLink } from "@/components/AdminLink";

type HeaderIdentity = {
  firstName: string;
  authenticityScore: number;
  authenticityLevel: string;
};

export function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [identity, setIdentity] = useState<HeaderIdentity | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isTestProfile = Boolean(user?.email?.endsWith("@autoface.test"));

  useEffect(() => {
    if (!user || !db) {
      setIdentity(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        const [profileSnapshot, identitySnapshot] = await Promise.all([
          getDoc(doc(db, "profiles", user.uid)),
          getDoc(doc(db, "identity", user.uid)),
        ]);

        if (!active) return;
        const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
        const trusted = identitySnapshot.exists() ? identitySnapshot.data() : {};
        const authenticity = calculateAuthenticity({
          emailVerified: user.emailVerified,
          phoneVerified: Boolean(user.phoneNumber),
          mfaEnabled: false,
          identityVerified: Boolean(trusted.identityVerified),
          livenessVerified: Boolean(trusted.livenessVerified),
          photoVerified: Boolean(trusted.photoVerified),
        });

        const fallback = user.displayName?.replace(/\s*[—-]\s*TEST PROFILE\s*$/i, "").trim()
          || user.email?.split("@")[0]
          || "Account";

        setIdentity({
          firstName: typeof profile.firstName === "string" && profile.firstName.trim()
            ? profile.firstName.trim()
            : fallback,
          authenticityScore: authenticity.score,
          authenticityLevel: authenticity.level,
        });
      } catch {
        if (!active) return;
        setIdentity({
          firstName: user.displayName?.replace(/\s*[—-]\s*TEST PROFILE\s*$/i, "").trim()
            || user.email?.split("@")[0]
            || "Account",
          authenticityScore: (user.emailVerified ? 10 : 0) + (user.phoneNumber ? 15 : 0),
          authenticityLevel: "ACCOUNT",
        });
      }
    })();

    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-open", mobileOpen);
    return () => document.body.classList.remove("mobile-nav-open");
  }, [mobileOpen]);

  const displayName = useMemo(() => identity?.firstName || "Account", [identity]);

  function closeMobile() {
    setMobileOpen(false);
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    if (menuRef.current) menuRef.current.open = false;
    setMobileOpen(false);
    router.push("/");
  }

  const accountControl = !loading && user ? (
    <details className="account-menu" ref={menuRef}>
      <summary className="account-chip" aria-label={`Signed in as ${displayName}`}>
        <span className="account-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
        <span className="account-chip-copy">
          <b>{displayName}</b>
          <small>{isTestProfile ? "TEST PROFILE" : identity?.authenticityLevel ?? "SIGNED IN"}</small>
        </span>
        {isTestProfile && <span className="account-test-badge">TEST</span>}
        <span className="account-chevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="account-dropdown">
        <span className="account-dropdown-kicker">SIGNED IN AS</span>
        <strong>{displayName}</strong>
        <span className="account-email">{user.email}</span>

        {isTestProfile && <span className="demo-badge account-demo-badge">TEST PROFILE</span>}

        <div className="account-trust-row">
          <span>Authenticity</span>
          <b>{identity?.authenticityScore ?? 0}%</b>
        </div>

        <div className="account-dropdown-links">
          <Link href="/get-started" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Getting Started</Link>
          <Link href="/profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>My Profile</Link>
          <Link href="/relationship-profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Atlas Profile</Link>
          <Link href="/dashboard" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Security & Verification</Link>
          <Link href="/account" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Account & Privacy</Link>
          <Link href="/introductions" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Introductions</Link>
        </div>

        <button type="button" className="account-signout" onClick={logout}>Sign out</button>
      </div>
    </details>
  ) : null;

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand" onClick={closeMobile}>
          <Image src="/autoface-logo.png" alt="AutoFace" width={42} height={42} className="brand-logo" />
          <span>AutoFace</span>
        </Link>

        <nav className="nav-links desktop-nav" aria-label="Primary navigation">
          {user && <Link className="nav-priority-link" href="/discover">Discover</Link>}
          {user && <Link className="nav-priority-link" href="/introductions">Introductions</Link>}

          {user && (
            <details className="nav-group">
              <summary>My AutoFace <span aria-hidden="true">⌄</span></summary>
              <div className="nav-group-menu">
                <Link href="/get-started"><b>Getting Started</b><small>Setup checklist & beta feedback</small></Link>
                <Link href="/profile"><b>My Profile</b><small>Personal details and visibility</small></Link>
                <Link href="/relationship-profile"><b>Atlas Profile</b><small>Relationship preferences</small></Link>
                <Link href="/compatibility"><b>Compatibility</b><small>Explainable compatibility model</small></Link>
                <Link href="/discovery-preferences"><b>Discovery Preferences</b><small>Control who Atlas can recommend</small></Link>
                <Link href="/dashboard"><b>Authenticity Centre</b><small>Identity and security evidence</small></Link>
                <Link href="/verify-photo"><b>Photo Verification</b><small>Profile-photo authenticity</small></Link>
                <Link href="/account"><b>Account & Privacy</b><small>Discovery, data export and deletion</small></Link>
                <AdminLink />
              </div>
            </details>
          )}

          <details className="nav-group">
            <summary>Trust <span aria-hidden="true">⌄</span></summary>
            <div className="nav-group-menu trust-menu">
              <Link href="/how-it-works"><b>How it works</b><small>Understand the AutoFace journey</small></Link>
              <Link href="/trust"><b>Trust & Privacy</b><small>Security and data minimisation</small></Link>
            </div>
          </details>

          {!loading && !user && (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link className="btn btn-primary compact-nav-cta" href="/register">Create account</Link>
            </>
          )}

          <NotificationBell />
          {accountControl}
        </nav>

        <div className="mobile-nav-controls">
          <NotificationBell />
          {accountControl}
          <button
            type="button"
            className={`mobile-menu-button ${mobileOpen ? "open" : ""}`}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`mobile-nav-panel ${mobileOpen ? "open" : ""}`} aria-hidden={!mobileOpen}>
        <div className="container mobile-nav-content">
          {user ? (
            <>
              <div className="mobile-nav-section">
                <span className="mobile-nav-label">MATCH</span>
                <Link href="/discover" onClick={closeMobile}>Discover <span>Recommended introductions</span></Link>
                <Link href="/introductions" onClick={closeMobile}>Introductions <span>Mutual interest & conversations</span></Link>
                <Link href="/notifications" onClick={closeMobile}>Activity <span>Notifications & updates</span></Link>
              </div>

              <div className="mobile-nav-section">
                <span className="mobile-nav-label">MY AUTOFACE</span>
                <Link href="/get-started" onClick={closeMobile}>Getting Started</Link>
                <Link href="/profile" onClick={closeMobile}>My Profile</Link>
                <Link href="/relationship-profile" onClick={closeMobile}>Atlas Profile</Link>
                <Link href="/compatibility" onClick={closeMobile}>Compatibility</Link>
                <Link href="/discovery-preferences" onClick={closeMobile}>Discovery Preferences</Link>
                <Link href="/dashboard" onClick={closeMobile}>Authenticity Centre</Link>
                <Link href="/verify-photo" onClick={closeMobile}>Photo Verification</Link>
                <Link href="/account" onClick={closeMobile}>Account & Privacy</Link>
                <AdminLink mobile />
              </div>
            </>
          ) : (
            <div className="mobile-nav-section">
              <span className="mobile-nav-label">GET STARTED</span>
              <Link href="/sign-in" onClick={closeMobile}>Sign in</Link>
              <Link href="/register" onClick={closeMobile}>Create account</Link>
            </div>
          )}

          <div className="mobile-nav-section">
            <span className="mobile-nav-label">TRUST</span>
            <Link href="/how-it-works" onClick={closeMobile}>How it works</Link>
            <Link href="/trust" onClick={closeMobile}>Trust & Privacy</Link>
          </div>

          {user && (
            <button className="mobile-nav-signout" type="button" onClick={logout}>Sign out</button>
          )}
        </div>
      </div>
    </header>
  );
}
