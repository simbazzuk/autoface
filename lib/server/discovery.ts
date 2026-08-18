import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { calculateCompatibility } from "@/lib/compatibility";
import { defaultDiscoveryPreferences, type DiscoveryPreferences } from "@/lib/discovery-preferences";
import type { AutoFaceProfile } from "@/lib/profile";
import { calculateRelationshipCompleteness, type RelationshipProfile } from "@/lib/relationship-profile";

export const DISCOVERY_AUTHENTICITY_THRESHOLD=50;
export type RecommendationReason={code:string;label:string;score:number;kind:"strength"|"consideration"};
export type SafeDiscoveryProfile={uid:string;firstName:string;age:number|null;generalLocation:string|null;heightCm:number|null;occupation:string|null;professionArea:AutoFaceProfile["professionArea"]|null;employmentType:AutoFaceProfile["employmentType"]|null;careerImportance:AutoFaceProfile["careerImportance"]|null;educationLevel:AutoFaceProfile["educationLevel"]|null;educationField:string|null;educationInstitution:string|null;sikhAppearance:AutoFaceProfile["sikhAppearance"]|null;sikhPractice:AutoFaceProfile["sikhPractice"]|null;diet:AutoFaceProfile["diet"]|null;caste:string|null;hobbies:string[];relationshipIntent:AutoFaceProfile["relationshipIntent"];aboutMe:string;authenticityScore:number;authenticityLevel:string;compatibilityScore:number;compatibilityLevel:string;careerPreferenceFit:"preferred"|"similar_outlook"|"neutral";strongestAlignments:string[];conversationPoints:string[];recommendationReasons:RecommendationReason[];isTestProfile:boolean};

function isMissingAuthUser(error:unknown){
  if(!error||typeof error!=="object")return false;
  const value=error as {code?:string;errorInfo?:{code?:string};message?:string};
  const code=value.code??value.errorInfo?.code??"";
  const message=value.message??"";
  return code==="auth/user-not-found"||message.includes("no user record corresponding to the provided identifier");
}

