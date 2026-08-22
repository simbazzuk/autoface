import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { awsRekognitionRegion, createFaceLivenessSession } from "@/lib/server/aws-rekognition";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const photo = await adminDb.collection("profilePhotos").doc(user.uid).get();
    if (!photo.exists || photo.data()?.active !== true) {
      return NextResponse.json({ error: "PROFILE_PHOTO_REQUIRED" }, { status: 409 });
    }

    const existing = await adminDb.collection("identity").doc(user.uid).get();
    if (existing.data()?.faceVerified === true || existing.data()?.photoVerified === true) {
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
    });

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: "aws_face_verification_started",
      riskLevel: "info",
      provider: "aws-rekognition",
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
