import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { createPhotoProviderSession } from "@/lib/server/photo-verification-provider";
import { verificationMode } from "@/lib/server/verification-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const db = adminDb;

    const identity = await db.collection("identity").doc(user.uid).get();
    if (!identity.exists || identity.data()?.identityVerified !== true || identity.data()?.livenessVerified !== true) {
      return NextResponse.json({ error: "IDENTITY_REQUIRED" }, { status: 409 });
    }
    if (identity.data()?.photoVerified === true) {
      return NextResponse.json({ status: "already_verified", redirectUrl: "/dashboard" });
    }

    const sessionId = randomUUID();
    const origin = new URL(request.url).origin;
    const provider = createPhotoProviderSession(origin, sessionId);

    await db.collection("photoVerificationSessions").doc(sessionId).set({
      uid: user.uid,
      status: "pending",
      mode: verificationMode(),
      provider: provider.provider,
      providerReference: provider.providerReference,
      requestedChecks: ["profile_photo_match"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("securityEvents").add({
      uid: user.uid,
      eventType: "photo_verification_started",
      riskLevel: "info",
      provider: provider.provider,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ redirectUrl: provider.redirectUrl, mode: verificationMode() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "PROVIDER_NOT_CONFIGURED" ? 501 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
