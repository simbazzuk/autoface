"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  calculateProfileCompleteness,
  relationshipIntentLabels,
  type AutoFaceProfile,
  type ProfileVisibility,
  type RelationshipIntent,
} from "@/lib/profile";

const emptyProfile = {
  firstName: "",
  age: "",
  generalLocation: "",
  heightCm: "",
  occupation: "",
  education: "",
  relationshipIntent: "marriage" as RelationshipIntent,
  aboutMe: "",
  visibility: "private" as ProfileVisibility,
  showAge: true,
  showLocation: true,
  showOccupation: true,
};

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(emptyProfile);
  const [initialCreatedAt, setInitialCreatedAt] = useState<unknown>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
  }, [loading, user, router]);

  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, "profiles", user.uid));
        if (!active || !snapshot.exists()) return;
        const data = snapshot.data() as Partial<AutoFaceProfile>;
        setInitialCreatedAt(data.createdAt ?? null);
        setForm({
          firstName: data.firstName ?? "",
          age: data.age ? String(data.age) : "",
          generalLocation: data.generalLocation ?? "",
          heightCm: data.heightCm ? String(data.heightCm) : "",
          occupation: data.occupation ?? "",
          education: data.education ?? "",
          relationshipIntent: data.relationshipIntent ?? "marriage",
          aboutMe: data.aboutMe ?? "",
          visibility: data.visibility ?? "private",
          showAge: data.showAge ?? true,
          showLocation: data.showLocation ?? true,
          showOccupation: data.showOccupation ?? true,
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load your profile.");
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const profileForScore = useMemo<Partial<AutoFaceProfile>>(() => ({
    firstName: form.firstName,
    age: Number(form.age),
    generalLocation: form.generalLocation,
    heightCm: form.heightCm ? Number(form.heightCm) : null,
    occupation: form.occupation,
    education: form.education,
    relationshipIntent: form.relationshipIntent,
    aboutMe: form.aboutMe,
  }), [form]);

  const completeness = calculateProfileCompleteness(profileForScore);

  function change<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!db || !user || saving) return;
    const age = Number(form.age);
    const heightCm = form.heightCm.trim() ? Number(form.heightCm) : null;
    if (!Number.isInteger(age) || age < 18 || age > 100) {
      setMessage("Enter an age between 18 and 100.");
      return;
    }
    if (heightCm !== null && (!Number.isInteger(heightCm) || heightCm < 120 || heightCm > 230)) {
      setMessage("Height must be between 120 cm and 230 cm, or left blank.");
      return;
    }
    if (!form.firstName.trim() || !form.generalLocation.trim() || !form.aboutMe.trim()) {
      setMessage("First name, general location and About me are required.");
      return;
    }
    try {
      setSaving(true);
      setMessage("");
      await setDoc(doc(db, "profiles", user.uid), {
        uid: user.uid,
        firstName: form.firstName.trim(),
        age,
        generalLocation: form.generalLocation.trim(),
        heightCm,
        occupation: form.occupation.trim(),
        education: form.education.trim(),
        relationshipIntent: form.relationshipIntent,
        aboutMe: form.aboutMe.trim(),
        visibility: form.visibility,
        showAge: form.showAge,
        showLocation: form.showLocation,
        showOccupation: form.showOccupation,
        createdAt: initialCreatedAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessage("Profile saved. It remains private until you choose otherwise.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || loadingProfile) {
    return <main><section className="section"><div className="container"><p className="muted">Loading your private profile…</p></div></section></main>;
  }

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Profile Foundation · v0.5</span>
          <h1>Create your profile.</h1>
          <p className="lead">Start with only the information AutoFace needs for a meaningful introduction. Your profile is private by default and matching is not enabled in v0.5.</p>
        </div>
      </section>

      <section className="section profile-section">
        <div className="container profile-layout">
          <form className="card profile-form" onSubmit={save}>
            <div className="profile-section-head">
              <div><span className="privacy-kicker">ABOUT YOU</span><h2>The essentials</h2></div>
              <span className="status-pill">PRIVATE BY DEFAULT</span>
            </div>

            <div className="form-grid">
              <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" maxLength={50} value={form.firstName} onChange={(e) => change("firstName", e.target.value)} required /></div>
              <div className="field"><label htmlFor="age">Age</label><input id="age" type="number" min={18} max={100} value={form.age} onChange={(e) => change("age", e.target.value)} required /></div>
              <div className="field"><label htmlFor="location">General location</label><input id="location" maxLength={80} placeholder="e.g. Leeds, West Yorkshire" value={form.generalLocation} onChange={(e) => change("generalLocation", e.target.value)} required /><small>Use a town/city or broad area—not your home address.</small></div>
              <div className="field"><label htmlFor="height">Height (cm) · optional</label><input id="height" type="number" min={120} max={230} value={form.heightCm} onChange={(e) => change("heightCm", e.target.value)} /></div>
              <div className="field"><label htmlFor="occupation">Occupation · optional</label><input id="occupation" maxLength={100} value={form.occupation} onChange={(e) => change("occupation", e.target.value)} /></div>
              <div className="field"><label htmlFor="education">Education · optional</label><input id="education" maxLength={120} value={form.education} onChange={(e) => change("education", e.target.value)} /></div>
            </div>

            <div className="profile-divider" />
            <div className="field"><label htmlFor="intent">Relationship intention</label><select id="intent" value={form.relationshipIntent} onChange={(e) => change("relationshipIntent", e.target.value as RelationshipIntent)}>{Object.entries(relationshipIntentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="field"><label htmlFor="about">About me</label><textarea id="about" rows={6} maxLength={600} placeholder="Tell future introductions a little about who you are, what matters to you and the life you enjoy." value={form.aboutMe} onChange={(e) => change("aboutMe", e.target.value)} required /><small>{form.aboutMe.length}/600 characters</small></div>

            <div className="profile-divider" />
            <span className="privacy-kicker">PRIVACY</span>
            <h3>Control what may be shown later</h3>
            <p className="muted privacy-copy">v0.5 does not expose profiles to other members. These controls prepare the profile for later matching while keeping disclosure under your control.</p>
            <div className="privacy-controls">
              <label className="toggle-row"><input type="checkbox" checked={form.showAge} onChange={(e) => change("showAge", e.target.checked)} /><span><b>Show my age</b><small>Allow your age to appear on future introductions.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showLocation} onChange={(e) => change("showLocation", e.target.checked)} /><span><b>Show my general location</b><small>Only the broad area entered above—not a precise address.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showOccupation} onChange={(e) => change("showOccupation", e.target.checked)} /><span><b>Show my occupation</b><small>Your employer is not collected as a separate field.</small></span></label>
            </div>

            <div className="field"><label htmlFor="visibility">Profile visibility</label><select id="visibility" value={form.visibility} onChange={(e) => change("visibility", e.target.value as ProfileVisibility)}><option value="private">Private — only me</option><option value="future_matches">Ready for future matched introductions</option></select><small>Choosing future matches does not make your profile public in v0.5.</small></div>

            {message && <p className="notice profile-message">{message}</p>}
            <div className="profile-actions"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
          </form>

          <aside className="profile-side">
            <div className="card completeness-card">
              <span className="muted">Profile completeness</span>
              <div className="score">{completeness.score}%</div>
              <div className="meter"><span style={{ width: `${completeness.score}%` }} /></div>
              <p>{completeness.completed} of {completeness.total} profile signals completed.</p>
              <p className="side-note">Completeness is separate from your Authenticity Score. Filling in more profile information does not make your identity more verified.</p>
            </div>

            <div className="card preview-card">
              <span className="privacy-kicker">PRIVATE PREVIEW</span>
              <h3>{form.firstName.trim() || "Your first name"}{form.showAge && form.age ? `, ${form.age}` : ""}</h3>
              {form.showLocation && form.generalLocation && <p>{form.generalLocation}</p>}
              {form.showOccupation && form.occupation && <p>{form.occupation}</p>}
              <span className="intent-chip">{relationshipIntentLabels[form.relationshipIntent]}</span>
              <p className="preview-about">{form.aboutMe || "Your introduction will appear here."}</p>
              <div className="private-banner">🔒 Only you can read this profile in v0.5.</div>
            </div>

            <div className="card minimisation-card">
              <span className="privacy-kicker">DATA MINIMISATION</span>
              <h3>Not collected in v0.5</h3>
              <div className="no-store-list compact"><span>× Home address</span><span>× Passport / licence details</span><span>× Religion or caste</span><span>× Salary</span><span>× Employer address</span><span>× Biometric files</span></div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
