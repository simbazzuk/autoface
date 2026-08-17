import { adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { calculateCompatibility } from "@/lib/compatibility";
import type { AutoFaceProfile } from "@/lib/profile";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const DISCOVERY_AUTHENTICITY_THRESHOLD = 50;

export type SafeDiscoveryProfile = {
  uid: string;
  firstName: string;
  age: number | null;
  generalLocation: string | null;
  occupation: string | null;
  relationshipIntent: AutoFaceProfile["relationshipIntent"];
  aboutMe: string;
  authenticityScore: number;
  authenticityLevel: string;
  compatibilityScore: number;
  compatibilityLevel: string;
  strongestAlignments: string[];
  conversationPoints: string[];
  isTestProfile: boolean;
};

async function authenticityFor(uid: string) {
  if (!adminAuth || !adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const [authUser, identitySnap] = await Promise.all([
    adminAuth.getUser(uid),
    adminDb.collection("identity").doc(uid).get(),
  ]);
  const identity = identitySnap.data() ?? {};
  const result = calculateAuthenticity({
    emailVerified: authUser.emailVerified === true,
    phoneVerified: Boolean(authUser.phoneNumber),
    mfaEnabled: Boolean(authUser.multiFactor?.enrolledFactors?.length),
    identityVerified: identity.identityVerified === true,
    livenessVerified: identity.livenessVerified === true,
    photoVerified: identity.photoVerified === true,
  });
  return result;
}

export async function getEligibleMember(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const [profileSnap, relationshipSnap, authenticity] = await Promise.all([
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
    authenticityFor(uid),
  ]);
  if (!profileSnap.exists || !relationshipSnap.exists) return null;
  const profile = profileSnap.data() as AutoFaceProfile;
  const relationship = relationshipSnap.data() as RelationshipProfile;
  if (profile.visibility !== "future_matches") return null;
  if (relationship.consentForCompatibility !== true) return null;
  if (authenticity.score < DISCOVERY_AUTHENTICITY_THRESHOLD) return null;
  const demoSnap = await adminDb.collection("demoProfiles").doc(uid).get();
  return { profile, relationship, authenticity, isTestProfile: demoSnap.exists && demoSnap.data()?.isTestProfile === true };
}

export async function buildDiscoveryFor(requesterUid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const requester = await getEligibleMember(requesterUid);
  if (!requester) return { eligible: false, candidates: [] as SafeDiscoveryProfile[] };

  const [decisions, blocksByMe, blocksOfMe] = await Promise.all([
    adminDb.collection("interests").where("fromUid", "==", requesterUid).get(),
    adminDb.collection("blocks").where("blockerUid", "==", requesterUid).get(),
    adminDb.collection("blocks").where("blockedUid", "==", requesterUid).get(),
  ]);
  const excluded = new Set(decisions.docs.map((d) => String(d.data().toUid)));
  for (const doc of blocksByMe.docs) excluded.add(String(doc.data().blockedUid));
  for (const doc of blocksOfMe.docs) excluded.add(String(doc.data().blockerUid));
  excluded.add(requesterUid);

  const profiles = await adminDb.collection("profiles").where("visibility", "==", "future_matches").limit(40).get();
  const candidates: SafeDiscoveryProfile[] = [];
  for (const docSnap of profiles.docs) {
    const uid = docSnap.id;
    if (excluded.has(uid)) continue;
    const target = await getEligibleMember(uid);
    if (!target) continue;
    const result = calculateCompatibility(requester.relationship, target.relationship);
    candidates.push({
      uid,
      firstName: target.profile.firstName,
      age: target.profile.showAge ? target.profile.age : null,
      generalLocation: target.profile.showLocation ? target.profile.generalLocation : null,
      occupation: target.profile.showOccupation ? target.profile.occupation : null,
      relationshipIntent: target.profile.relationshipIntent,
      aboutMe: target.profile.aboutMe,
      authenticityScore: target.authenticity.score,
      authenticityLevel: target.authenticity.level,
      compatibilityScore: result.score,
      compatibilityLevel: result.level,
      strongestAlignments: result.strongestAlignments.map((x) => x.label),
      conversationPoints: result.conversationPoints.map((x) => x.label),
      isTestProfile: target.isTestProfile,
    });
  }
  candidates.sort((a,b) => b.compatibilityScore - a.compatibilityScore || b.authenticityScore - a.authenticityScore);
  return { eligible: true, candidates: candidates.slice(0, 8) };
}

export async function safeProjectionFor(viewerUid: string, targetUid: string) {
  const viewer = await getEligibleMember(viewerUid);
  const target = await getEligibleMember(targetUid);
  if (!viewer || !target) return null;
  const result = calculateCompatibility(viewer.relationship, target.relationship);
  return {
    uid: targetUid,
    firstName: target.profile.firstName,
    age: target.profile.showAge ? target.profile.age : null,
    generalLocation: target.profile.showLocation ? target.profile.generalLocation : null,
    occupation: target.profile.showOccupation ? target.profile.occupation : null,
    relationshipIntent: target.profile.relationshipIntent,
    aboutMe: target.profile.aboutMe,
    authenticityScore: target.authenticity.score,
    authenticityLevel: target.authenticity.level,
    compatibilityScore: result.score,
    compatibilityLevel: result.level,
    strongestAlignments: result.strongestAlignments.map((x) => x.label),
    conversationPoints: result.conversationPoints.map((x) => x.label),
    isTestProfile: target.isTestProfile,
  } satisfies SafeDiscoveryProfile;
}
