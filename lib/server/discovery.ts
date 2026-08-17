import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { calculateCompatibility } from "@/lib/compatibility";
import { defaultDiscoveryPreferences, type DiscoveryPreferences } from "@/lib/discovery-preferences";
import type { AutoFaceProfile } from "@/lib/profile";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const DISCOVERY_AUTHENTICITY_THRESHOLD=50;
export type RecommendationReason={code:string;label:string;score:number;kind:"strength"|"consideration"};
export type SafeDiscoveryProfile={uid:string;firstName:string;age:number|null;generalLocation:string|null;occupation:string|null;relationshipIntent:AutoFaceProfile["relationshipIntent"];aboutMe:string;authenticityScore:number;authenticityLevel:string;compatibilityScore:number;compatibilityLevel:string;strongestAlignments:string[];conversationPoints:string[];recommendationReasons:RecommendationReason[];isTestProfile:boolean};

async function authenticityFor(uid:string){if(!adminAuth||!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const [authUser,identitySnap]=await Promise.all([adminAuth.getUser(uid),adminDb.collection("identity").doc(uid).get()]);const identity=identitySnap.data()??{};return calculateAuthenticity({emailVerified:authUser.emailVerified===true,phoneVerified:Boolean(authUser.phoneNumber),mfaEnabled:Boolean(authUser.multiFactor?.enrolledFactors?.length),identityVerified:identity.identityVerified===true,livenessVerified:identity.livenessVerified===true,photoVerified:identity.photoVerified===true})}
export async function getEligibleMember(uid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const [profileSnap,relationshipSnap,authenticity]=await Promise.all([adminDb.collection("profiles").doc(uid).get(),adminDb.collection("relationshipProfiles").doc(uid).get(),authenticityFor(uid)]);if(!profileSnap.exists||!relationshipSnap.exists)return null;const profile=profileSnap.data() as AutoFaceProfile;const relationship=relationshipSnap.data() as RelationshipProfile;if(profile.visibility!=="future_matches"||relationship.consentForCompatibility!==true||authenticity.score<DISCOVERY_AUTHENTICITY_THRESHOLD)return null;const demoSnap=await adminDb.collection("demoProfiles").doc(uid).get();return{profile,relationship,authenticity,isTestProfile:demoSnap.exists&&demoSnap.data()?.isTestProfile===true}}
async function preferencesFor(uid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const snap=await adminDb.collection("discoveryPreferences").doc(uid).get();return{uid,...defaultDiscoveryPreferences,...(snap.data()??{})} as DiscoveryPreferences}
function area(value:string){return value.toLowerCase().split(",")[0].trim()}
function passesPreferences(requester:Awaited<ReturnType<typeof getEligibleMember>>,target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,prefs:DiscoveryPreferences){if(!requester)return false;if(target.profile.age<prefs.minAge||target.profile.age>prefs.maxAge)return false;if(!prefs.relationshipIntents.includes(target.profile.relationshipIntent))return false;if(prefs.locationPreference==="same_general_area"&&area(requester.profile.generalLocation)!==area(target.profile.generalLocation))return false;if(prefs.requireRelocationOpen&&Number(target.relationship.relocationFlexibility)<3)return false;return true}
function reasons(result:ReturnType<typeof calculateCompatibility>){const strengths=result.strongestAlignments.map(x=>({code:x.key,label:x.label,score:x.score,kind:"strength" as const}));const considerations=result.conversationPoints.map(x=>({code:x.key,label:x.label,score:x.score,kind:"consideration" as const}));return[...strengths,...considerations]}
function projection(targetUid:string,target:NonNullable<Awaited<ReturnType<typeof getEligibleMember>>>,result:ReturnType<typeof calculateCompatibility>):SafeDiscoveryProfile{return{uid:targetUid,firstName:target.profile.firstName,age:target.profile.showAge?target.profile.age:null,generalLocation:target.profile.showLocation?target.profile.generalLocation:null,occupation:target.profile.showOccupation?target.profile.occupation:null,relationshipIntent:target.profile.relationshipIntent,aboutMe:target.profile.aboutMe,authenticityScore:target.authenticity.score,authenticityLevel:target.authenticity.level,compatibilityScore:result.score,compatibilityLevel:result.level,strongestAlignments:result.strongestAlignments.map(x=>x.label),conversationPoints:result.conversationPoints.map(x=>x.label),recommendationReasons:reasons(result),isTestProfile:target.isTestProfile}}
export async function buildDiscoveryFor(requesterUid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const [requester,prefs]=await Promise.all([getEligibleMember(requesterUid),preferencesFor(requesterUid)]);if(!requester)return{eligible:false,candidates:[] as SafeDiscoveryProfile[],preferences:prefs};const [decisions,blocksByMe,blocksOfMe]=await Promise.all([adminDb.collection("interests").where("fromUid","==",requesterUid).get(),adminDb.collection("blocks").where("blockerUid","==",requesterUid).get(),adminDb.collection("blocks").where("blockedUid","==",requesterUid).get()]);const excluded=new Set(decisions.docs.map(d=>String(d.data().toUid)));for(const d of blocksByMe.docs)excluded.add(String(d.data().blockedUid));for(const d of blocksOfMe.docs)excluded.add(String(d.data().blockerUid));excluded.add(requesterUid);const profiles=await adminDb.collection("profiles").where("visibility","==","future_matches").limit(60).get();const candidates:SafeDiscoveryProfile[]=[];for(const docSnap of profiles.docs){const uid=docSnap.id;if(excluded.has(uid))continue;const target=await getEligibleMember(uid);if(!target||!passesPreferences(requester,target,prefs))continue;const result=calculateCompatibility(requester.relationship,target.relationship);candidates.push(projection(uid,target,result))}candidates.sort((a,b)=>b.compatibilityScore-a.compatibilityScore||b.authenticityScore-a.authenticityScore);return{eligible:true,candidates:candidates.slice(0,12),preferences:prefs}}
export async function safeProjectionFor(viewerUid:string,targetUid:string){const [viewer,target]=await Promise.all([getEligibleMember(viewerUid),getEligibleMember(targetUid)]);if(!viewer||!target)return null;return projection(targetUid,target,calculateCompatibility(viewer.relationship,target.relationship))}
export async function recommendationFor(viewerUid:string,targetUid:string){if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");const [viewer,target,prefs]=await Promise.all([getEligibleMember(viewerUid),getEligibleMember(targetUid),preferencesFor(viewerUid)]);if(!viewer||!target||!passesPreferences(viewer,target,prefs))return null;const result=calculateCompatibility(viewer.relationship,target.relationship);return{candidate:projection(targetUid,target,result),dimensions:result.dimensions.map(d=>({code:d.key,label:d.label,weight:d.weight,score:d.score,explanation:d.explanation})),summary:result.summary,preferences:{minAge:prefs.minAge,maxAge:prefs.maxAge,locationPreference:prefs.locationPreference,relationshipIntents:prefs.relationshipIntents,requireRelocationOpen:prefs.requireRelocationOpen}}

}


export type ReviewedRecommendation = SafeDiscoveryProfile & {
  decision: "interested" | "pass";
  reviewedAt: string | null;
  mutual: boolean;
};

function timestampIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function reviewedRecommendationsFor(requesterUid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const requester = await getEligibleMember(requesterUid);
  if (!requester) return { eligible: false, items: [] as ReviewedRecommendation[] };

  const decisions = await adminDb.collection("interests").where("fromUid", "==", requesterUid).get();
  const items: ReviewedRecommendation[] = [];

  for (const decisionDoc of decisions.docs) {
    const data = decisionDoc.data();
    const targetUid = String(data.toUid ?? "");
    const decision = String(data.status ?? "");
    if (!targetUid || !["interested", "pass"].includes(decision)) continue;

    const target = await getEligibleMember(targetUid);
    if (!target) continue;

    const result = calculateCompatibility(requester.relationship, target.relationship);
    const participants = [requesterUid, targetUid].sort();
    const matchSnap = await adminDb.collection("matches").doc(participants.join("__")).get();

    items.push({
      ...projection(targetUid, target, result),
      decision: decision as "interested" | "pass",
      reviewedAt: timestampIso(data.updatedAt ?? data.createdAt),
      mutual: matchSnap.exists && String(matchSnap.data()?.status ?? "") === "mutual",
    });
  }

  items.sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));
  return { eligible: true, items };
}
