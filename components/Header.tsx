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

  const displayName = useMemo(() => identity?.firstName || "Account", [identity]);

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    if (menuRef.current) menuRef.current.open = false;
    router.push("/");
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <Image src="/autoface-logo.png" alt="AutoFace" width={42} height={42} className="brand-logo" />
          <span>AutoFace</span>
        </Link>

        <nav className="nav-links">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/trust">Trust & Privacy</Link>
          <Link href="/dashboard">Authenticity Centre</Link>
          <Link href="/profile">My Profile</Link>
          <Link href="/relationship-profile">Atlas Profile</Link>
          <Link href="/compatibility">Compatibility</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/introductions">Introductions</Link>

          {!loading && !user && (
            <>
              <Link href="/sign-in">Sign in</Link>
              <Link className="btn btn-primary" href="/register">Create account</Link>
            </>
          )}

          {!loading && user && (
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
                  <Link href="/profile" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>My Profile</Link>
                  <Link href="/dashboard" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Authenticity Centre</Link>
                  <Link href="/introductions" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>Introductions</Link>
                </div>

                <button type="button" className="account-signout" onClick={logout}>Sign out</button>
              </div>
            </details>
          )}
        </nav>
      </div>
    </header>
  );
}
