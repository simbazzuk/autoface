"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { MemberJourney } from "@/components/MemberJourney";
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
  weekendPreferences: [] as string[],
  relationshipPriorities: [] as string[],
  nonNegotiablePreferences: [] as string[],
  relationshipContext: "",
  consentForCompatibility: false,
  consentForAiDiscovery: false,
};

type FormState = typeof emptyForm;

const weekendOptions = [
  ["quiet_time","Quiet time"],["family_time","Family time"],["friends","Friends"],
  ["eating_out","Eating out"],["travel","Travel"],["outdoors","Outdoors"],
  ["sport_fitness","Sport / fitness"],["cinema_entertainment","Cinema / entertainment"],
  ["events","Events"],["faith_community","Faith / community"],["cooking","Cooking"],
  ["exploring","Exploring somewhere new"],
] as const;

const priorityOptions = [
  ["trust","Trust"],["stability","Stability"],["communication","Communication"],
  ["family","Family"],["affection","Affection"],["shared_values","Shared values"],
  ["independence","Independence"],["ambition","Ambition"],["faith","Faith"],
  ["humour","Humour"],["adventure","Adventure"],["financial_stability","Financial stability"],
] as const;

const nonNegotiableOptions = [
  ["honesty","Honesty"],["loyalty","Loyalty"],["family_oriented","Family-oriented"],
  ["good_communication","Good communication"],["mutual_respect","Mutual respect"],
  ["financial_responsibility","Financial responsibility"],["similar_lifestyle","Similar lifestyle"],
  ["shared_faith_outlook","Shared faith outlook"],["personal_independence","Personal independence"],
  ["career_support","Career support"],["children_family_goals","Children / family goals"],
  ["kindness","Kindness"],
] as const;

