"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { relationshipIntentLabels, type RelationshipIntent } from "@/lib/profile";

type RecommendationCandidate = {
  firstName: string;
  age: number | null;
  generalLocation: string | null;
  occupation: string | null;
  relationshipIntent: RelationshipIntent;
  compatibilityScore: number;
  compatibilityLevel: string;
  authenticityScore: number;
  authenticityLevel: string;
};

type Dimension = {
  code: string;
  label: string;
  weight: number;
  score: number;
  explanation: string;
};

type Rec = {
  candidate: RecommendationCandidate;
  dimensions: Dimension[];
  summary: string;
  preferences: {
    minAge: number;
    maxAge: number;
    locationPreference: string;
    requireRelocationOpen: boolean;
  };
};

function dimensionBand(score: number) {
  if (score >= 75) return { label: "Strong alignment", tone: "strong" };
  if (score >= 60) return { label: "Worth exploring", tone: "explore" };
  return { label: "Worth discussing", tone: "discuss" };
}

export default function RecommendationPage() {
  const params = useParams<{ uid: string }>();
  const uid = String(params.uid ?? "");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Rec | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const current = user;

    (async () => {
      try {
        const token = await current.getIdToken();
        const response = await fetch(`/api/recommendations/${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load recommendation.");
        setData(body.recommendation);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load recommendation.");
      }
    })();
  }, [user, uid]);

  if (loading || !user || !data) {
    return (
      <main>
        <section className="section">
          <div className="container">
            <p className="muted">Loading Atlas recommendation…</p>
            {error && <p className="notice">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  const c = data.candidate;

  return (
    <main>
      <section className="page-hero compact-hero recommendation-page-hero">
        <div className="container">
          <span className="eyebrow">Atlas Recommendation</span>
          <h1>Why {c.firstName} is being recommended.</h1>
          <p className="lead">
            Atlas explains where your relationship preferences align — and where a conversation may be useful.
            The recommendation remains deterministic and does not predict relationship success.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container recommendation-layout">
          <div className="recommendation-main">
            <div className="card recommendation-person">
              <div className="connection-avatar">{c.firstName.slice(0, 1).toUpperCase()}</div>

              <div className="recommendation-person-copy">
                <span className="privacy-kicker">RECOMMENDED INTRODUCTION</span>
                <h2>{c.firstName}{c.age ? `, ${c.age}` : ""}</h2>
                <p>{[c.generalLocation, c.occupation].filter(Boolean).join(" · ")}</p>
                <span className="intent-chip">{relationshipIntentLabels[c.relationshipIntent]}</span>
              </div>

              <div className="recommendation-score enhanced-score">
                <b>{c.compatibilityScore}%</b>
                <small>Compatibility</small>
                <span>{c.compatibilityLevel}</span>
              </div>
            </div>

            <div className="card recommendation-breakdown-card">
              <span className="privacy-kicker">WHY ATLAS RECOMMENDS {c.firstName.toUpperCase()}</span>
              <h2>Your compatibility breakdown</h2>
              <p className="recommendation-summary">{data.summary}</p>

              <div className="recommendation-dimensions">
                {data.dimensions.map((d) => {
                  const band = dimensionBand(d.score);
                  return (
                    <div className="recommendation-dimension" key={d.code}>
                      <div className="dimension-heading">
                        <div>
                          <b>{d.label}</b>
                          <small>Weight {d.weight}%</small>
                        </div>
                        <div className="dimension-score-wrap">
                          <span className={`dimension-band ${band.tone}`}>{band.label}</span>
                          <strong>{d.score}%</strong>
                        </div>
                      </div>

                      <span className="dimension-meter">
                        <i style={{ width: `${d.score}%` }} />
                      </span>

                      <p>{d.explanation}</p>
                    </div>
                  );
                })}
              </div>

              <p className="atlas-disclaimer">
                Dimension scores explain structured alignment only. They are not a judgement of either person
                and do not predict whether a relationship will succeed.
              </p>
            </div>
          </div>

          <aside className="recommendation-side">
            <div className="card recommendation-trust-card">
              <span className="privacy-kicker">TRUST</span>
              <h3>{c.authenticityScore}% authenticity</h3>
              <span className="status-pill">{c.authenticityLevel}</span>
              <p>Authenticity controls eligibility; it is not blended into the compatibility score.</p>
            </div>

            <div className="card recommendation-preferences-card">
              <span className="privacy-kicker">WHY THIS PROFILE WAS ELIGIBLE</span>
              <h3>Your discovery preferences</h3>
              <div className="preference-audit">
                <span><b>Age</b>{data.preferences.minAge}–{data.preferences.maxAge}</span>
                <span><b>Location</b>{data.preferences.locationPreference === "same_general_area" ? "Same general area" : "Anywhere in the UK"}</span>
                <span><b>Relocation</b>{data.preferences.requireRelocationOpen ? "Openness required" : "No hard filter"}</span>
              </div>
              <a className="btn" href="/discovery-preferences">Edit preferences</a>
            </div>

            <a className="btn btn-relationship recommendation-back" href="/discover">Back to Discover</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
