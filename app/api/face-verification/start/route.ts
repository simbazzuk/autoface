import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { awsRekognitionRegion, createFaceLivenessSession } from "@/lib/server/aws-rekognition";
import { getProfilePhotoBytes } from "@/lib/server/profile-photo-bytes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json().catch(() => ({}));
    if (body.biometricConsent !== true) {
      return NextResponse.json({ error: "BIOMETRIC_CONSENT_REQUIRED" }, { status: 400 });
    }
    const consentVersion = typeof body.consentVersion === "string" ? body.consentVersion : "2026-08-v1";

    const photo = await adminDb.collection("profilePhotos").doc(user.uid).get();
    if (!photo.exists || photo.data()?.active !== true) {
      return NextResponse.json({ error: "PROFILE_PHOTO_REQUIRED" }, { status: 409 });
    }

    const profileBytes = await getProfilePhotoBytes(user.uid);
    const photoSha256 = createHash("sha256").update(profileBytes).digest("hex");
    const photoVersion = Number(photo.data()?.photoVersion ?? 1);
    if (!photo.data()?.sha256 || photo.data()?.sha256 !== photoSha256) {
      await photo.ref.set({ sha256: photoSha256, photoVersion }, { merge: true });
    }

    const existing = await adminDb.collection("identity").doc(user.uid).get();
    const existingData = existing.data() ?? {};
    const alreadyVerified = (existingData.faceVerified === true || existingData.photoVerified === true)
      && String(existingData.verifiedPhotoSha256 ?? "") === photoSha256;
    if (alreadyVerified) {
      return NextResponse.json({ status: "already_verified" });
    }

    const sessionId = await createFaceLivenessSession();
    await adminDb.collection("faceVerificationSessions").doc(sessionId).set({
      uid: user.uid,
      provider: "aws-rekognition",
      status: "pending",
      region: awsRekognitionRegion,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      biometricConsent: true,
      biometricConsentVersion: consentVersion,
      biometricConsentAt: FieldValue.serverTimestamp(),
      profilePhotoSha256: photoSha256,
      profilePhotoVersion: photoVersion,
    });

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "aws_face_verification_started",
      riskLevel: "info",
      provider: "aws-rekognition",
      consentVersion,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ sessionId, region: awsRekognitionRegion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "AWS_REKOGNITION_NOT_CONFIGURED" ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