function selectedText(values:string[], options:readonly (readonly [string,string])[]){
  const labels=new Map(options);
  return values.map(value=>labels.get(value)??value.replaceAll("_"," ")).join(", ");
}

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
  const [journeySaved,setJourneySaved]=useState(false);
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
          weekendPreferences: Array.isArray(data.weekendPreferences) ? data.weekendPreferences : [],
          relationshipPriorities: Array.isArray(data.relationshipPriorities) ? data.relationshipPriorities : [],
          nonNegotiablePreferences: Array.isArray(data.nonNegotiablePreferences) ? data.nonNegotiablePreferences : [],
          relationshipContext: data.relationshipContext ?? "",
          consentForCompatibility: data.consentForCompatibility ?? false,
          consentForAiDiscovery: data.consentForAiDiscovery ?? false,
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
  function toggleSelection(key:"weekendPreferences"|"relationshipPriorities"|"nonNegotiablePreferences", value:string, max:number) {
    setForm((current) => {
      const values=current[key] as string[];
      const next=values.includes(value) ? values.filter((item)=>item!==value) : values.length<max ? [...values,value] : values;
      return {...current,[key]:next};
    });
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
      if (!response.ok) throw new Error(body.message ?? body.error ?? "Unable to generate Atlas AI reflection.");
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
    if (form.weekendPreferences.length < 1 || form.relationshipPriorities.length < 1 || form.nonNegotiablePreferences.length < 1) {
      setMessage("Choose at least one tile in each relationship section before saving.");
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
        // Keep the original text fields populated for backwards-compatible Atlas AI prompts.
        idealWeekend: selectedText(form.weekendPreferences,weekendOptions),
        whatMattersMost: selectedText(form.relationshipPriorities,priorityOptions),
        nonNegotiables: selectedText(form.nonNegotiablePreferences,nonNegotiableOptions),
        relationshipContext: form.relationshipContext.trim(),
        createdAt: createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessage(form.consentForAiDiscovery
        ? "Atlas profile saved. Deterministic compatibility and optional AI Discovery are enabled."
        : "Atlas profile saved. Deterministic compatibility is enabled; AI Discovery remains off.");
      setJourneySaved(true);
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

      <MemberJourney stage="atlas"/>

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
            <span className="privacy-kicker">WHAT MATTERS TO YOU</span>
            <p className="relationship-tiles-intro">Choose the words that feel most like you. Structured choices give Atlas clearer signals and make this quicker than writing an essay.</p>

            <div className="field"><label htmlFor="pace">Preferred relationship pace</label><select id="pace" value={form.relationshipPace} onChange={(e) => change("relationshipPace", e.target.value as RelationshipProfile["relationshipPace"])}><option value="slow">Slow and gradual</option><option value="balanced">Balanced</option><option value="intentional">Intentional and purposeful</option></select></div>

            <div className="relationship-tile-question">
              <div className="relationship-tile-head"><div><label>What does a great weekend look like to you?</label><small>Choose up to 4</small></div><strong>{form.weekendPreferences.length}/4</strong></div>
              <div className="relationship-choice-grid">{weekendOptions.map(([value,label])=><button type="button" key={value} className={`relationship-choice ${form.weekendPreferences.includes(value)?"selected":""}`} onClick={()=>toggleSelection("weekendPreferences",value,4)}><span>{form.weekendPreferences.includes(value)?"✓":"+"}</span>{label}</button>)}</div>
            </div>

            <div className="relationship-tile-question">
              <div className="relationship-tile-head"><div><label>What matters most in a long-term relationship?</label><small>Choose up to 5</small></div><strong>{form.relationshipPriorities.length}/5</strong></div>
              <div className="relationship-choice-grid">{priorityOptions.map(([value,label])=><button type="button" key={value} className={`relationship-choice ${form.relationshipPriorities.includes(value)?"selected":""}`} onClick={()=>toggleSelection("relationshipPriorities",value,5)}><span>{form.relationshipPriorities.includes(value)?"✓":"+"}</span>{label}</button>)}</div>
            </div>

            <div className="relationship-tile-question">
              <div className="relationship-tile-head"><div><label>What are your relationship non-negotiables?</label><small>Choose up to 5</small></div><strong>{form.nonNegotiablePreferences.length}/5</strong></div>
              <div className="relationship-choice-grid">{nonNegotiableOptions.map(([value,label])=><button type="button" key={value} className={`relationship-choice ${form.nonNegotiablePreferences.includes(value)?"selected":""}`} onClick={()=>toggleSelection("nonNegotiablePreferences",value,5)}><span>{form.nonNegotiablePreferences.includes(value)?"✓":"+"}</span>{label}</button>)}</div>
            </div>

            <div className="field relationship-context-field"><label htmlFor="relationshipContext">Anything else you&apos;d like Atlas to understand? · optional</label><textarea id="relationshipContext" maxLength={350} rows={3} value={form.relationshipContext} onChange={(e) => change("relationshipContext", e.target.value)} placeholder="Add a little personal context if the choices above don't quite capture something important." /><small>{form.relationshipContext.length}/350</small></div>

            <label className="consent-card"><input type="checkbox" checked={form.consentForCompatibility} onChange={(e) => change("consentForCompatibility", e.target.checked)} /><span><b>Use these answers for compatibility recommendations</b><small>Your structured answers power the deterministic Atlas compatibility engine. You can change this permission later.</small></span></label>

            <label className="consent-card ai-discovery-consent">
              <input type="checkbox" checked={form.consentForAiDiscovery} onChange={(e) => change("consentForAiDiscovery", e.target.checked)} />
              <span>
                <b>Allow Atlas AI Discovery to use my relationship answers</b>
                <small>Optional. When both members opt in, Gemini may compare their saved relationship answers to generate shared themes and neutral discussion points. It does not receive private messages or identity-verification evidence, and it cannot change the Atlas compatibility score.</small>
              </span>
            </label>

            {message && <p className="notice profile-message">{message}</p>}
            {journeySaved&&<div className="journey-complete-card">
              <div><span className="privacy-kicker">ATLAS READY</span><h3>Atlas now understands your relationship outlook.</h3><p>One final setup step: tell AutoFace the practical preferences that should shape who Atlas considers for an introduction.</p></div>
              <a className="btn btn-primary journey-next-button" href="/discovery-preferences">Set my preferences →</a>
            </div>}
            <div className="profile-actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Atlas profile"}</button></div>
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
