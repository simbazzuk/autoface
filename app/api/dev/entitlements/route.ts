import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const seedUids = [
  "demo-sikh-harpreet",
  "demo-sikh-simran",
  "demo-sikh-jaspreet",
  "demo-sikh-priya",
  "demo-sikh-gurpreet",
  "demo-sikh-navdeep",
  "demo-sikh-aman",
  "demo-sikh-kiran",
];

function assertDevelopment() {
  if (process.env.NODE_ENV === "production") throw new Error("DEVELOPMENT_ONLY");
}

async function requireDevelopmentUser(request: Request) {
  assertDevelopment();
  const user = await requireUser(request);
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  await adminDb.collection("demoProfiles").doc(user.uid).set({
    uid: user.uid,
    isTestProfile: true,
    developmentAccount: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return user;
}

async function seedAvailability() {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const snaps = await Promise.all(seedUids.map((uid) => adminDb!.collection("profiles").doc(uid).get()));
  return snaps.filter((snap) => snap.exists).length;
}

async function harnessStatus(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const membership = await adminDb.collection("memberships").doc(uid).get();
  const plan = String(membership.data()?.plan ?? "free");

  const interests = await adminDb.collection("interests").where("fromUid", "==", uid).get();
  const harnessInterests = interests.docs.filter((doc) => doc.data()?.entitlementHarness === true);

  const matches = await adminDb.collection("matches").where("participants", "array-contains", uid).get();
  const harnessMatches = matches.docs.filter((doc) => doc.data()?.entitlementHarness === true && doc.data()?.status === "mutual");

  return {
    plan: plan === "founding" ? "founding" : "free",
    seededProfiles: await seedAvailability(),
    reviewedItems: harnessInterests.length,
    mutualIntroductions: harnessMatches.length,
    testDataReady: harnessInterests.length >= 5 && harnessMatches.length >= 1,
  };
}

async function setPlan(uid: string, plan: "free" | "founding") {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const now = FieldValue.serverTimestamp();
  await adminDb.collection("memberships").doc(uid).set({
    uid,
    plan,
    status: "active",
    foundingMemberNumber: plan === "founding" ? 1 : null,
    activatedAt: plan === "founding" ? now : null,
    developmentHarness: true,
    updatedAt: now,
  }, { merge: true });
}

async function ensureCurrentAccountReady(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const [profile, relationship] = await Promise.all([
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
  ]);

  if (!profile.exists) throw new Error("PROFILE_REQUIRED");
  if (!relationship.exists) throw new Error("ATLAS_PROFILE_REQUIRED");

  const batch = adminDb.batch();
  batch.set(adminDb.collection("profiles").doc(uid), {
    visibility: "future_matches",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(adminDb.collection("relationshipProfiles").doc(uid), {
    consentForCompatibility: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(adminDb.collection("identity").doc(uid), {
    identityVerified: true,
    livenessVerified: true,
    developmentEntitlementHarness: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

async function clearHarnessData(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  for (const targetUid of seedUids) {
    const interestIds = [`${uid}_${targetUid}`, `${targetUid}_${uid}`];
    for (const id of interestIds) {
      const ref = adminDb.collection("interests").doc(id);
      const snap = await ref.get();
      if (snap.exists && snap.data()?.entitlementHarness === true) await ref.delete();
    }

    const matchId = [uid, targetUid].sort().join("__");
    const matchRef = adminDb.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    if (matchSnap.exists && matchSnap.data()?.entitlementHarness === true) {
      const conversationRef = adminDb.collection("conversations").doc(matchId);
      const messages = await conversationRef.collection("messages").limit(500).get();
      if (!messages.empty) {
        const batch = adminDb.batch();
        messages.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      await Promise.all([
        conversationRef.delete().catch(() => {}),
        adminDb.collection("connections").doc(matchId).delete().catch(() => {}),
        matchRef.delete().catch(() => {}),
      ]);
    }
  }
}

async function createHarnessData(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

  const seeded = await seedAvailability();
  if (seeded < seedUids.length) throw new Error("SEED_COMMUNITY_REQUIRED");

  await ensureCurrentAccountReady(uid);
  await clearHarnessData(uid);

  const now = FieldValue.serverTimestamp();
  const mutualTarget = seedUids[0];
  const reviewedTargets = seedUids.slice(1, 5);
  const participants = [uid, mutualTarget].sort();
  const matchId = participants.join("__");
  const batch = adminDb.batch();

  // One mutual introduction. This also counts as a reviewed Interested item.
  batch.set(adminDb.collection("interests").doc(`${uid}_${mutualTarget}`), {
    fromUid: uid,
    toUid: mutualTarget,
    status: "interested",
    entitlementHarness: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(adminDb.collection("interests").doc(`${mutualTarget}_${uid}`), {
    fromUid: mutualTarget,
    toUid: uid,
    status: "interested",
    entitlementHarness: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(adminDb.collection("matches").doc(matchId), {
    participants,
    status: "mutual",
    entitlementHarness: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(adminDb.collection("connections").doc(matchId), {
    matchId,
    participants,
    stages: {
      [uid]: "introduced",
      [mutualTarget]: "introduced",
    },
    entitlementHarness: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(adminDb.collection("conversations").doc(matchId), {
    matchId,
    participants,
    status: "active",
    entitlementHarness: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  // Four non-mutual reviewed recommendations. Alongside the mutual one this
  // creates five history items: Free shows 3, Founding shows all 5.
  const states = ["saved", "pass", "interested", "saved"] as const;
  reviewedTargets.forEach((targetUid, index) => {
    batch.set(adminDb!.collection("interests").doc(`${uid}_${targetUid}`), {
      fromUid: uid,
      toUid: targetUid,
      status: states[index],
      entitlementHarness: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  });

  await batch.commit();

  return {
    mutualTarget,
    reviewedItems: 5,
    freshDiscoveryProfiles: 3,
    notice: "Created one mutual introduction plus five reviewed recommendation records. Use Reset reviewed profiles after history testing to preserve the mutual introduction and restore fresh Discovery candidates.",
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireDevelopmentUser(request);
    return NextResponse.json(await harnessStatus(user.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "DEVELOPMENT_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireDevelopmentUser(request);
    const body = await request.json().catch(() => ({})) as {
      action?: "set_free" | "set_founding" | "create_test_data" | "reset_test_data";
    };

    if (body.action === "set_free") {
      await setPlan(user.uid, "free");
      return NextResponse.json({ ok: true, message: "This test account is now Free.", ...(await harnessStatus(user.uid)) });
    }

    if (body.action === "set_founding") {
      await setPlan(user.uid, "founding");
      return NextResponse.json({ ok: true, message: "This test account is now a Founding Member.", ...(await harnessStatus(user.uid)) });
    }

    if (body.action === "create_test_data") {
      const created = await createHarnessData(user.uid);
      return NextResponse.json({ ok: true, message: "Entitlement test data created.", created, ...(await harnessStatus(user.uid)) });
    }

    if (body.action === "reset_test_data") {
      await clearHarnessData(user.uid);
      await setPlan(user.uid, "free");
      return NextResponse.json({ ok: true, message: "Entitlement test data cleared and this account returned to Free.", ...(await harnessStatus(user.uid)) });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "UNAUTHENTICATED" ? 401 :
      message === "DEVELOPMENT_ONLY" ? 403 :
      ["PROFILE_REQUIRED", "ATLAS_PROFILE_REQUIRED", "SEED_COMMUNITY_REQUIRED"].includes(message) ? 409 :
      500;
    return NextResponse.json({ error: message }, { status });
  }
}
