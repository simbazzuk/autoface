import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { compareFaceImages, getFaceLivenessResult } from "@/lib/server/aws-rekognition";
import { getProfilePhotoBytes } from "@/lib/server/profile-photo-bytes";

export const runtime = "nodejs";

const livenessThreshold = Number(process.env.AUTOFACE_FACE_LIVENESS_THRESHOLD || "90");
const matchThreshold = Number(process.env.AUTOFACE_FACE_MATCH_THRESHOLD || "90");

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 400 });

    const sessionRef = adminDb.collection("faceVerificationSessions").doc(sessionId);
    const session = await sessionRef.get();
    if (!session.exists || session.data()?.uid !== user.uid) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    const liveness = await getFaceLivenessResult(sessionId);
    const confidence = Number(liveness.Confidence ?? 0);
    const completed = liveness.Status === "SUCCEEDED";
    const referenceBytes = liveness.ReferenceImage?.Bytes;

    if (!completed) {
      await sessionRef.set({ status: String(liveness.Status ?? "failed").toLowerCase(), livenessConfidence: confidence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ verified: false, status: liveness.Status ?? "FAILED", livenessConfidence: confidence });
    }

    if (confidence < livenessThreshold || !referenceBytes?.length) {
      await sessionRef.set({ status: "liveness_failed", livenessConfidence: confidence, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ verified: false, status: "LIVENESS_FAILED", livenessConfidence: confidence });
    }

    const profileBytes = await getProfilePhotoBytes(user.uid);
    const currentPhotoSha256 = createHash("sha256").update(profileBytes).digest("hex");
    const sessionPhotoSha256 = String(session.data()?.profilePhotoSha256 ?? "");
    if (!sessionPhotoSha256 || currentPhotoSha256 !== sessionPhotoSha256) {
      await sessionRef.set({
        status: "profile_photo_changed",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({
        verified: false,
        status: "PROFILE_PHOTO_CHANGED",
        error: "PROFILE_PHOTO_CHANGED",
      }, { status: 409 });
    }

    const comparison = await compareFaceImages(profileBytes, referenceBytes);
    const similarity = Math.max(0, ...(comparison.FaceMatches ?? []).map((match) => Number(match.Similarity ?? 0)));
    const verified = similarity >= matchThreshold;

    await sessionRef.set({
      status: verified ? "verified" : "face_match_failed",
      livenessConfidence: confidence,
      faceSimilarity: similarity,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (verified) {
      await adminDb.collection("identity").doc(user.uid).set({
        faceVerified: true,
        photoVerified: true,
        livenessVerified: true,
        faceVerificationProvider: "aws-rekognition",
        faceVerifiedAt: FieldValue.serverTimestamp(),
        photoVerifiedAt: FieldValue.serverTimestamp(),
        livenessVerifiedAt: FieldValue.serverTimestamp(),
        verifiedPhotoSha256: currentPhotoSha256,
        verifiedPhotoVersion: Number(session.data()?.profilePhotoVersion ?? 1),
        faceVerificationInvalidatedAt: null,
        faceVerificationInvalidationReason: null,
      }, { merge: true });
    }

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: verified ? "aws_face_verification_completed" : "aws_face_verification_failed",
      riskLevel: verified ? "info" : "low",
      provider: "aws-rekognition",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      verified,
      status: verified ? "VERIFIED" : "FACE_MATCH_FAILED",
      livenessConfidence: confidence,
      faceSimilarity: similarity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message === "PROFILE_PHOTO_REQUIRED" ? 409
      : message === "AWS_REKOGNITION_NOT_CONFIGURED" ? 503
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
