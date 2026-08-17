import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const [profileSnap, relationshipSnap, identitySnap, preferencesSnap, matchSnap] = await Promise.all([
      adminDb.collection("profiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("identity").doc(user.uid).get(),
      adminDb.collection("discoveryPreferences").doc(user.uid).get(),
      adminDb.collection("matches").where("participants", "array-contains", user.uid).limit(100).get(),
    ]);

    const profile = profileSnap.data() ?? {};
    const relationship = relationshipSnap.data() ?? {};
    const identity = identitySnap.data() ?? {};

    const authenticity = calculateAuthenticity({
      emailVerified: Boolean(user.email_verified),
      phoneVerified: Boolean(user.phone_number),
      mfaEnabled: false,
      identityVerified: identity.identityVerified === true,
      livenessVerified: identity.livenessVerified === true,
      photoVerified: identity.photoVerified === true,
    });

    const steps = [
      {
        id: "profile",
        title: "Create your profile",
        description: "Add the essentials other people may see.",
        complete: profileSnap.exists && Boolean(profile.firstName) && Boolean(profile.aboutMe),
        href: "/profile",
      },
      {
        id: "atlas",
        title: "Complete your Atlas profile",
        description: "Set the relationship preferences used by deterministic compatibility.",
        complete: relationshipSnap.exists && relationship.consentForCompatibility === true,
        href: "/relationship-profile",
      },
      {
        id: "authenticity",
        title: "Build authenticity",
        description: "Reach the minimum trust threshold for Discovery.",
        complete: authenticity.score >= 50,
        href: "/dashboard",
      },
      {
        id: "preferences",
        title: "Set Discovery preferences",
        description: "Choose the hard filters used before Atlas ranks candidates.",
        complete: preferencesSnap.exists,
        href: "/discovery-preferences",
      },
      {
        id: "discovery",
        title: "Enable Discovery",
        description: "Make your profile eligible for private recommendations.",
        complete: profile.visibility === "future_matches",
        href: "/account",
      },
    ];

    const completed = steps.filter((step) => step.complete).length;
    const activeMatches = matchSnap.docs.filter((doc) => ["mutual"].includes(String(doc.data().status ?? ""))).length;

    return NextResponse.json({
      firstName: typeof profile.firstName === "string" && profile.firstName.trim()
        ? profile.firstName.trim()
        : user.name || user.email?.split("@")[0] || "there",
      authenticityScore: authenticity.score,
      authenticityLevel: authenticity.level,
      steps,
      completed,
      total: steps.length,
      readyForDiscovery: completed === steps.length,
      activeIntroductions: activeMatches,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
