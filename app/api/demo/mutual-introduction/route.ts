import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { safeProjectionFor } from "@/lib/server/discovery";
import { createNotification } from "@/lib/server/notifications";

export const runtime = "nodejs";

async function requireDemoUser(uid: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const snap = await adminDb.collection("demoProfiles").doc(uid).get();
  if (!snap.exists || snap.data()?.isTestProfile !== true) throw new Error("TEST_PROFILE_REQUIRED");
}

async function isBlocked(a: string, b: string) {
  if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
  const [ab, ba] = await Promise.all([
    adminDb.collection("blocks").doc(`${a}__${b}`).get(),
    adminDb.collection("blocks").doc(`${b}__${a}`).get(),
  ]);
  return ab.exists || ba.exists;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    await requireDemoUser(user.uid);

    const demoSnap = await adminDb.collection("demoProfiles").where("isTestProfile", "==", true).limit(50).get();
    const candidates: Array<{
      uid: string;
      firstName: string;
      age: number | null;
      generalLocation: string | null;
      compatibilityScore: number;
      targetAiOptIn: boolean;
      blocked: boolean;
      existingMutual: boolean;
      state: "ready" | "blocked" | "mutual";
    }> = [];

    for (const doc of demoSnap.docs) {
      const uid = doc.id;
      if (uid === user.uid) continue;

      const projection = await safeProjectionFor(user.uid, uid);
      if (!projection) continue;

      const relationshipSnap = await adminDb.collection("relationshipProfiles").doc(uid).get();
      const participants = [user.uid, uid].sort();
      const matchSnap = await adminDb.collection("matches").doc(participants.join("__")).get();

      const blocked = await isBlocked(user.uid, uid);
      const existingMutual = matchSnap.exists && matchSnap.data()?.status === "mutual";
      candidates.push({
        uid,
        firstName: projection.firstName,
        age: projection.age,
        generalLocation: projection.generalLocation,
        compatibilityScore: projection.compatibilityScore,
        targetAiOptIn: relationshipSnap.data()?.consentForAiDiscovery === true,
        blocked,
        existingMutual,
        state: blocked ? "blocked" : existingMutual ? "mutual" : "ready",
      });
    }

    candidates.sort((a,b) => b.compatibilityScore - a.compatibilityScore);
    return NextResponse.json({ candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "TEST_PROFILE_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    await requireDemoUser(user.uid);

    const body = await request.json() as { targetUid?: string; action?: "clear_block" };
    const targetUid = body.targetUid?.trim() ?? "";
    if (!targetUid || targetUid === user.uid || body.action !== "clear_block") {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    await requireDemoUser(targetUid);

    const participants = [user.uid, targetUid].sort();
    const matchId = participants.join("__");

    const [forwardBlock, reverseBlock] = await Promise.all([
      adminDb.collection("blocks").doc(`${user.uid}__${targetUid}`).get(),
      adminDb.collection("blocks").doc(`${targetUid}__${user.uid}`).get(),
    ]);

    const batch = adminDb.batch();
    let removed = 0;

    if (forwardBlock.exists) {
      batch.delete(forwardBlock.ref);
      removed += 1;
    }
    if (reverseBlock.exists) {
      batch.delete(reverseBlock.ref);
      removed += 1;
    }

    // Reset only the demo pair's blocked shell. This does not recreate a match;
    // the tester must explicitly press Create mutual introduction afterwards.
    const matchRef = adminDb.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    if (matchSnap.exists && matchSnap.data()?.status === "blocked") {
      batch.set(matchRef, {
        status: "unmatched",
        demoBlockCleared: true,
        endedBy: null,
        endedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const conversationRef = adminDb.collection("conversations").doc(matchId);
    const conversationSnap = await conversationRef.get();
    if (conversationSnap.exists && String(conversationSnap.data()?.closedReason ?? "").includes("blocked")) {
      batch.set(conversationRef, {
        status: "closed",
        closedReason: "demo_block_cleared",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    batch.set(adminDb.collection("securityEvents").doc(), {
      uid: user.uid,
      eventType: "demo_pair_block_cleared",
      matchId,
      targetUid,
      removedBlockDocuments: removed,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      removed,
      notice: removed > 0
        ? "Demo block cleared. You can now explicitly create a new mutual introduction."
        : "No block documents were present for this demo pair.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "TEST_PROFILE_REQUIRED" ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    await requireDemoUser(user.uid);

    const body = await request.json() as { targetUid?: string; enableTargetAi?: boolean };
    const targetUid = body.targetUid?.trim() ?? "";
    if (!targetUid || targetUid === user.uid) return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });

    await requireDemoUser(targetUid);

    const [viewerProjection, targetProjection] = await Promise.all([
      safeProjectionFor(targetUid, user.uid),
      safeProjectionFor(user.uid, targetUid),
    ]);
    if (!viewerProjection || !targetProjection) {
      return NextResponse.json({ error: "DEMO_TARGET_NOT_ELIGIBLE" }, { status: 409 });
    }
    if (await isBlocked(user.uid, targetUid)) {
      return NextResponse.json({ error: "DEMO_MATCH_BLOCKED" }, { status: 409 });
    }

    const participants = [user.uid, targetUid].sort();
    const matchId = participants.join("__");
    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();

    batch.set(adminDb.collection("interests").doc(`${user.uid}_${targetUid}`), {
      fromUid: user.uid,
      toUid: targetUid,
      status: "interested",
      createdAt: now,
      updatedAt: now,
      demoHarness: true,
    }, { merge: true });

    batch.set(adminDb.collection("interests").doc(`${targetUid}_${user.uid}`), {
      fromUid: targetUid,
      toUid: user.uid,
      status: "interested",
      createdAt: now,
      updatedAt: now,
      demoHarness: true,
    }, { merge: true });

    batch.set(adminDb.collection("matches").doc(matchId), {
      participants,
      status: "mutual",
      demoHarness: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    batch.set(adminDb.collection("connections").doc(matchId), {
      matchId,
      participants,
      stages: {
        [user.uid]: "introduced",
        [targetUid]: "introduced",
      },
      demoHarness: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    batch.set(adminDb.collection("conversations").doc(matchId), {
      matchId,
      participants,
      status: "active",
      demoHarness: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    if (body.enableTargetAi === true) {
      batch.set(adminDb.collection("relationshipProfiles").doc(targetUid), {
        consentForAiDiscovery: true,
        updatedAt: now,
      }, { merge: true });
    }

    batch.set(adminDb.collection("securityEvents").doc(), {
      uid: user.uid,
      eventType: "demo_mutual_introduction_created",
      matchId,
      targetUid,
      enabledTargetAi: body.enableTargetAi === true,
      createdAt: now,
    });

    await batch.commit();

    await Promise.all([
      createNotification({
        recipientUid: user.uid,
        type: "introduction",
        title: `Demo introduction with ${targetProjection.firstName}`,
        body: "A mutual introduction was created by the test-profile demo harness.",
        actionUrl: `/connections/${matchId}`,
        actorUid: targetUid,
        matchId,
      }),
      createNotification({
        recipientUid: targetUid,
        type: "introduction",
        title: `Demo introduction with ${viewerProjection.firstName}`,
        body: "A mutual introduction was created by the test-profile demo harness.",
        actionUrl: `/connections/${matchId}`,
        actorUid: user.uid,
        matchId,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      matchId,
      target: {
        uid: targetUid,
        firstName: targetProjection.firstName,
      },
      targetAiEnabled: body.enableTargetAi === true,
      connectionUrl: `/connections/${matchId}`,
      messageUrl: `/messages/${matchId}`,
      notice: "Demo mutual introduction created. Production users cannot access this test harness.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "TEST_PROFILE_REQUIRED" ? 403
      : message.includes("BLOCKED") || message.includes("NOT_ELIGIBLE") ? 409
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
