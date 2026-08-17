"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  buildAtlasRelationshipInsight,
  calculateRelationshipCompleteness,
  scaleLabels,
  type RelationshipProfile,
  type ScaleValue,
} from "@/lib/relationship-profile";

const emptyForm = {
  familyOrientation: 3 as ScaleValue,
  communicationDirectness: 3 as ScaleValue,
  socialEnergy: 3 as ScaleValue,
  careerPriority: 3 as ScaleValue,
  routineVsAdventure: 3 as ScaleValue,
  relocationFlexibility: 3 as ScaleValue,
  sharedInterestsImportance: 3 as ScaleValue,
  independencePreference: 3 as ScaleValue,
  relationshipPace: "balanced" as RelationshipProfile["relationshipPace"],
  idealWeekend: "",
  whatMattersMost: "",
  nonNegotiables: "",
  consentForCompatibility: false,
};

type FormState = typeof emptyForm;

const questions: Array<{ key: keyof Pick<FormState, "familyOrientation" | "communicationDirectness" | "socialEnergy" | "careerPriority" | "routineVsAdventure" | "relocationFlexibility" | "sharedInterestsImportance" | "independencePreference">; title: string; hint: string; left: string; right: string }> = [
  { key: "familyOrientation", title: "How important is family involvement in your future relationship?", hint: "This is about family outlook, not religion or cultural identity.", left: "Mostly independent", right: "Very family-oriented" },
  { key: "communicationDirectness", title: "How direct do you prefer communication to be?", hint: "Think about discussing feelings, disagreements and expectations.", left: "Gentle / reflective", right: "Very direct" },
  { key: "socialEnergy", title: "What social rhythm suits you?", hint: "There is no ideal answer—compatibility may come from similarity or balance.", left: "Quiet / private", right: "Very social" },
  { key: "careerPriority", title: "How central is career ambition to your lifestyle?", hint: "This measures lifestyle priority, not salary or employer.", left: "Not central", right: "Very central" },
  { key: "routineVsAdventure", title: "How much do you value spontaneity and new experiences?", hint: "Travel, activities and changing routines are examples.", left: "Prefer routine", right: "Love variety" },
  { key: "relocationFlexibility", title: "How flexible could you be about relocating?", hint: "AutoFace only needs your preference—not an address.", left: "Strongly rooted", right: "Very flexible" },
  { key: "sharedInterestsImportance", title: "How important are shared hobbies and interests?", hint: "Some couples value overlap; others prefer independent interests.", left: "Not essential", right: "Very important" },
  { key: "independencePreference", title: "How important is personal independence within a relationship?", hint: "Consider friendships, hobbies, time alone and personal goals.", left: "Prefer togetherness", right: "Strong independence" },
];

