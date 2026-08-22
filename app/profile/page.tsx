"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { MemberJourney } from "@/components/MemberJourney";
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
  surname: "",
  preferredName: "",
  age: "",
  generalLocation: "",
  heightCm: "",
  occupation: "",
  professionArea: "other" as "healthcare" | "technology" | "finance" | "engineering" | "education" | "legal" | "business" | "public_sector" | "creative" | "skilled_trades" | "other",
  employmentType: "employed" as "employed" | "self_employed" | "business_owner" | "student" | "other",
  careerImportance: "moderate" as "low" | "moderate" | "important" | "very_important",
  education: "",
  educationLevel: "undergraduate" as "school_college" | "undergraduate" | "postgraduate" | "doctorate" | "professional_qualification" | "other",
  educationField: "",
  educationInstitution: "",
  caste: "",
  sikhAppearance: "prefer_not_to_say" as "turbaned" | "clean_shaven" | "not_applicable" | "prefer_not_to_say",
  sikhPractice: "prefer_not_to_say" as "amritdhari" | "practising" | "moderate" | "cultural_not_religious" | "prefer_not_to_say",
  diet: "prefer_not_to_say" as "vegetarian" | "non_vegetarian" | "vegan" | "prefer_not_to_say",
  hobbies: [] as string[],
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
  const [journeySaved,setJourneySaved]=useState(false);
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
          surname: data.surname ?? "",
          preferredName: data.preferredName ?? "",
          age: data.age ? String(data.age) : "",
          generalLocation: data.generalLocation ?? "",
          heightCm: data.heightCm ? String(data.heightCm) : "",
          occupation: data.occupation ?? "",
          professionArea: data.professionArea ?? "other",
          employmentType: data.employmentType ?? "employed",
          careerImportance: data.careerImportance ?? "moderate",
          education: data.education ?? "",
          educationLevel: data.educationLevel ?? "undergraduate",
          educationField: data.educationField ?? "",
          educationInstitution: data.educationInstitution ?? "",
          caste: data.caste ?? "",
          sikhAppearance: data.sikhAppearance ?? "prefer_not_to_say",
          sikhPractice: data.sikhPractice ?? "prefer_not_to_say",
          diet: data.diet ?? "prefer_not_to_say",
          hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
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
    surname: form.surname,
    preferredName: form.preferredName,
    age: Number(form.age),
    generalLocation: form.generalLocation,
    heightCm: form.heightCm ? Number(form.heightCm) : null,
    occupation: form.occupation,
    professionArea: form.professionArea,
    employmentType: form.employmentType,
    careerImportance: form.careerImportance,
    education: form.education,
    educationLevel: form.educationLevel,
    educationField: form.educationField,
    educationInstitution: form.educationInstitution,
    caste: form.caste,
    sikhAppearance: form.sikhAppearance,
    sikhPractice: form.sikhPractice,
    diet: form.diet,
    hobbies: form.hobbies,
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
      setPhotoMessage(result.verificationReset
        ? "Profile photo updated. Your previous Face Verified status has been reset — please verify the new primary photo."
        : "Profile photo updated.");
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
      setPhotoMessage(result.verificationReset
        ? "Profile photo removed. Face Verified has been reset because the verified reference photo is no longer present."
        : "Profile photo removed.");
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
    if (!form.firstName.trim() || !form.surname.trim() || !form.generalLocation.trim() || !form.aboutMe.trim()) {
      setMessage("First name, surname, general location and About me are required.");
      return;
    }
    try {
      setSaving(true);
      setMessage("");
      await setDoc(doc(db, "profiles", user.uid), {
        uid: user.uid,
        firstName: form.firstName.trim(),
        surname: form.surname.trim(),
        preferredName: form.preferredName.trim(),
        age,
        generalLocation: form.generalLocation.trim(),
        heightCm,
        occupation: form.occupation.trim(),
        professionArea: form.professionArea,
        employmentType: form.employmentType,
        careerImportance: form.careerImportance,
        education: form.education.trim(),
        educationLevel: form.educationLevel,
        educationField: form.educationField.trim(),
        educationInstitution: form.educationInstitution.trim(),
        caste: form.caste.trim(),
        sikhAppearance: form.sikhAppearance,
        sikhPractice: form.sikhPractice,
        diet: form.diet,
        hobbies: form.hobbies,
        relationshipIntent: form.relationshipIntent,
        aboutMe: form.aboutMe.trim(),
        visibility: form.visibility,
        showAge: form.showAge,
        showLocation: form.showLocation,
        showOccupation: form.showOccupation,
        createdAt: initialCreatedAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessage("Profile saved.");
      setJourneySaved(true);
    } catch (error) {
      const detail=error instanceof Error ? error.message : "Unable to save your profile.";
      setMessage(detail.includes("Missing or insufficient permissions")
        ? "Profile save was rejected by Firestore permissions. Make sure the latest firestore.rules have been deployed."
        : detail);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || loadingProfile) {
    return <main><section className="section"><div className="container"><p className="muted">Loading your private profile…</p></div></section></main>;
  }

  const displayName=form.preferredName.trim() || form.firstName.trim();
  const hobbyOptions=[["fitness","🏋","Fitness"],["running","🏃","Running"],["sports","⚽","Sports"],["cinema","🎬","Cinema"],["travel","✈","Travel"],["food","🍽","Food"],["music","🎵","Music"],["reading","📚","Reading"],["gaming","🎮","Gaming"],["outdoors","🌳","Outdoors"],["socialising","☕","Socialising"],["nightlife","🎉","Nightlife"],["family","👨‍👩‍👧","Family time"],["volunteering","🤝","Volunteering"],["arts","🎨","Arts & culture"]] as const;
  function toggleHobby(value:string){change("hobbies",form.hobbies.includes(value)?form.hobbies.filter(x=>x!==value):[...form.hobbies,value]);}

  return (
    <main>
      <section className="page-hero compact-hero">
        <div className="container">
          <span className="eyebrow">Your AutoFace Profile</span>
          <h1>Show who you are.<br/><span className="profile-hero-gradient">Keep control of what you share.</span></h1>
          <p className="lead">Shape the profile other members see, add a strong photo and give Atlas enough context to make considered introductions.</p>
        </div>
      </section>

      <MemberJourney stage="profile"/>

      <section className="section profile-section">
        <div className="container">
          <div className="profile-identity-banner">
            <ProfilePhoto uid={user.uid} name={displayName||"You"} className="profile-identity-photo" refreshKey={photoRefresh}/>
            <div className="profile-identity-copy">
              <span className="privacy-kicker">PROFILE IDENTITY</span>
              <h2>{displayName || "Your profile"}{form.showAge && form.age ? `, ${form.age}` : ""}</h2>
              <p>{[form.showLocation ? form.generalLocation : "", form.showOccupation ? form.occupation : ""].filter(Boolean).join(" · ") || "Complete your profile details below"}</p>
              <div className="profile-identity-badges">
                <span>{relationshipIntentLabels[form.relationshipIntent]}</span>
                {form.sikhPractice!=="prefer_not_to_say" && <span>{form.sikhPractice==="amritdhari"?"Amritdhari":form.sikhPractice==="practising"?"Practising":form.sikhPractice==="moderate"?"Moderate practice":"Cultural / not religious"}</span>}
                {form.diet!=="prefer_not_to_say" && <span>{form.diet==="non_vegetarian"?"Non-vegetarian":form.diet.charAt(0).toUpperCase()+form.diet.slice(1)}</span>}
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
              <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" maxLength={50} value={form.firstName} onChange={(e) => change("firstName", e.target.value)} required /><small>Your given first name. AutoFace can show your preferred name instead.</small></div>
              <div className="field"><label htmlFor="surname">Surname</label><input id="surname" maxLength={60} value={form.surname} onChange={(e) => change("surname", e.target.value)} required /><small>Stored privately for your profile record. Your surname is not shown in Discover.</small></div>
              <div className="field"><label htmlFor="preferredName">Preferred name · optional</label><input id="preferredName" maxLength={50} placeholder="e.g. Garry" value={form.preferredName} onChange={(e) => change("preferredName", e.target.value)} /><small>If supplied, this is the name shown on profile cards and introductions.</small></div>
              <div className="field"><label htmlFor="age">Age</label><input id="age" type="number" min={18} max={100} value={form.age} onChange={(e) => change("age", e.target.value)} required /></div>
              <div className="field"><label htmlFor="location">General location</label><input id="location" maxLength={80} placeholder="e.g. Leeds, West Yorkshire" value={form.generalLocation} onChange={(e) => change("generalLocation", e.target.value)} required /><small>Use a town/city or broad area—not your home address.</small></div>
              <div className="field"><label htmlFor="height">Height (cm) · optional</label><input id="height" type="number" min={120} max={230} value={form.heightCm} onChange={(e) => change("heightCm", e.target.value)} /></div>
              <div className="field"><label htmlFor="occupation">Profession / job title · optional</label><input id="occupation" maxLength={100} placeholder="e.g. Dentist, Software Engineer" value={form.occupation} onChange={(e) => change("occupation", e.target.value)} /></div>
              <div className="field"><label htmlFor="professionArea">Professional area · optional</label><select id="professionArea" value={form.professionArea} onChange={(e)=>change("professionArea",e.target.value as typeof form.professionArea)}><option value="healthcare">Healthcare</option><option value="technology">Technology</option><option value="finance">Finance</option><option value="engineering">Engineering</option><option value="education">Education</option><option value="legal">Legal</option><option value="business">Business</option><option value="public_sector">Public sector</option><option value="creative">Creative</option><option value="skilled_trades">Skilled trades</option><option value="other">Other</option></select></div>
              <div className="field"><label htmlFor="employmentType">Employment</label><select id="employmentType" value={form.employmentType} onChange={(e)=>change("employmentType",e.target.value as typeof form.employmentType)}><option value="employed">Employed</option><option value="self_employed">Self-employed</option><option value="business_owner">Business owner</option><option value="student">Student</option><option value="other">Other</option></select></div>
              <div className="field"><label htmlFor="careerImportance">Career importance</label><select id="careerImportance" value={form.careerImportance} onChange={(e)=>change("careerImportance",e.target.value as typeof form.careerImportance)}><option value="low">Low</option><option value="moderate">Moderate</option><option value="important">Important</option><option value="very_important">Very important</option></select></div>
              <div className="field"><label htmlFor="educationLevel">Highest education</label><select id="educationLevel" value={form.educationLevel} onChange={(e)=>change("educationLevel",e.target.value as typeof form.educationLevel)}><option value="school_college">School / college</option><option value="undergraduate">Undergraduate</option><option value="postgraduate">Postgraduate</option><option value="doctorate">Doctorate</option><option value="professional_qualification">Professional qualification</option><option value="other">Other</option></select></div>
              <div className="field"><label htmlFor="educationField">Subject / field · optional</label><input id="educationField" maxLength={100} placeholder="e.g. Dentistry, Computer Science" value={form.educationField} onChange={(e)=>change("educationField",e.target.value)} /></div>
              <div className="field"><label htmlFor="educationInstitution">Institution · optional</label><input id="educationInstitution" maxLength={120} placeholder="e.g. University of Birmingham" value={form.educationInstitution} onChange={(e)=>change("educationInstitution",e.target.value)} /></div>
              <div className="field"><label htmlFor="education">Education summary · optional</label><input id="education" maxLength={120} placeholder="Optional short summary" value={form.education} onChange={(e) => change("education", e.target.value)} /></div>
              </div>
            </section>

            <section className="profile-edit-panel profile-edit-panel-sikh">
              <div className="profile-edit-panel-title"><span>02</span><div><small>SIKH IDENTITY & LIFESTYLE</small><h3>Share what matters to you</h3></div></div>
              <p className="muted privacy-copy">These details are optional and self-described. AutoFace does not infer them, and they are not automatically used to change your compatibility score.</p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="sikhAppearance">Appearance · optional</label>
                  <select id="sikhAppearance" value={form.sikhAppearance} onChange={(e) => change("sikhAppearance", e.target.value as typeof form.sikhAppearance)}>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="turbaned">Turbaned</option>
                    <option value="clean_shaven">Clean shaven / non-turbaned</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                  <small>Use this only if it is relevant to how you describe yourself.</small>
                </div>
                <div className="field">
                  <label htmlFor="sikhPractice">Sikh practice · optional</label>
                  <select id="sikhPractice" value={form.sikhPractice} onChange={(e) => change("sikhPractice", e.target.value as typeof form.sikhPractice)}>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="amritdhari">Amritdhari</option>
                    <option value="practising">Practising</option>
                    <option value="moderate">Moderate</option>
                    <option value="cultural_not_religious">Cultural / not religious</option>
                  </select>
                  <small>Self-described only — AutoFace does not infer religious practice.</small>
                </div>
                <div className="field">
                  <label htmlFor="diet">Diet · optional</label>
                  <select id="diet" value={form.diet} onChange={(e) => change("diet", e.target.value as typeof form.diet)}>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non_vegetarian">Non-vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="caste">Caste / community · optional</label>
                  <input id="caste" maxLength={80} placeholder="e.g. Jatt, Ramgarhia, Khatri — or leave blank" value={form.caste} onChange={(e) => change("caste", e.target.value)} />
                  <small>Optional and self-described. AutoFace does not infer caste and you can leave this blank.</small>
                </div>
              </div>
              <div className="profile-hobbies">
                <div className="profile-hobbies-title"><div><small>LIFESTYLE & INTERESTS</small><h4>What do you enjoy?</h4></div><span>Choose as many as you like</span></div>
                <div className="hobby-chip-grid">{hobbyOptions.map(([value,icon,label])=><button type="button" key={value} className={`hobby-chip ${form.hobbies.includes(value)?"selected":""}`} onClick={()=>toggleHobby(value)}><span>{icon}</span><b>{label}</b></button>)}</div>
              </div>
              <div className="sikh-profile-note">
                <span>◎</span>
                <div><b>Your identity is not a compatibility score.</b><small>These fields help you describe yourself. Any future use as a Discovery preference should be explicit and under your control.</small></div>
              </div>
            </section>

            <section className="profile-edit-panel profile-edit-panel-pink">
              <div className="profile-edit-panel-title"><span>03</span><div><small>RELATIONSHIP</small><h3>How you want to be introduced</h3></div></div>
              <div className="field"><label htmlFor="intent">Relationship intention</label><select id="intent" value={form.relationshipIntent} onChange={(e) => change("relationshipIntent", e.target.value as RelationshipIntent)}>{Object.entries(relationshipIntentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label htmlFor="about">About me</label><textarea id="about" rows={6} maxLength={600} placeholder="Tell future introductions a little about who you are, what matters to you and the life you enjoy." value={form.aboutMe} onChange={(e) => change("aboutMe", e.target.value)} required /><small>{form.aboutMe.length}/600 characters</small></div>
            </section>

            <section className="profile-edit-panel profile-edit-panel-purple">
              <div className="profile-edit-panel-title"><span>04</span><div><small>VISIBILITY</small><h3>Control your member view</h3></div></div>
              <p className="muted privacy-copy">Choose which profile details may appear in recommendations and introductions. Your contact details and private Atlas answers are not shown.</p>
            <div className="privacy-controls">
              <label className="toggle-row"><input type="checkbox" checked={form.showAge} onChange={(e) => change("showAge", e.target.checked)} /><span><b>Show my age</b><small>Allow your age to appear on future introductions.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showLocation} onChange={(e) => change("showLocation", e.target.checked)} /><span><b>Show my general location</b><small>Only the broad area entered above—not a precise address.</small></span></label>
              <label className="toggle-row"><input type="checkbox" checked={form.showOccupation} onChange={(e) => change("showOccupation", e.target.checked)} /><span><b>Show my occupation</b><small>Your employer is not collected as a separate field.</small></span></label>
            </div>

              <div className="field"><label htmlFor="visibility">Profile visibility</label><select id="visibility" value={form.visibility} onChange={(e) => change("visibility", e.target.value as ProfileVisibility)}><option value="private">Private — only me</option><option value="future_matches">Ready for matched introductions</option></select><small>Discovery visibility remains controlled by your Privacy & Control settings.</small></div>
            </section>

            {message && <p className="notice profile-message">{message}</p>}
            {journeySaved&&<div className="journey-complete-card">
              <div><span className="privacy-kicker">PROFILE COMPLETE</span><h3>Your profile is ready for the next step.</h3><p>Atlas now needs to understand the relationship values and expectations that matter to you before AutoFace can make considered recommendations.</p></div>
              <a className="btn btn-primary journey-next-button" href="/relationship-profile">Continue to Atlas →</a>
            </div>}
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
                  <ProfilePhoto uid={user.uid} name={displayName||"You"} className="photo-manager-preview premium-photo-preview" refreshKey={photoRefresh}/>
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
              <ProfilePhoto uid={user.uid} name={displayName||"You"} className="profile-preview-photo" refreshKey={photoRefresh}/>
              <h3>{displayName || "Your first name"}{form.showAge && form.age ? `, ${form.age}` : ""}</h3>
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
