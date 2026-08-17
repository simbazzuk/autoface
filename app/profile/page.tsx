"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { db } from "@/lib/firebase";
import { calculateRelationshipCompleteness, type RelationshipProfile } from "@/lib/relationship-profile";
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
  const [relationshipProfile, setRelationshipProfile] = useState<Partial<RelationshipProfile> | null>(null);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [photoMessage,setPhotoMessage]=useState("");
  const [photoRefresh,setPhotoRefresh]=useState(0);

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

  useEffect(() => {
    if (!db || !user) return;
    getDoc(doc(db, "relationshipProfiles", user.uid))
      .then((snapshot) => setRelationshipProfile(snapshot.exists() ? snapshot.data() as Partial<RelationshipProfile> : {}))
      .catch(() => setRelationshipProfile({}));
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
  const atlasCompleteness = calculateRelationshipCompleteness(relationshipProfile ?? {});
  const atlasReadiness = atlasCompleteness.score >= 85 ? "STRONG" : atlasCompleteness.score >= 60 ? "GOOD" : "BUILDING";
  const readinessScore = Math.round((completeness.score * 0.45) + (atlasCompleteness.score * 0.55));

  function change<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadPhoto(file: File | null) {
    if (!user || !file || photoBusy) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMessage("Choose an image up to 5 MB.");
      return;
    }
    try {
      setPhotoBusy(true); setPhotoMessage("");
      const token=await user.getIdToken();
      const body=new FormData(); body.append("photo",file);
      const response=await fetch(`/api/profile-photo/${encodeURIComponent(user.uid)}`,{
        method:"POST",headers:{Authorization:`Bearer ${token}`},body,
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.message??result.error??"Unable to upload profile photo.");
      setPhotoRefresh(v=>v+1);
      setPhotoMessage("Profile photo updated.");
    } catch(error) {
      setPhotoMessage(error instanceof Error?error.message:"Unable to upload profile photo.");
    } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    if(!user||photoBusy)return;
    try{
      setPhotoBusy(true);setPhotoMessage("");
      const token=await user.getIdToken();
      const response=await fetch(`/api/profile-photo/${encodeURIComponent(user.uid)}`,{
        method:"DELETE",headers:{Authorization:`Bearer ${token}`},
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error??"Unable to remove profile photo.");
      setPhotoRefresh(v=>v+1);
      setPhotoMessage("Profile photo removed.");
    }catch(error){
      setPhotoMessage(error instanceof Error?error.message:"Unable to remove profile photo.");
    }finally{setPhotoBusy(false)}
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
          <span className="eyebrow">Your AutoFace Profile</span>
          <h1>Show who you are.<br/><span className="profile-hero-gradient">Keep control of what you share.</span></h1>
          <p className="lead">Shape the profile other members see, add a strong photo and give Atlas enough context to make considered introductions.</p>
        </div>
      </section>

      <section className="section profile-section">
        <div className="container">
          <div className="profile-identity-banner">
            <ProfilePhoto uid={user.uid} name={form.firstName||"You"} className="profile-identity-photo" refreshKey={photoRefresh}/>
            <div className="profile-identity-copy">
              <span className="privacy-kicker">PROFILE IDENTITY</span>
              <h2>{form.firstName.trim() || "Your profile"}{form.showAge && form.age ? `, ${form.age}` : ""}</h2>
              <p>{[form.showLocation ? form.generalLocation : "", form.showOccupation ? form.occupation : ""].filter(Boolean).join(" · ") || "Complete your profile details below"}</p>
              <div className="profile-identity-badges">
                <span>{relationshipIntentLabels[form.relationshipIntent]}</span>
                <span>Profile {completeness.score}%</span>
                <span>Atlas {atlasReadiness}</span>
              </div>
            </div>
            <div className="profile-identity-score">
              <strong>{readinessScore}%</strong>
              <span>Atlas readiness</span>
            </div>
          </div>
        </div>

        <div className="container profile-layout profile-layout-refreshed">
          <form className="card profile-form profile-form-refreshed" onSubmit={save}>
            <div className="profile-form-heading">
              <div><span className="privacy-kicker">EDIT PROFILE</span><h2>Build your member profile</h2><p>Keep the essentials clear and let your personality do the rest.</p></div>
              <span className="status-pill">PRIVATE BY DEFAULT</span>
            </div>

            <section className="profile-edit-panel profile-edit-panel-blue">
              <div className="profile-edit-panel-title"><span>01</span><div><small>ABOUT YOU</small><h3>The essentials</h3></div></div>
              <div className="form-grid">
              <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" maxLength={50} value={form.firstName} onChange={(e) => change("firstName", e.target.value)} required /></div>
              <div className="field"><label htmlFor="age">Age</label><input id="age" type="number" min={18} max={100} value={form.age} onChange={(e) => change("age", e.target.value)} required /></div>
              <div className="field"><label htmlFor="location">General location</label><input id="location" maxLength={80} placeholder="e.g. Leeds, West Yorkshire" value={form.generalLocation} onChange={(e) => change("generalLocation", e.target.value)} required /><small>Use a town/city or broad area—not your home address.</small></div>
              <div className="field"><label htmlFor="height">Height (cm) · optional</label><input id="height" type="number" min={120} max={230} value={form.heightCm} onChange={(e) => change("heightCm", e.target.value)} /></div>
              <div className="field"><label htmlFor="occupation">Occupation · optional</label><input id="occupation" maxLength={100} value={form.occupation} onChange={(e) => change("occupation", e.target.value)} /></div>
              <div className="field"><label htmlFor="education">Education · optional</label><input id="education" maxLength={120} value={form.education} onChange={(e) => change("education", e.target.value)} /></div>
              </div>
            </section>

            <section className="profile-edit-panel profile-edit-panel-pink">
              <div className="profile-edit-panel-title"><span>02</span><div><small>RELATIONSHIP</small><h3>How you want to be introduced</h3></div></div>
              <div className="field"><label htmlFor="intent">Relationship intention</label><select id="intent" value={form.relationshipIntent} onChange={(e) => change("relationshipIntent", e.target.value as RelationshipIntent)}>{Object.entries(relationshipIntentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label htmlFor="about">About me</label><textarea id="about" rows={6} maxLength={600} placeholder="Tell future introductions a little about who you are, what matters to you and the life you enjoy." value={form.aboutMe} onChange={(e) => change("aboutMe", e.target.value)} required /><small>{form.aboutMe.length}/600 characters</small></div>
            </section>

            <section className="profile-edit-panel profile-edit-panel-purple">
              <div className="profile-edit-panel-title"><span>03</span><div><small>VISIBILITY</small><h3>Control your member view</h3></div></div>
              <p className="muted privacy-copy">Choose which profile details may appear in recommendations and introductions. Your contact details and private Atlas answers are not shown.</p>
            <div className="privacy-controls">
              <label className="toggle-row"><input type="checkbox" checked={form.showAge} onChange={(e) => change("showAge", e.target.checked)} /><span><b>Show my age</b><small>Allow your age to appear on future introductions.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showLocation} onChange={(e) => change("showLocation", e.target.checked)} /><span><b>Show my general location</b><small>Only the broad area entered above—not a precise address.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showOccupation} onChange={(e) => change("showOccupation", e.target.checked)} /><span><b>Show my occupation</b><small>Your employer is not collected as a separate field.</small></span></label>
            </div>

              <div className="field"><label htmlFor="visibility">Profile visibility</label><select id="visibility" value={form.visibility} onChange={(e) => change("visibility", e.target.value as ProfileVisibility)}><option value="private">Private — only me</option><option value="future_matches">Ready for matched introductions</option></select><small>Discovery visibility remains controlled by your Privacy & Control settings.</small></div>
            </section>

            {message && <p className="notice profile-message">{message}</p>}
            <div className="profile-actions profile-actions-sticky"><div><small>Your profile remains under your control.</small><b>Save changes when you&apos;re ready.</b></div><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
          </form>

          <aside className="profile-side">
            <div className="card profile-photo-card profile-photo-card-premium">
              <div className="photo-card-glow" />
              <div className="profile-section-head">
                <div>
                  <span className="privacy-kicker">PROFILE PHOTO</span>
                  <h3>Make your first impression feel human.</h3>
                  <p className="photo-card-intro">One clear, recent photo helps an introduction feel more real before a conversation starts.</p>
                </div>
                <span className="status-pill photo-status-pill">MEMBER VIEW</span>
              </div>

              <div className="photo-stage">
                <div className="photo-stage-preview">
                  <ProfilePhoto uid={user.uid} name={form.firstName||"You"} className="photo-manager-preview premium-photo-preview" refreshKey={photoRefresh}/>
                  <span className="photo-stage-badge">YOUR PRIMARY PHOTO</span>
                </div>

                <div className="photo-manager-copy premium-photo-copy">
                  <div className="photo-tip-grid">
                    <span><b>✓ Clear face</b><small>Choose a well-lit, recent photo.</small></span>
                    <span><b>✓ Just you</b><small>Avoid group photos for your primary image.</small></span>
                    <span><b>✓ Natural</b><small>Pick a photo that feels like you.</small></span>
                  </div>

                  <label className="photo-dropzone">
                    <span className="photo-upload-icon">＋</span>
                    <b>{photoBusy ? "Uploading photo…" : "Choose a new photo"}</b>
                    <small>JPEG, PNG or WebP · maximum 5 MB</small>
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={(e)=>{void uploadPhoto(e.target.files?.[0]??null);e.currentTarget.value="";}} />
                  </label>

                  <button type="button" className="btn photo-remove-button" disabled={photoBusy} onClick={()=>void removePhoto()}>Remove current photo</button>
                </div>
              </div>

              {photoMessage&&<p className="notice photo-message">{photoMessage}</p>}

              <div className="photo-trust-strip">
                <span className="photo-trust-icon">◎</span>
                <div><b>Your photo is private infrastructure, not biometric data.</b><small>It is used as your member profile image. Facial verification remains a separate Coming Soon authenticity feature.</small></div>
              </div>
            </div>
            <div className="card completeness-card readiness-card readiness-card-premium">
              <div className="profile-section-head"><div><span className="privacy-kicker">ATLAS READINESS</span><h3>How ready is your profile?</h3></div><span className={`status-pill readiness-${atlasReadiness.toLowerCase()}`}>{atlasReadiness}</span></div>
              <div className="score">{readinessScore}%</div>
              <div className="meter"><span style={{ width: `${readinessScore}%` }} /></div>
              <div className="readiness-breakdown">
                <span><b>Member profile</b><em>{completeness.score}%</em></span>
                <span><b>Atlas relationship profile</b><em>{atlasCompleteness.score}%</em></span>
              </div>
              <p className="side-note">Readiness measures useful profile context, not attractiveness or identity. It does not increase your compatibility score.</p>
              {atlasCompleteness.score < 85 && <a className="btn" href="/relationship-profile">Improve Atlas readiness</a>}
            </div>

            <div className="card preview-card preview-card-discover">
              <div className="preview-topline"><span className="privacy-kicker">MEMBER VIEW</span><span className="preview-live-dot">● LIVE PREVIEW</span></div>
              <ProfilePhoto uid={user.uid} name={form.firstName||"You"} className="profile-preview-photo" refreshKey={photoRefresh}/>
              <h3>{form.firstName.trim() || "Your first name"}{form.showAge && form.age ? `, ${form.age}` : ""}</h3>
              {form.showLocation && form.generalLocation && <p>{form.generalLocation}</p>}
              {form.showOccupation && form.occupation && <p>{form.occupation}</p>}
              <span className="intent-chip">{relationshipIntentLabels[form.relationshipIntent]}</span>
              <p className="preview-about">{form.aboutMe || "Your introduction will appear here."}</p>
              <div className="private-banner preview-privacy-banner">👁 This mirrors what another eligible member can see.</div>
              <p className="side-note">Atlas relationship answers and AI analysis are not automatically exposed here.</p>
            </div>

            <div className="card minimisation-card">
              <span className="privacy-kicker">DATA MINIMISATION</span>
              <h3>Designed to collect less</h3>
              <div className="no-store-list compact"><span>× Home address</span><span>× Passport / licence details</span><span>× Religion or caste</span><span>× Salary</span><span>× Employer address</span><span>× Biometric files</span></div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
