"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { calculateCompatibility } from "@/lib/compatibility";
import { demoCompatibilityProfiles } from "@/lib/demo-compatibility-profiles";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export default function CompatibilityPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [relationshipProfile, setRelationshipProfile] = useState<RelationshipProfile | null>(null);
  const [selectedId, setSelectedId] = useState(demoCompatibilityProfiles[0].id);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, "relationshipProfiles", user.uid));
        if (!active) return;
        if (!snapshot.exists()) {
          setMessage("Create your Atlas Relationship Profile before using the Compatibility Lab.");
          return;
        }
        const profile = snapshot.data() as RelationshipProfile;
        if (!profile.consentForCompatibility) {
          setMessage("Compatibility consent is not enabled on your Atlas Relationship Profile.");
          return;
        }
        setRelationshipProfile(profile);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your private relationship profile.");
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const selected = demoCompatibilityProfiles.find((candidate) => candidate.id === selectedId) ?? demoCompatibilityProfiles[0];
  const result = useMemo(() => relationshipProfile ? calculateCompatibility(relationshipProfile, selected) : null, [relationshipProfile, selected]);

  if (loading || !user || loadingProfile) {
    return <main><section className="section"><div className="container"><p className="muted">Loading the private Compatibility Lab…</p></div></section></main>;
  }

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Compatibility Lab · v0.6</span>
          <h1>Understand why two people may fit.</h1>
          <p className="lead">AutoFace compares structured relationship signals and shows the reasoning. This is not a prediction of relationship success and no LLM decides the score.</p>
        </div>
      </section>

      <section className="section compatibility-section">
        <div className="container">
          {message && !result ? (
            <div className="card compatibility-blocked">
              <span className="privacy-kicker">COMPATIBILITY UNAVAILABLE</span>
              <h2>Complete your relationship profile first</h2>
              <p>{message}</p>
              <a className="btn btn-primary" href="/relationship-profile">Open Atlas Profile</a>
            </div>
          ) : result ? (
            <div className="compatibility-layout">
              <div className="compatibility-main">
                <div className="card candidate-picker-card">
                  <div className="compatibility-title-row">
                    <div>
                      <span className="privacy-kicker">SAFE DEMONSTRATION</span>
                      <h2>Choose a synthetic profile</h2>
                      <p>No other member&apos;s data is exposed in v0.6. These profiles exist only to prove the compatibility engine.</p>
                    </div>
                    <span className="status-pill">DEMO ONLY</span>
                  </div>
                  <div className="candidate-tabs">
                    {demoCompatibilityProfiles.map((candidate) => (
                      <button key={candidate.id} type="button" className={`candidate-tab ${candidate.id === selected.id ? "active" : ""}`} onClick={() => setSelectedId(candidate.id)}>
                        <b>{candidate.name}</b><span>{candidate.age} · {candidate.location}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card compatibility-score-card">
                  <div className="match-score-head">
                    <div>
                      <span className="privacy-kicker">EXPLAINABLE COMPATIBILITY</span>
                      <div className="score">{result.score}%</div>
                    </div>
                    <div className="match-level"><span>{result.level}</span><small>structured alignment</small></div>
                  </div>
                  <div className="meter"><span style={{ width: `${result.score}%` }} /></div>
                  <p className="compatibility-summary">{result.summary}</p>
                  <div className="candidate-note">{selected.note}</div>
                </div>

                <div className="card dimension-card">
                  <span className="privacy-kicker">WHY THIS SCORE</span>
                  <h2>Dimension by dimension</h2>
                  <div className="dimension-list">
                    {result.dimensions.map((dimension) => (
                      <div className="dimension-row" key={dimension.key}>
                        <div className="dimension-copy">
                          <div className="dimension-heading"><b>{dimension.label}</b><span>{dimension.weight}% weight</span></div>
                          <div className="dimension-values"><span>You: {dimension.userValue}</span><span>{selected.name}: {dimension.candidateValue}</span></div>
                          <small>{dimension.explanation}</small>
                        </div>
                        <div className={`dimension-score ${dimension.score >= 80 ? "good" : dimension.score <= 60 ? "attention" : ""}`}>{dimension.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="compatibility-side">
                <div className="card">
                  <span className="privacy-kicker">STRONGEST ALIGNMENTS</span>
                  <h3>Where you naturally align</h3>
                  <div className="insight-stack">
                    {result.strongestAlignments.map((item) => <div key={item.key}><b>{item.label}</b><span>{item.score}% alignment</span></div>)}
                  </div>
                </div>

                <div className="card">
                  <span className="privacy-kicker">CONVERSATION POINTS</span>
                  <h3>Worth talking about</h3>
                  {result.conversationPoints.length ? (
                    <div className="insight-stack conversation-stack">
                      {result.conversationPoints.map((item) => <div key={item.key}><b>{item.label}</b><span>{item.explanation}</span></div>)}
                    </div>
                  ) : <p>No major structured differences appeared in this demonstration.</p>}
                </div>

                <div className="card methodology-card">
                  <span className="privacy-kicker">METHOD</span>
                  <h3>Deterministic, not mysterious</h3>
                  <p>Each dimension has a published weight. Similar answers score more highly; differences are surfaced rather than hidden.</p>
                  <p>No free-text answer is scored in v0.6, and this comparison is not saved to Firestore.</p>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
