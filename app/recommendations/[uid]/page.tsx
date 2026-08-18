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
  heightCm: number | null;
  professionArea: string | null;
  careerImportance: string | null;
  educationLevel: string | null;
  educationField: string | null;
  sikhAppearance: string | null;
  sikhPractice: string | null;
  diet: string | null;
  hobbies: string[];
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
  intelligence: {
    confidence: "HIGH" | "GOOD" | "LIMITED";
    confidenceScore: number;
    signalsUsed: number;
    signalsAvailable: number;
    notice: string;
  };
  profileIntelligence: {
    headline: string;
    indicators: Array<{key:string;label:string;score:number;status:"STRONG"|"GOOD"|"NEUTRAL"|"EXPLORE";explanation:string;evidence:string[]}>;
    heightEvidence: string[];
    strongestProfileSignals: string[];
    thingsToExplore: string[];
    notice: string;
  };
  preferences: {
    minAge: number;
    maxAge: number;
    locationPreference: string;
    requireRelocationOpen: boolean;
    professionPreferenceMode: string;
    educationPreference: string;
    heightPreferenceImportance: string;
    introductionLocation: string;
    sharedInterestPreference: string;
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
          <span className="eyebrow">Atlas Introduction Intelligence</span>
          <h1>Here&apos;s why Atlas thinks {c.firstName} is worth considering.</h1>
          <p className="lead">
            Not just a score. See the foundations behind this introduction, where you align and what may be worth exploring together.
            Eligibility and compatibility remain deterministic — Atlas explains the reasoning.
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

            <div className="card atlas-intelligence-overview">
              <div className="atlas-intelligence-heading">
                <div>
                  <span className="privacy-kicker">WHY THIS INTRODUCTION</span>
                  <h2>A considered introduction, with reasons.</h2>
                  <p>AutoFace first applies your hard preferences, then calculates structured compatibility. Atlas adds an explanation layer so you can decide whether the introduction feels worth exploring.</p>
                </div>
                <div className={`atlas-confidence ${data.intelligence.confidence.toLowerCase()}`}>
                  <small>ATLAS CONFIDENCE</small><strong>{data.intelligence.confidence}</strong>
                  <span>{data.intelligence.signalsUsed}/{data.intelligence.signalsAvailable} relationship signals</span>
                </div>
              </div>
              <div className="atlas-reason-grid">
                {data.dimensions.slice().sort((a,b)=>b.score-a.score).slice(0,3).map((d,index)=>(
                  <div className="atlas-reason-card" key={d.code}>
                    <span>{index===0?"STRONG FOUNDATION":"ALIGNMENT"}</span><b>{d.label}</b>
                    <p>{d.explanation}</p><small>{d.score}% structured alignment</small>
                  </div>
                ))}
              </div>
              <div className="atlas-confidence-note"><span>◎</span><p><b>{data.intelligence.confidence} confidence in the explanation.</b> {data.intelligence.notice} Confidence describes the amount of profile context available — not the likelihood of relationship success.</p></div>
              <div className="atlas-intelligence-flow">
                <span><b>1</b><small>ELIGIBILITY</small><strong>Hard preferences</strong></span><i>→</i>
                <span><b>2</b><small>COMPATIBILITY</small><strong>Deterministic ranking</strong></span><i>→</i>
                <span><b>3</b><small>ATLAS</small><strong>Explain the fit</strong></span><i>→</i>
                <span><b>4</b><small>YOU</small><strong>Decide</strong></span>
              </div>
            </div>

            <div className="card atlas-profile-intelligence">
              <div className="profile-intelligence-heading">
                <div>
                  <span className="privacy-kicker">ATLAS PROFILE INTELLIGENCE</span>
                  <h2>How your profiles align beyond the relationship score.</h2>
                  <p>{data.profileIntelligence.headline}</p>
                </div>
                <span className="profile-context-pill">CONTEXT · NOT A SCORE</span>
              </div>

              <div className="profile-alignment-grid">
                {data.profileIntelligence.indicators.map((item)=>(
                  <div className={`profile-alignment-card ${item.status.toLowerCase()}`} key={item.key}>
                    <div className="profile-alignment-top">
                      <span className="profile-alignment-dots">{[1,2,3,4,5].map(n=><i key={n} className={n<=item.score?"filled":""}/>)}</span>
                      <small>{item.status}</small>
                    </div>
                    <b>{item.label}</b>
                    <p>{item.explanation}</p>
                    {item.evidence.length>0&&<span className="profile-evidence">{item.evidence[0]}</span>}
                  </div>
                ))}
              </div>

              <div className="profile-intelligence-details">
                <div>
                  <small>PROFILE SIGNALS AT A GLANCE</small>
                  <div className="profile-context-chips">
                    {c.professionArea&&<span>{c.professionArea.replaceAll("_"," ")}</span>}
                    {c.educationLevel&&<span>{c.educationLevel.replaceAll("_"," ")}</span>}
                    {c.sikhPractice&&c.sikhPractice!=="prefer_not_to_say"&&<span>{c.sikhPractice.replaceAll("_"," ")}</span>}
                    {c.diet&&c.diet!=="prefer_not_to_say"&&<span>{c.diet.replaceAll("_"," ")}</span>}
                    {c.sikhAppearance&&c.sikhAppearance!=="prefer_not_to_say"&&c.sikhAppearance!=="not_applicable"&&<span>{c.sikhAppearance==="clean_shaven"?"clean shaven / non-turbaned":c.sikhAppearance}</span>}
                    {c.hobbies?.slice(0,5).map(h=><span key={h}>{h.replaceAll("_"," ")}</span>)}
                  </div>
                </div>
                {data.profileIntelligence.heightEvidence.length>0&&<div className="profile-height-context"><small>HEIGHT PREFERENCE</small><p>{data.profileIntelligence.heightEvidence[0]}</p></div>}
              </div>

              <p className="atlas-disclaimer profile-intelligence-notice">{data.profileIntelligence.notice} Caste is not used to create these indicators.</p>
            </div>

            <div className="card recommendation-breakdown-card">
              <span className="privacy-kicker">STRUCTURED COMPATIBILITY</span>
              <h2>The foundations behind the introduction</h2>
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
                  <span className="privacy-kicker">ATLAS SEMANTIC INSIGHT · OPTIONAL</span>
                  <h2>What does Atlas notice beyond the structured scores?</h2>
                </div>
                <span className={`status-pill ${aiStatus?.available ? "ai-discovery-live" : "ai-off-pill"}`}>
                  {aiStatus?.available ? "GEMINI AVAILABLE" : "OPT-IN REQUIRED"}
                </span>
              </div>

              <p className="ai-discovery-intro">
                Your official {c.compatibilityScore}% compatibility score remains deterministic. When both members opt in, Gemini can help Atlas interpret
                the meaning in your written relationship answers — surfacing shared themes and neutral differences that a numeric score cannot express.
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
                    <div><small>ATLAS VIEW · WHY THIS MAY BE WORTH EXPLORING</small><h3>{aiInsight.headline}</h3><p>{aiInsight.summary}</p></div>
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
                      <small>SOMETHING TO EXPLORE</small>
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
                    {aiBusy ? "Atlas is looking for shared themes…" : "Ask Atlas to explain the fit"}
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
