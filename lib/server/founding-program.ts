import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/firebase-admin";

export const FOUNDER_LIMIT = 20;

export type FoundingProgrammeStatus = {
  founderLimit: number;
  foundersAwarded: number;
  founderPlacesRemaining: number;
  nextFounderNumber: number;
  founderProgrammeOpen: boolean;
};

type Eligibility = {
  eligible: boolean;
  checks: {
    accountVerified: boolean;
    profileComplete: boolean;
    atlasProfileComplete: boolean;
    profilePhotoPresent: boolean;
    faceVerificationComplete: boolean;
  };
};

const CONFIG_COLLECTION = "membershipConfig";
const CONFIG_DOC = "founding";

function asNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function existingFounderStats() {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const snap = await adminDb.collection("memberships")
    .where("plan", "==", "founding")
    .limit(200)
    .get();

  let maxNumber = 0;
  for (const doc of snap.docs) {
    maxNumber = Math.max(maxNumber, asNumber(doc.data()?.foundingMemberNumber, 0));
  }

  return {
    count: snap.size,
    nextNumber: Math.max(maxNumber + 1, snap.size + 1, 1),
  };
}

export async function foundingProgrammeStatus(): Promise<FoundingProgrammeStatus> {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const config = await adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
  if (!config.exists) {
    const existing = await existingFounderStats();
    const awarded = Math.min(existing.count, FOUNDER_LIMIT);
    return {
      founderLimit: FOUNDER_LIMIT,
      foundersAwarded: awarded,
      founderPlacesRemaining: Math.max(0, FOUNDER_LIMIT - awarded),
      nextFounderNumber: Math.max(existing.nextNumber, awarded + 1),
      founderProgrammeOpen: awarded < FOUNDER_LIMIT,
    };
  }

  const data = config.data() ?? {};
  const limit = Math.max(1, asNumber(data.founderLimit, FOUNDER_LIMIT));
  const awarded = Math.max(0, asNumber(data.foundersAwarded, 0));
  const nextNumber = Math.max(1, asNumber(data.nextFounderNumber, awarded + 1));
  const open = data.founderProgrammeOpen !== false && awarded < limit;

  return {
    founderLimit: limit,
    foundersAwarded: awarded,
    founderPlacesRemaining: Math.max(0, limit - awarded),
    nextFounderNumber: nextNumber,
    founderProgrammeOpen: open,
  };
}

export async function founderEligibility(uid: string): Promise<Eligibility> {
  if (!adminDb || !adminAuth) throw new Error("SERVER_NOT_CONFIGURED");

  const [account, profile, atlas, photo, identity] = await Promise.all([
    adminAuth.getUser(uid),
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
    adminDb.collection("profilePhotos").doc(uid).get(),
    adminDb.collection("identity").doc(uid).get(),
  ]);

  const identityData = identity.data() ?? {};
  const checks = {
    accountVerified: account.emailVerified === true,
    profileComplete: profile.exists,
    atlasProfileComplete: atlas.exists,
    profilePhotoPresent: photo.exists && photo.data()?.active === true,
    faceVerificationComplete:
      identity.exists &&
      identityData.identityVerified === true &&
      identityData.livenessVerified === true &&
      (identityData.photoVerified === true || identityData.faceVerified === true),
  };

  return {
    eligible: Object.values(checks).every(Boolean),
    checks,
  };
}

export async function ensureFoundingMembership(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const membershipRef = adminDb.collection("memberships").doc(uid);
  const existingMembership = await membershipRef.get();
  const existingPlan = String(existingMembership.data()?.plan ?? "free");

  // Founder is permanent once awarded. Paid membership is never silently
  // changed into Founder by this programme.
  if (existingPlan === "founding" || existingPlan === "plus") {
    return {
      awarded: false,
      alreadyFounder: existingPlan === "founding",
      membership: existingMembership.data() ?? null,
      programme: await foundingProgrammeStatus(),
      eligibility: await founderEligibility(uid),
    };
  }

  const eligibility = await founderEligibility(uid);
  if (!eligibility.eligible) {
    return {
      awarded: false,
      alreadyFounder: false,
      membership: existingMembership.data() ?? null,
      programme: await foundingProgrammeStatus(),
      eligibility,
    };
  }

  const bootstrap = await existingFounderStats();
  const configRef = adminDb.collection(CONFIG_COLLECTION).doc(CONFIG_DOC);

  const result = await adminDb.runTransaction(async (transaction) => {
    const [configSnap, membershipSnap] = await Promise.all([
      transaction.get(configRef),
      transaction.get(membershipRef),
    ]);

    const currentPlan = String(membershipSnap.data()?.plan ?? "free");
    if (currentPlan === "founding" || currentPlan === "plus") {
      return {
        awarded: false,
        alreadyFounder: currentPlan === "founding",
        founderNumber: asNumber(membershipSnap.data()?.foundingMemberNumber, 0) || null,
      };
    }

    const configData = configSnap.data() ?? {};
    const limit = configSnap.exists
      ? Math.max(1, asNumber(configData.founderLimit, FOUNDER_LIMIT))
      : FOUNDER_LIMIT;
    const awarded = configSnap.exists
      ? Math.max(0, asNumber(configData.foundersAwarded, 0))
      : Math.min(bootstrap.count, limit);
    const nextNumber = configSnap.exists
      ? Math.max(1, asNumber(configData.nextFounderNumber, awarded + 1))
      : Math.max(bootstrap.nextNumber, awarded + 1);

    if (configData.founderProgrammeOpen === false || awarded >= limit) {
      if (!configSnap.exists) {
        transaction.set(configRef, {
          founderLimit: limit,
          foundersAwarded: awarded,
          nextFounderNumber: nextNumber,
          founderProgrammeOpen: false,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return { awarded: false, alreadyFounder: false, founderNumber: null };
    }

    const founderNumber = nextNumber;
    const now = FieldValue.serverTimestamp();

    transaction.set(membershipRef, {
      uid,
      plan: "founding",
      status: "active",
      foundingMemberNumber: founderNumber,
      foundingAwardedAt: now,
      foundingAwardMethod: "first_verified_members",
      updatedAt: now,
      createdAt: membershipSnap.exists
        ? membershipSnap.data()?.createdAt ?? now
        : now,
    }, { merge: true });

    const newAwarded = awarded + 1;
    transaction.set(configRef, {
      founderLimit: limit,
      foundersAwarded: newAwarded,
      nextFounderNumber: founderNumber + 1,
      founderProgrammeOpen: newAwarded < limit,
      updatedAt: now,
      createdAt: configSnap.exists
        ? configData.createdAt ?? now
        : now,
    }, { merge: true });

    return { awarded: true, alreadyFounder: false, founderNumber };
  });

  return {
    ...result,
    membership: (await membershipRef.get()).data() ?? null,
    programme: await foundingProgrammeStatus(),
    eligibility,
  };
}
