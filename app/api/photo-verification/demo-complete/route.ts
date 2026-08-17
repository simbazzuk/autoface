import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { verificationMode } from "@/lib/server/verification-provider";
import { createNotification } from "@/lib/server/notifications";

export const runtime = "nodejs";

type Body = { sessionId?: string; outcome?: "verified" | "cancelled" };

export async function POST(request: Request) {
  try {
    if (verificationMode() !== "demo") {
      return NextResponse.json({ error: "DEMO_DISABLED" }, { status: 403 });
    }

    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const db = adminDb;
    const body = (await request.json()) as Body;

    if (!body.sessionId || !body.outcome) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const sessionRef = db.collection("photoVerificationSessions").doc(body.sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists || snap.data()?.uid !== user.uid) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    if (snap.data()?.status !== "pending") {
      return NextResponse.json({ error: "SESSION_ALREADY_COMPLETED" }, { status: 409 });
    }

    if (body.outcome === "cancelled") {
      await sessionRef.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
      await db.collection("securityEvents").add({
        uid: user.uid,
        eventType: "photo_verification_cancelled",
        riskLevel: "info",
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ status: "cancelled" });
    }

    const identityRef = db.collection("identity").doc(user.uid);
    await db.runTransaction(async (tx) => {
      const identity = await tx.get(identityRef);
      if (!identity.exists || identity.data()?.identityVerified !== true || identity.data()?.livenessVerified !== true) {
        throw new Error("IDENTITY_REQUIRED");
      }

      tx.set(identityRef, {
        photoVerified: true,
        photoVerificationProvider: "autoface-demo-photo",
        photoVerificationReference: snap.data()?.providerReference ?? `photo_demo_${body.sessionId}`,
        photoVerificationAssurance: "development-simulation",
        photoVerifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.update(sessionRef, {
        status: "verified",
        completedChecks: ["profile_photo_match"],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await db.collection("securityEvents").add({
      uid: user.uid,
      eventType: "photo_verification_completed",
      riskLevel: "info",
      provider: "autoface-demo-photo",
      assurance: "development-simulation",
      createdAt: FieldValue.serverTimestamp(),
    });
    await createNotification({
      recipientUid: user.uid,
      type: "verification",
      title: "Profile photo verified",
      body: "Your photo-verification signal is complete and your authenticity score can now reflect it.",
      actionUrl: "/dashboard",
    });

    return NextResponse.json({ status: "verified", checks: ["profile_photo_match"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "IDENTITY_REQUIRED" ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
