import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { createProviderSession, verificationMode } from "@/lib/server/verification-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const sessionId = randomUUID();
    const origin = new URL(request.url).origin;
    const provider = createProviderSession(origin, sessionId);

    await adminDb.collection("verificationSessions").doc(sessionId).set({
      uid: user.uid,
      status: "pending",
      mode: verificationMode(),
      provider: provider.provider,
      providerReference: provider.providerReference,
      requestedChecks: ["identity", "liveness"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "identity_verification_started",
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
