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

    const [profileSnap, relationshipSnap, identitySnap, preferencesSnap, notificationPrefsSnap] = await Promise.all([
      adminDb.collection("profiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("identity").doc(user.uid).get(),
      adminDb.collection("discoveryPreferences").doc(user.uid).get(),
      adminDb.collection("notificationPreferences").doc(user.uid).get(),
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
      notificationPreferences: {
        introductions: notificationPrefsSnap.data()?.introductions !== false,
        messages: notificationPrefsSnap.data()?.messages !== false,
        connectionUpdates: notificationPrefsSnap.data()?.connectionUpdates !== false,
        verificationUpdates: notificationPrefsSnap.data()?.verificationUpdates !== false,
        safetyUpdates: true,
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

    const body = await request.json() as {
      discoveryEnabled?: boolean;
      showAge?: boolean;
      showLocation?: boolean;
      showOccupation?: boolean;
      notificationPreferences?: {
        introductions?: boolean;
        messages?: boolean;
        connectionUpdates?: boolean;
        verificationUpdates?: boolean;
      };
    };

    const hasDiscoveryChange = typeof body.discoveryEnabled === "boolean";
    const hasVisibilityChange = [body.showAge, body.showLocation, body.showOccupation].some((value) => typeof value === "boolean");
    const hasNotificationChange = body.notificationPreferences && typeof body.notificationPreferences === "object";

    if (!hasDiscoveryChange && !hasVisibilityChange && !hasNotificationChange) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    if (hasDiscoveryChange || hasVisibilityChange) {
      const ref = adminDb.collection("profiles").doc(user.uid);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ error: "PROFILE_REQUIRED" }, { status: 409 });
      }

      const updates: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (typeof body.discoveryEnabled === "boolean") {
        updates.visibility = body.discoveryEnabled ? "future_matches" : "private";
      }
      if (typeof body.showAge === "boolean") updates.showAge = body.showAge;
      if (typeof body.showLocation === "boolean") updates.showLocation = body.showLocation;
      if (typeof body.showOccupation === "boolean") updates.showOccupation = body.showOccupation;

      await ref.update(updates);
    }

    if (hasNotificationChange) {
      const allowed = body.notificationPreferences ?? {};
      const notificationUpdates: Record<string, unknown> = {
        uid: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
      for (const [key, value] of Object.entries(allowed)) {
        if (!["introductions", "messages", "connectionUpdates", "verificationUpdates"].includes(key)) continue;
        if (typeof value === "boolean") notificationUpdates[key] = value;
      }

      await adminDb.collection("notificationPreferences").doc(user.uid).set(notificationUpdates, { merge: true });
    }

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: hasDiscoveryChange
        ? body.discoveryEnabled ? "discovery_enabled" : "discovery_disabled"
        : hasVisibilityChange
          ? "profile_visibility_preferences_updated"
          : "notification_preferences_updated",
      riskLevel: "info",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      discoveryEnabled: body.discoveryEnabled,
      showAge: body.showAge,
      showLocation: body.showLocation,
      showOccupation: body.showOccupation,
      notificationPreferences: body.notificationPreferences,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