async function authenticityFor(uid:string,strictAuth=false){
  if(!adminAuth||!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  try{
    const [authUser,identitySnap]=await Promise.all([
      adminAuth.getUser(uid),
      adminDb.collection("identity").doc(uid).get()
    ]);
    const identity=identitySnap.data()??{};
    return calculateAuthenticity({
      emailVerified:authUser.emailVerified===true,
      phoneVerified:Boolean(authUser.phoneNumber),
      mfaEnabled:Boolean(authUser.multiFactor?.enrolledFactors?.length),
      identityVerified:identity.identityVerified===true,
      livenessVerified:identity.livenessVerified===true,
      photoVerified:identity.photoVerified===true
    });
  }catch(error){
    if(isMissingAuthUser(error)){
      if(strictAuth)throw new Error("REQUESTER_AUTH_USER_MISSING");
      return null;
    }
    throw error;
  }
}

export async function getEligibleMember(uid:string,options?:{strictAuth?:boolean}){
  if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const [profileSnap,relationshipSnap,authenticity]=await Promise.all([
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
    authenticityFor(uid,options?.strictAuth===true)
  ]);
  if(!authenticity||!profileSnap.exists||!relationshipSnap.exists)return null;
  const profile=profileSnap.data() as AutoFaceProfile;
  const relationship=relationshipSnap.data() as RelationshipProfile;
  if(profile.visibility!=="future_matches"||relationship.consentForCompatibility!==true||authenticity.score<DISCOVERY_AUTHENTICITY_THRESHOLD)return null;
  const demoSnap=await adminDb.collection("demoProfiles").doc(uid).get();
  return{profile,relationship,authenticity,isTestProfile:demoSnap.exists&&demoSnap.data()?.isTestProfile===true}
}
async function preferencesFor(uid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const snap=await adminDb.collection("discoveryPreferences").doc(uid).get();return{uid,...defaultDiscoveryPreferences,...(snap.data()??{})} as DiscoveryPreferences}
function area(value:string){return value.toLowerCase().split(",")[0].trim()}
function passesPreferences(requester:Awaited<ReturnType<typeof getEligibleMember>>,target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,prefs:DiscoveryPreferences){if(!requester)return false;if(target.profile.age<prefs.minAge||target.profile.age>prefs.maxAge)return false;if(!prefs.relationshipIntents.includes(target.profile.relationshipIntent))return false;if(prefs.locationPreference==="same_general_area"&&area(requester.profile.generalLocation)!==area(target.profile.generalLocation))return false;if(prefs.requireRelocationOpen&&Number(target.relationship.relocationFlexibility)<3)return false;return true}
function reasons(result:ReturnType<typeof calculateCompatibility>){const strengths=result.strongestAlignments.map(x=>({code:x.key,label:x.label,score:x.score,kind:"strength" as const}));const considerations=result.conversationPoints.map(x=>({code:x.key,label:x.label,score:x.score,kind:"consideration" as const}));return[...strengths,...considerations]}
function careerFit(requester:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,prefs:DiscoveryPreferences):SafeDiscoveryProfile["careerPreferenceFit"]{if(prefs.professionPreferenceMode==="preferred_areas"&&target.profile.professionArea&&prefs.preferredProfessionAreas.includes(target.profile.professionArea))return"preferred";if(prefs.professionPreferenceMode==="similar_outlook"&&requester.profile.careerImportance&&target.profile.careerImportance&&requester.profile.careerImportance===target.profile.careerImportance)return"similar_outlook";return"neutral"}
function projection(targetUid:string,target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,result:ReturnType<typeof calculateCompatibility>,requester?:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,prefs?:DiscoveryPreferences):SafeDiscoveryProfile{return{uid:targetUid,firstName:target.profile.preferredName?.trim()||target.profile.firstName,age:target.profile.showAge?target.profile.age:null,generalLocation:target.profile.showLocation?target.profile.generalLocation:null,heightCm:target.profile.heightCm??null,occupation:target.profile.showOccupation?target.profile.occupation:null,professionArea:target.profile.professionArea??null,employmentType:target.profile.employmentType??null,careerImportance:target.profile.careerImportance??null,educationLevel:target.profile.educationLevel??null,educationField:target.profile.educationField?.trim()||null,educationInstitution:target.profile.educationInstitution?.trim()||null,sikhAppearance:target.profile.sikhAppearance??null,sikhPractice:target.profile.sikhPractice??null,diet:target.profile.diet??null,caste:target.profile.caste?.trim()||null,hobbies:Array.isArray(target.profile.hobbies)?target.profile.hobbies:[],relationshipIntent:target.profile.relationshipIntent,aboutMe:target.profile.aboutMe,authenticityScore:target.authenticity.score,authenticityLevel:target.authenticity.level,compatibilityScore:result.score,compatibilityLevel:result.level,careerPreferenceFit:requester&&prefs?careerFit(requester,target,prefs):"neutral",strongestAlignments:result.strongestAlignments.map(x=>x.label),conversationPoints:result.conversationPoints.map(x=>x.label),recommendationReasons:reasons(result),isTestProfile:target.isTestProfile}}
export async function buildDiscoveryFor(requesterUid:string){
  if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const [requester,prefs]=await Promise.all([
    getEligibleMember(requesterUid,{strictAuth:true}),
    preferencesFor(requesterUid)
  ]);
  if(!requester)return{eligible:false,candidates:[] as SafeDiscoveryProfile[],preferences:prefs};

  const [decisions,blocksByMe,blocksOfMe]=await Promise.all([
    adminDb.collection("interests").where("fromUid","==",requesterUid).get(),
    adminDb.collection("blocks").where("blockerUid","==",requesterUid).get(),
    adminDb.collection("blocks").where("blockedUid","==",requesterUid).get()
  ]);
  const excluded=new Set(decisions.docs.map(d=>String(d.data().toUid)));
  for(const d of blocksByMe.docs)excluded.add(String(d.data().blockedUid));
  for(const d of blocksOfMe.docs)excluded.add(String(d.data().blockerUid));
  excluded.add(requesterUid);

  const profiles=await adminDb.collection("profiles").where("visibility","==","future_matches").limit(60).get();
  const candidates:SafeDiscoveryProfile[]=[];
  let skippedStaleProfiles=0;

  for(const docSnap of profiles.docs){
    const uid=docSnap.id;
    if(excluded.has(uid))continue;
    const target=await getEligibleMember(uid);
    if(!target){
      // A Firestore profile can outlive its Firebase Authentication user during
      // development/admin cleanup. It must never break Discovery for everyone else.
      skippedStaleProfiles+=1;
      continue;
    }
    if(!passesPreferences(requester,target,prefs))continue;
    const result=calculateCompatibility(requester.relationship,target.relationship);
    candidates.push(projection(uid,target,result,requester,prefs));
  }

  candidates.sort((a,b)=>b.compatibilityScore-a.compatibilityScore||b.authenticityScore-a.authenticityScore);
  return{
    eligible:true,
    candidates:candidates.slice(0,3),
    preferences:prefs,
    curation:{mode:"daily" as const,limit:3,available:candidates.length,skippedStaleProfiles}
  };
}
export async function safeProjectionFor(viewerUid:string,targetUid:string){const [viewer,target,prefs]=await Promise.all([getEligibleMember(viewerUid,{strictAuth:true}),getEligibleMember(targetUid),preferencesFor(viewerUid)]);if(!viewer||!target)return null;return projection(targetUid,target,calculateCompatibility(viewer.relationship,target.relationship),viewer,prefs)}

export type ProfileAlignmentIndicator={
  key:"lifestyle"|"career"|"sikh_lifestyle"|"shared_interests"|"location";
  label:string;
  score:number;
  status:"STRONG"|"GOOD"|"NEUTRAL"|"EXPLORE";
  explanation:string;
  evidence:string[];
};

function clampFive(n:number){return Math.max(1,Math.min(5,Math.round(n)))}
function indicatorStatus(score:number):ProfileAlignmentIndicator["status"]{return score>=5?"STRONG":score>=4?"GOOD":score>=3?"NEUTRAL":"EXPLORE"}
function labelValue(value:string|undefined|null){return String(value??"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function sharedItems(a:string[]|undefined,b:string[]|undefined){const set=new Set((a??[]).map(x=>x.toLowerCase()));return (b??[]).filter(x=>set.has(x.toLowerCase()))}

function buildProfileIntelligence(
  viewer:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,
  target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,
  prefs:DiscoveryPreferences
){
  const indicators:ProfileAlignmentIndicator[]=[];

  const sharedHobbies=sharedItems(viewer.profile.hobbies,target.profile.hobbies);
  let lifestyleScore=3;
  const lifestyleEvidence:string[]=[];
  if(viewer.profile.diet&&target.profile.diet&&viewer.profile.diet!=="prefer_not_to_say"&&target.profile.diet!=="prefer_not_to_say"){
    if(viewer.profile.diet===target.profile.diet){lifestyleScore+=1;lifestyleEvidence.push(`Both describe their diet as ${labelValue(target.profile.diet)}.`)}
    else lifestyleEvidence.push(`Diet differs: ${labelValue(viewer.profile.diet)} and ${labelValue(target.profile.diet)}.`)
  }
  if(sharedHobbies.length>=3)lifestyleScore+=1;
  else if(sharedHobbies.length===0&&Array.isArray(viewer.profile.hobbies)&&viewer.profile.hobbies.length&&Array.isArray(target.profile.hobbies)&&target.profile.hobbies.length)lifestyleScore-=1;
  if(sharedHobbies.length)lifestyleEvidence.push(`Shared interests include ${sharedHobbies.slice(0,4).map(labelValue).join(", ")}.`);
  lifestyleScore=clampFive(lifestyleScore);
  indicators.push({key:"lifestyle",label:"Lifestyle",score:lifestyleScore,status:indicatorStatus(lifestyleScore),explanation:sharedHobbies.length?`You share ${sharedHobbies.length} stated lifestyle interest${sharedHobbies.length===1?"":"s"}${viewer.profile.diet===target.profile.diet&&target.profile.diet!=="prefer_not_to_say"?", alongside a similar diet":""}.`:"Atlas found limited explicit lifestyle overlap so far; this may simply reflect incomplete profile details.",evidence:lifestyleEvidence});

  let careerScore=3;
  const careerEvidence:string[]=[];
  if(viewer.profile.careerImportance&&target.profile.careerImportance){
    const levels=["low","moderate","important","very_important"];
    const gap=Math.abs(levels.indexOf(viewer.profile.careerImportance)-levels.indexOf(target.profile.careerImportance));
    careerScore+=gap===0?1:gap>=2?-1:0;
    if(gap===0)careerEvidence.push(`You both describe career as ${labelValue(target.profile.careerImportance)}.`);
  }
  if(prefs.professionPreferenceMode==="preferred_areas"&&target.profile.professionArea&&prefs.preferredProfessionAreas.includes(target.profile.professionArea)){
    careerScore+=1;careerEvidence.push(`${labelValue(target.profile.professionArea)} is one of your preferred professional areas.`);
  }else if(prefs.professionPreferenceMode==="similar_outlook"&&viewer.profile.careerImportance===target.profile.careerImportance){
    careerScore+=1;careerEvidence.push("Your stated career outlook is similar.");
  }
  if(prefs.educationPreference==="postgraduate_preferred"&&["postgraduate","doctorate","professional_qualification"].includes(String(target.profile.educationLevel)))careerScore+=1;
  if(prefs.educationPreference==="graduate_preferred"&&["undergraduate","postgraduate","doctorate","professional_qualification"].includes(String(target.profile.educationLevel)))careerScore+=1;
  careerScore=clampFive(careerScore);
  indicators.push({key:"career",label:"Career & education",score:careerScore,status:indicatorStatus(careerScore),explanation:careerEvidence.length?careerEvidence[0]:"Your career and education preferences do not create a strong positive or negative signal for this introduction.",evidence:careerEvidence});

  let sikhScore=3;
  const sikhEvidence:string[]=[];
  if(viewer.profile.sikhPractice&&target.profile.sikhPractice&&viewer.profile.sikhPractice!=="prefer_not_to_say"&&target.profile.sikhPractice!=="prefer_not_to_say"){
    if(viewer.profile.sikhPractice===target.profile.sikhPractice){sikhScore+=1;sikhEvidence.push(`You both self-describe Sikh practice as ${labelValue(target.profile.sikhPractice)}.`)}
    else sikhEvidence.push(`Sikh practice is self-described differently: ${labelValue(viewer.profile.sikhPractice)} and ${labelValue(target.profile.sikhPractice)}.`)
  }
  if(viewer.profile.diet===target.profile.diet&&target.profile.diet&&target.profile.diet!=="prefer_not_to_say")sikhScore+=1;
  sikhScore=clampFive(sikhScore);
  indicators.push({key:"sikh_lifestyle",label:"Sikh lifestyle",score:sikhScore,status:indicatorStatus(sikhScore),explanation:sikhEvidence.length?sikhEvidence[0]:"The available Sikh lifestyle details are being shown as context, not treated as a judgement of compatibility.",evidence:sikhEvidence});

  let interestsScore=3;
  const interestEvidence:string[]=[];
  if(sharedHobbies.length>=4)interestsScore=5;
  else if(sharedHobbies.length>=2)interestsScore=4;
  else if(sharedHobbies.length===1)interestsScore=3;
  else if((viewer.profile.hobbies?.length??0)>0&&(target.profile.hobbies?.length??0)>0)interestsScore=2;
  if(prefs.sharedInterestPreference!=="doesnt_matter"&&prefs.preferredSharedInterests.length){
    const preferredMatches=(target.profile.hobbies??[]).filter(x=>prefs.preferredSharedInterests.includes(x));
    if(preferredMatches.length){interestsScore=clampFive(interestsScore+1);interestEvidence.push(`${preferredMatches.slice(0,4).map(labelValue).join(", ")} match interests you said matter to you.`)}
  }
  if(sharedHobbies.length)interestEvidence.unshift(`You both selected ${sharedHobbies.slice(0,5).map(labelValue).join(", ")}.`);
  indicators.push({key:"shared_interests",label:"Shared interests",score:interestsScore,status:indicatorStatus(interestsScore),explanation:sharedHobbies.length?`There is visible overlap in the activities you both chose.`:"No shared hobby signal is currently visible from the profile selections.",evidence:interestEvidence});

  let locationScore=3;
  const locationEvidence:string[]=[];
  const sameArea=area(viewer.profile.generalLocation)===area(target.profile.generalLocation);
  if(sameArea){locationScore=5;locationEvidence.push("You are in the same general area.")}
  else if(prefs.introductionLocation==="international"){locationScore=4;locationEvidence.push("You said you are open to international introductions.")}
  else if(prefs.introductionLocation==="uk_wide"){locationScore=4;locationEvidence.push("You said you are open to UK-wide introductions.")}
  else if(prefs.introductionLocation==="same_area"){locationScore=2;locationEvidence.push("This person is outside your stated same-area preference.")}
  else locationEvidence.push("Location is being treated as a soft contextual preference.");
  indicators.push({key:"location",label:"Location fit",score:locationScore,status:indicatorStatus(locationScore),explanation:locationEvidence[0],evidence:locationEvidence});

  const heightEvidence:string[]=[];
  if(target.profile.heightCm&&prefs.heightPreferenceImportance!=="doesnt_matter"){
    const min=prefs.preferredHeightMinCm,max=prefs.preferredHeightMaxCm;
    const inRange=(min===null||target.profile.heightCm>=min)&&(max===null||target.profile.heightCm<=max);
    heightEvidence.push(inRange?`${target.profile.heightCm} cm falls within your stated height preference.`:`${target.profile.heightCm} cm sits outside your stated preferred height range.`);
  }

  const positive=indicators.filter(x=>x.score>=4).sort((a,b)=>b.score-a.score);
  const explore=indicators.filter(x=>x.score<=2);
  const headline=positive.length>=2?`${positive[0].label} and ${positive[1].label} add context beyond the core compatibility score.`:positive.length===1?`${positive[0].label} adds a positive profile signal to this introduction.`:"The relationship score remains the strongest signal; profile details add useful context rather than a separate judgement.";
  return{
    headline,
    indicators,
    heightEvidence,
    strongestProfileSignals:positive.slice(0,3).map(x=>x.label),
    thingsToExplore:explore.map(x=>x.label),
    notice:"Profile alignment is deterministic context built only from details both members supplied and preferences you explicitly set. It does not change the official compatibility percentage."
  };
}

export async function recommendationFor(viewerUid:string,targetUid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const [viewer,target,prefs]=await Promise.all([getEligibleMember(viewerUid),getEligibleMember(targetUid),preferencesFor(viewerUid)]);if(!viewer||!target||!passesPreferences(viewer,target,prefs))return null;const result=calculateCompatibility(viewer.relationship,target.relationship);const viewerCompleteness=calculateRelationshipCompleteness(viewer.relationship);const candidateCompleteness=calculateRelationshipCompleteness(target.relationship);const confidenceScore=Math.min(viewerCompleteness.score,candidateCompleteness.score);const confidence=confidenceScore>=85?"HIGH":confidenceScore>=65?"GOOD":"LIMITED";return{candidate:projection(targetUid,target,result,viewer,prefs),dimensions:result.dimensions.map(d=>({code:d.key,label:d.label,weight:d.weight,score:d.score,explanation:d.explanation})),summary:result.summary,intelligence:{confidence,confidenceScore,signalsUsed:Math.min(viewerCompleteness.completed,candidateCompleteness.completed),signalsAvailable:viewerCompleteness.total,notice:confidence==="LIMITED"?"One or both relationship profiles are incomplete, so Atlas has less context for this explanation.":"Both relationship profiles contain enough structured context for a considered explanation."},profileIntelligence:buildProfileIntelligence(viewer,target,prefs),preferences:{minAge:prefs.minAge,maxAge:prefs.maxAge,locationPreference:prefs.locationPreference,relationshipIntents:prefs.relationshipIntents,requireRelocationOpen:prefs.requireRelocationOpen,professionPreferenceMode:prefs.professionPreferenceMode,educationPreference:prefs.educationPreference,heightPreferenceImportance:prefs.heightPreferenceImportance,introductionLocation:prefs.introductionLocation,sharedInterestPreference:prefs.sharedInterestPreference}}

}


export type ReviewedRecommendation = SafeDiscoveryProfile & {
  decision: "interested" | "saved" | "pass";
  reviewedAt: string | null;
  mutual: boolean;
};

function timestampIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function reviewedRecommendationsFor(requesterUid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const [requester,prefs] = await Promise.all([getEligibleMember(requesterUid,{strictAuth:true}),preferencesFor(requesterUid)]);
  if (!requester) return { eligible: false, items: [] as ReviewedRecommendation[] };

  const decisions = await adminDb.collection("interests").where("fromUid", "==", requesterUid).get();
  const items: ReviewedRecommendation[] = [];

  for (const decisionDoc of decisions.docs) {
    const data = decisionDoc.data();
    const targetUid = String(data.toUid ?? "");
    const decision = String(data.status ?? "");
    if (!targetUid || !["interested", "saved", "pass"].includes(decision)) continue;

    const target = await getEligibleMember(targetUid);
    if (!target) continue;

    const result = calculateCompatibility(requester.relationship, target.relationship);
    const participants = [requesterUid, targetUid].sort();
    const matchSnap = await adminDb.collection("matches").doc(participants.join("__")).get();

    items.push({
      ...projection(targetUid, target, result, requester, prefs),
      decision: decision as "interested" | "saved" | "pass",
      reviewedAt: timestampIso(data.updatedAt ?? data.createdAt),
      mutual: matchSnap.exists && String(matchSnap.data()?.status ?? "") === "mutual",
    });
  }

  items.sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));
  return { eligible: true, items };
}
