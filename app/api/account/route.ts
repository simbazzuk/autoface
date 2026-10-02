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
        emailIntroductions: notificationPrefsSnap.data()?.emailIntroductions !== false,
        emailMessages: notificationPrefsSnap.data()?.emailMessages === true,
        emailConnectionUpdates: notificationPrefsSnap.data()?.emailConnectionUpdates === true,
        emailVerificationUpdates: notificationPrefsSnap.data()?.emailVerificationUpdates !== false,
        emailSafetyUpdates: true,
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
      profile?: {
        firstName?: string;
        preferredName?: string;
        age?: number;
        generalLocation?: string;
        occupation?: string;
        aboutMe?: string;
      };
      discoveryEnabled?: boolean;
      showAge?: boolean;
      showLocation?: boolean;
      showOccupation?: boolean;
      notificationPreferences?: {
        introductions?: boolean;
        messages?: boolean;
        connectionUpdates?: boolean;
        verificationUpdates?: boolean;
        emailIntroductions?: boolean;
        emailMessages?: boolean;
        emailConnectionUpdates?: boolean;
        emailVerificationUpdates?: boolean;
      };
    };

    const hasProfileChange =
      body.profile &&
      typeof body.profile === "object";

    const hasDiscoveryChange = typeof body.discoveryEnabled === "boolean";

    // An authenticated account may manage its profile while unverified,
    // but it must not become discoverable until the email address is verified.
    if (
      body.discoveryEnabled === true &&
      user.email_verified !== true
    ) {
      return NextResponse.json(
        { error: "EMAIL_VERIFICATION_REQUIRED" },
        { status: 403 }
      );
    }

    const hasVisibilityChange = [body.showAge, body.showLocation, body.showOccupation].some((value) => typeof value === "boolean");
    const hasNotificationChange = body.notificationPreferences && typeof body.notificationPreferences === "object";

    if (!hasProfileChange && !hasDiscoveryChange && !hasVisibilityChange && !hasNotificationChange) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }

    if (hasProfileChange) {
      const profile = body.profile ?? {};

      const firstName =
        typeof profile.firstName === "string"
          ? profile.firstName.trim()
          : "";

      const preferredName =
        typeof profile.preferredName === "string"
          ? profile.preferredName.trim()
          : "";

      const generalLocation =
        typeof profile.generalLocation === "string"
          ? profile.generalLocation.trim()
          : "";

      const occupation =
        typeof profile.occupation === "string"
          ? profile.occupation.trim()
          : "";

      const aboutMe =
        typeof profile.aboutMe === "string"
          ? profile.aboutMe.trim()
          : "";

      const age = Number(profile.age);

      if (
        !firstName ||
        !generalLocation ||
        !aboutMe ||
        !Number.isInteger(age) ||
        age < 18 ||
        age > 100
      ) {
        return NextResponse.json(
          { error: "INVALID_PROFILE" },
          { status: 400 }
        );
      }

      const ref = adminDb.collection("profiles").doc(user.uid);
      const existing = await ref.get();

      const updates: Record<string, unknown> = {
        uid: user.uid,
        firstName,
        preferredName,
        age,
        generalLocation,
        occupation,
        aboutMe,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!existing.exists) {
        updates.visibility = "private";
        updates.showAge = true;
        updates.showLocation = true;
        updates.showOccupation = true;
        updates.createdAt = FieldValue.serverTimestamp();
      }

      await ref.set(updates, { merge: true });
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
        if (![
          "introductions",
          "messages",
          "connectionUpdates",
          "verificationUpdates",
          "emailIntroductions",
          "emailMessages",
          "emailConnectionUpdates",
          "emailVerificationUpdates",
        ].includes(key)) continue;
        if (typeof value === "boolean") notificationUpdates[key] = value;
      }

      await adminDb.collection("notificationPreferences").doc(user.uid).set(notificationUpdates, { merge: true });
    }

    await adminDb.collection("securityEvents").add({
      uid: user.uid,
      eventType: hasProfileChange
        ? "profile_updated"
        : hasDiscoveryChange
        ? body.discoveryEnabled ? "discovery_enabled" : "discovery_disabled"
        : hasVisibilityChange
          ? "profile_visibility_preferences_updated"
          : "notification_preferences_updated",
      riskLevel: "info",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      profileUpdated: Boolean(hasProfileChange),
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
