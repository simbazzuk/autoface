import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { verificationMode } from "@/lib/server/verification-provider";

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

    const sessionRef = db.collection("verificationSessions").doc(body.sessionId);
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
        eventType: "identity_verification_cancelled",
        riskLevel: "info",
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ status: "cancelled" });
    }

    const providerReference = snap.data()?.providerReference ?? `demo_${body.sessionId}`;
    await adminDb.runTransaction(async (tx) => {
      tx.set(db.collection("identity").doc(user.uid), {
        identityVerified: true,
        livenessVerified: true,
        photoVerified: false,
        provider: "autoface-demo",
        providerReference,
        verificationAssurance: "development-simulation",
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(sessionRef, {
        status: "verified",
        completedChecks: ["identity", "liveness"],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "identity_verification_completed",
      riskLevel: "info",
      provider: "autoface-demo",
      assurance: "development-simulation",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ status: "verified", checks: ["identity", "liveness"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
