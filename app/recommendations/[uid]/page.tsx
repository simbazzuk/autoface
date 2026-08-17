"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
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

type AiDiscoveryInsight = {
  headline: string;
  summary: string;
  sharedThemes: Array<{ theme: string; strength: "strong" | "moderate"; explanation: string }>;
  discussionPoints: Array<{ theme: string; explanation: string }>;
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
  const [aiStatus, setAiStatus] = useState<{enabled:boolean;viewerOptIn:boolean;candidateOptIn:boolean;available:boolean} | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiDiscoveryInsight | null>(null);
  const [aiError, setAiError] = useState("");

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

  useEffect(() => {
    if (!user) return;
    const current = user;
    (async () => {
      try {
        const token = await current.getIdToken();
        const response = await fetch(`/api/atlas-ai/discovery/${encodeURIComponent(uid)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (response.ok) setAiStatus(body);
      } catch {
        setAiStatus(null);
      }
    })();
  }, [user, uid]);

  async function generateAiDiscovery() {
    if (!user || aiBusy || !aiConsent) return;
    const current = user;
    try {
      setAiBusy(true);
      setAiError("");
      const token = await current.getIdToken();
      const response = await fetch(`/api/atlas-ai/discovery/${encodeURIComponent(uid)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consent: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? body.error ?? "Unable to generate Atlas AI Discovery insight.");
      setAiInsight(body.insight ?? null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Unable to generate Atlas AI Discovery insight.");
    } finally {
      setAiBusy(false);
    }
  }

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
              <ProfilePhoto uid={uid} name={c.firstName} className="recommendation-profile-photo"/>

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

            <div className="card ai-discovery-card">
              <div className="ai-discovery-title-row">
                <div>
                  <span className="privacy-kicker">ATLAS AI DISCOVERY</span>
                  <h2>What might you have in common beyond the numbers?</h2>
                </div>
                <span className={`status-pill ${aiStatus?.available ? "ai-discovery-live" : "ai-off-pill"}`}>
                  {aiStatus?.available ? "GEMINI AVAILABLE" : "OPT-IN REQUIRED"}
                </span>
              </div>

              <p className="ai-discovery-intro">
                Your official {c.compatibilityScore}% compatibility score remains deterministic. Atlas AI Discovery is a separate,
                optional Gemini layer that looks for meaning and shared themes in the relationship answers you each wrote in your own words.
              </p>

              {!aiStatus?.enabled ? (
                <div className="ai-disabled-note">
                  <b>Atlas AI Discovery is disabled.</b>
                  <span>Configure ATLAS_AI_ENABLED, GEMINI_API_KEY and GEMINI_MODEL to enable this optional layer.</span>
                </div>
              ) : !aiStatus.viewerOptIn ? (
                <div className="ai-discovery-unavailable">
                  <b>Your AI Discovery permission is off.</b>
                  <span>Enable “Allow Atlas AI Discovery” in your Atlas Profile before using semantic insights.</span>
                  <a className="btn" href="/relationship-profile">Update Atlas Profile</a>
                </div>
              ) : !aiStatus.candidateOptIn ? (
                <div className="ai-discovery-unavailable">
                  <b>{c.firstName} has not opted in to Atlas AI Discovery.</b>
                  <span>AutoFace will not send another member&apos;s private relationship answers to Gemini without their explicit permission.</span>
                </div>
              ) : aiInsight ? (
                <div className="ai-discovery-output">
                  <div className="ai-discovery-headline">
                    <span className="ai-spark">✦</span>
                    <div><small>ATLAS NOTICED SOMETHING</small><h3>{aiInsight.headline}</h3><p>{aiInsight.summary}</p></div>
                  </div>

                  <div className="ai-theme-grid">
                    {aiInsight.sharedThemes.map((theme) => (
                      <div className="ai-theme-card" key={theme.theme}>
                        <span className={`ai-theme-strength ${theme.strength}`}>{theme.strength.toUpperCase()}</span>
                        <b>{theme.theme}</b>
                        <p>{theme.explanation}</p>
                      </div>
                    ))}
                  </div>

                  {aiInsight.discussionPoints.length > 0 && (
                    <div className="ai-discussion">
                      <small>WORTH TALKING ABOUT</small>
                      {aiInsight.discussionPoints.map((point) => (
                        <div key={point.theme}><b>{point.theme}</b><span>{point.explanation}</span></div>
                      ))}
                    </div>
                  )}

                  <button className="btn" onClick={() => void generateAiDiscovery()} disabled={aiBusy}>
                    {aiBusy ? "Regenerating…" : "Regenerate AI insight"}
                  </button>
                </div>
              ) : (
                <>
                  <label className="consent-card ai-discovery-request-consent">
                    <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
                    <span>
                      <b>Generate a Gemini semantic insight for this recommendation</b>
                      <small>Both profiles have opted in. Your saved relationship answers and {c.firstName}&apos;s opted-in relationship answers will be sent to the configured Gemini provider for this request. The result is not saved.</small>
                    </span>
                  </label>
                  <button className="btn btn-primary ai-discovery-generate" disabled={!aiConsent || aiBusy} onClick={() => void generateAiDiscovery()}>
                    {aiBusy ? "Atlas is looking for shared themes…" : "See what Gemini notices"}
                  </button>
                </>
              )}

              {aiError && <p className="notice">{aiError}</p>}
              <p className="atlas-disclaimer">
                Gemini is an optional semantic layer. It cannot change eligibility, hard preferences, authenticity,
                deterministic compatibility or safety decisions.
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
