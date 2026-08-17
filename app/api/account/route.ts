import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

function asIso(value: unknown) {
  const v = value as { toDate?: () => Date } | null | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const [profileSnap, relationshipSnap, identitySnap, preferencesSnap] = await Promise.all([
      adminDb.collection("profiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("identity").doc(user.uid).get(),
      adminDb.collection("discoveryPreferences").doc(user.uid).get(),
    ]);

    const profile = profileSnap.data() ?? {};
    const identity = identitySnap.data() ?? {};

    return NextResponse.json({
      account: {
        uid: user.uid,
        email: user.email ?? "",
        emailVerified: Boolean(user.email_verified),
      },
      privacy: {
        discoveryEnabled: profile.visibility === "future_matches",
        showAge: profile.showAge !== false,
        showLocation: profile.showLocation !== false,
        showOccupation: profile.showOccupation !== false,
        compatibilityConsent: relationshipSnap.data()?.consentForCompatibility === true,
      },
      verification: {
        identityVerified: identity.identityVerified === true,
        livenessVerified: identity.livenessVerified === true,
        photoVerified: identity.photoVerified === true,
        photoVerifiedAt: asIso(identity.photoVerifiedAt),
      },
      hasDiscoveryPreferences: preferencesSnap.exists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as { discoveryEnabled?: boolean };
    if (typeof body.discoveryEnabled !== "boolean") {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    const ref = adminDb.collection("profiles").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });
    }

    await ref.update({
      visibility: body.discoveryEnabled ? "future_matches" : "private",
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: body.discoveryEnabled ? "discovery_enabled" : "discovery_disabled",
      riskLevel: "info",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      discoveryEnabled: body.discoveryEnabled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
