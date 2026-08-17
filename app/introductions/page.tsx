"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { SafeDiscoveryProfile } from "@/lib/server/discovery";

type Intro = SafeDiscoveryProfile & { matchId: string };

export default function IntroductionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Intro[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();

    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/introductions", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({ error: `Introductions request failed (${response.status})` }));
        if (!response.ok) throw new Error(body.error ?? `Introductions request failed (${response.status})`);
        setItems(body.introductions ?? []);
        setError("");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load introductions.");
        setItems([]);
      }
    })();

    return () => controller.abort();
  }, [user]);

  if (loading || !user || items === null) {
    return <main><section className="section"><div className="container"><p className="muted">Loading introductions…</p></div></section></main>;
  }

  return <main>
    <section className="page-hero compact-hero"><div className="container">
      <span className="eyebrow">Introductions · v0.7.2</span>
      <h1>Mutual interest, clearly established.</h1>
      <p className="lead">These are people where interest has been expressed independently in both directions. Messaging is intentionally reserved for v0.8.</p>
    </div></section>
    <section className="section discovery-section"><div className="container">
      {error && <p className="notice">{error}</p>}
      {items.length === 0 ? <div className="card discovery-empty">
        <h2>No mutual introductions yet</h2>
        <p>Discovery keeps your interest private until it becomes mutual.</p>
        <a className="btn btn-primary" href="/discover">Open Discovery</a>
      </div> : <div className="discovery-grid">
        {items.map((i) => <article className="card discovery-card" key={i.matchId}>
          <div className="intro-pills"><span className="status-pill">MUTUAL INTRODUCTION</span>{i.isTestProfile && <span className="status-pill test-profile-pill">TEST PROFILE</span>}</div>
          <h2>{i.firstName}{i.age ? `, ${i.age}` : ""}</h2>
          <p>{i.generalLocation ?? "Location hidden"}</p>
          <div className="trust-pair"><span><b>{i.authenticityScore}%</b><small>Authenticity</small></span><span><b>{i.compatibilityScore}%</b><small>Compatibility</small></span></div>
          <p className="candidate-about">{i.aboutMe}</p>
          <div className="notice">Messaging remains locked until the Safe Messaging release.</div>
        </article>)}
      </div>}
    </div></section>
  </main>;
}