export default function RelationshipProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [createdAt, setCreatedAt] = useState<unknown>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    let active = true;
    fetch("/api/atlas-ai", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => { if (active) setAiEnabled(body.enabled === true); })
      .catch(() => { if (active) setAiEnabled(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, "relationshipProfiles", user.uid));
        if (!active || !snapshot.exists()) return;
        const data = snapshot.data() as Partial<RelationshipProfile>;
        setCreatedAt(data.createdAt ?? null);
        setForm({
          familyOrientation: data.familyOrientation ?? 3,
          communicationDirectness: data.communicationDirectness ?? 3,
          socialEnergy: data.socialEnergy ?? 3,
          careerPriority: data.careerPriority ?? 3,
          routineVsAdventure: data.routineVsAdventure ?? 3,
          relocationFlexibility: data.relocationFlexibility ?? 3,
          sharedInterestsImportance: data.sharedInterestsImportance ?? 3,
          independencePreference: data.independencePreference ?? 3,
          relationshipPace: data.relationshipPace ?? "balanced",
          idealWeekend: data.idealWeekend ?? "",
          whatMattersMost: data.whatMattersMost ?? "",
          nonNegotiables: data.nonNegotiables ?? "",
          consentForCompatibility: data.consentForCompatibility ?? false,
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your relationship profile.");
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const completeness = useMemo(() => calculateRelationshipCompleteness(form), [form]);
  const insight = useMemo(() => buildAtlasRelationshipInsight(form), [form]);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function generateAiReflection() {
    if (!user || aiBusy || !aiConsent) return;
    try {
      setAiBusy(true);
      setAiError("");
      const token = await user.getIdToken();
      const response = await fetch("/api/atlas-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "profile", consent: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to generate Atlas AI reflection.");
      setAiInsight(body.insight ?? "");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Unable to generate Atlas AI reflection.");
    } finally {
      setAiBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!db || !user || saving) return;
    if (!form.idealWeekend.trim() || !form.whatMattersMost.trim() || !form.nonNegotiables.trim()) {
      setMessage("Complete the three written relationship questions before saving.");
      return;
    }
    if (!form.consentForCompatibility) {
      setMessage("Please confirm that AutoFace may use these answers for future compatibility recommendations.");
      return;
    }
    try {
      setSaving(true);
      setMessage("");
      await setDoc(doc(db, "relationshipProfiles", user.uid), {
        uid: user.uid,
        ...form,
        idealWeekend: form.idealWeekend.trim(),
        whatMattersMost: form.whatMattersMost.trim(),
        nonNegotiables: form.nonNegotiables.trim(),
        createdAt: createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessage("Relationship profile saved privately. Your deterministic Atlas profile is ready for compatibility and optional AI explanation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your relationship profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || loadingProfile) {
    return <main><section className="section"><div className="container"><p className="muted">Loading your private relationship profile…</p></div></section></main>;
  }

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Atlas Relationship Profile</span>
          <h1>Help Atlas understand what fits.</h1>
          <p className="lead">Go beyond a basic profile. These answers create structured compatibility dimensions. Atlas remains deterministic; optional AI can explain your saved answers only when you explicitly request it.</p>
        </div>
      </section>

      <section className="section relationship-section">
        <div className="container relationship-layout">
          <form className="card relationship-form" onSubmit={save}>
            <div className="profile-section-head">
              <div><span className="privacy-kicker">COMPATIBILITY DIMENSIONS</span><h2>Your relationship outlook</h2></div>
              <span className="status-pill">PRIVATE</span>
            </div>
            <p className="muted">Choose what feels most like you. AutoFace does not reward one answer over another.</p>

            <div className="relationship-questions">
              {questions.map((question, index) => {
                const value = form[question.key] as ScaleValue;
                return (
                  <div className="relationship-question" key={question.key}>
                    <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className="question-body">
                      <h3>{question.title}</h3>
                      <p>{question.hint}</p>
                      <input className="scale-input" type="range" min="1" max="5" step="1" value={value} onChange={(e) => change(question.key, Number(e.target.value) as ScaleValue)} />
                      <div className="scale-meta"><span>{question.left}</span><strong>{scaleLabels[value]}</strong><span>{question.right}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="profile-divider" />
            <span className="privacy-kicker">IN YOUR OWN WORDS</span>
            <div className="field"><label htmlFor="pace">Preferred relationship pace</label><select id="pace" value={form.relationshipPace} onChange={(e) => change("relationshipPace", e.target.value as RelationshipProfile["relationshipPace"])}><option value="slow">Slow and gradual</option><option value="balanced">Balanced</option><option value="intentional">Intentional and purposeful</option></select></div>
            <div className="field"><label htmlFor="weekend">What does a great weekend look like to you?</label><textarea id="weekend" maxLength={400} rows={4} value={form.idealWeekend} onChange={(e) => change("idealWeekend", e.target.value)} placeholder="Quiet time, family, eating out, gym, travel, friends, exploring somewhere new…" /><small>{form.idealWeekend.length}/400</small></div>
            <div className="field"><label htmlFor="matters">What matters most in a long-term relationship?</label><textarea id="matters" maxLength={500} rows={4} value={form.whatMattersMost} onChange={(e) => change("whatMattersMost", e.target.value)} placeholder="Describe the qualities and relationship dynamic that matter to you." /><small>{form.whatMattersMost.length}/500</small></div>
            <div className="field"><label htmlFor="nonNegotiables">What are your relationship non-negotiables?</label><textarea id="nonNegotiables" maxLength={400} rows={4} value={form.nonNegotiables} onChange={(e) => change("nonNegotiables", e.target.value)} placeholder="Keep this focused on relationship expectations and lifestyle rather than sensitive personal data." /><small>{form.nonNegotiables.length}/400</small></div>

            <label className="consent-card"><input type="checkbox" checked={form.consentForCompatibility} onChange={(e) => change("consentForCompatibility", e.target.checked)} /><span><b>Use these answers for future compatibility recommendations</b><small>v0.5 stores the profile privately. No matching or sharing occurs yet, and you can change these answers later.</small></span></label>

            {message && <p className="notice profile-message">{message}</p>}
            <div className="profile-actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save relationship profile"}</button></div>
          </form>

          <aside className="relationship-side">
            <div className="card atlas-card">
              <span className="privacy-kicker">ATLAS VIEW</span>
              <h3>{insight.headline}</h3>
              <p>{insight.summary}</p>
              <div className="atlas-focus"><small>Likely compatibility focus</small>{insight.compatibilityFocus.map((item) => <span key={item}>{item}</span>)}</div>
              <p className="atlas-disclaimer">This deterministic Atlas insight remains the source of truth. It summarises your structured answers and does not decide who you should match with.</p>
            </div>

            <div className="card atlas-ai-card">
              <div className="atlas-ai-title">
                <div><span className="privacy-kicker">OPTIONAL AI LAYER</span><h3>Atlas AI reflection</h3></div>
                <span className={`status-pill ${aiEnabled ? "" : "ai-off-pill"}`}>{aiEnabled ? "AVAILABLE" : "OFF"}</span>
              </div>
              <p>Gemini can turn your saved Atlas answers into a more natural reflection. It cannot change your compatibility dimensions or authenticity score.</p>

              {aiEnabled ? (
                <>
                  <label className="consent-row ai-consent-row">
                    <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
                    <span><b>Use Gemini for this reflection</b><small>Your saved Atlas answers will be sent to the configured AI provider for this request. The generated reflection is not saved.</small></span>
                  </label>
                  <button type="button" className="btn btn-primary" disabled={!aiConsent || aiBusy} onClick={() => void generateAiReflection()}>
                    {aiBusy ? "Asking Atlas AI…" : aiInsight ? "Regenerate reflection" : "Generate AI reflection"}
                  </button>
                  {aiInsight && <div className="atlas-ai-output"><span className="privacy-kicker">GEMINI EXPLANATION</span><p>{aiInsight}</p></div>}
                  {aiError && <p className="notice">{aiError}</p>}
                </>
              ) : (
                <div className="ai-disabled-note">
                  <b>Optional AI is disabled.</b>
                  <span>Set ATLAS_AI_ENABLED, GEMINI_API_KEY and GEMINI_MODEL on the server to enable it. AutoFace works normally without Gemini.</span>
                </div>
              )}
              <p className="atlas-disclaimer">AI output is explanatory only. The structured Atlas profile and deterministic compatibility engine remain authoritative.</p>
            </div>

            <div className="card completeness-card">
              <span className="privacy-kicker">RELATIONSHIP PROFILE</span>
              <div className="score">{completeness.score}%</div>
              <div className="meter"><span style={{ width: `${completeness.score}%` }} /></div>
              <p className="muted">{completeness.completed} of {completeness.total} relationship signals completed.</p>
              <p className="side-note">This is separate from both your profile completeness and your authenticity score.</p>
            </div>

            <div className="card minimisation-card">
              <span className="privacy-kicker">NOT PART OF THIS INTERVIEW</span>
              <h3>Deliberately excluded</h3>
              <div className="no-store-list compact"><span>× Salary</span><span>× Exact address</span><span>× Passport / ID details</span><span>× Medical information</span><span>× Biometric files</span></div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
