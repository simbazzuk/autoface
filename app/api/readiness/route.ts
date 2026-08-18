import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { calculateProfileCompleteness, type AutoFaceProfile } from "@/lib/profile";
import { calculateRelationshipCompleteness, type RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const [profileSnap, relationshipSnap, identitySnap, preferencesSnap, photoSnap, matchSnap] = await Promise.all([
      adminDb.collection("profiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("identity").doc(user.uid).get(),
      adminDb.collection("discoveryPreferences").doc(user.uid).get(),
      adminDb.collection("profilePhotos").doc(user.uid).get(),
      adminDb.collection("matches").where("participants", "array-contains", user.uid).limit(100).get(),
    ]);

    const profile = (profileSnap.data() ?? {}) as Partial<AutoFaceProfile>;
    const relationship = (relationshipSnap.data() ?? {}) as Partial<RelationshipProfile>;
    const identity = identitySnap.data() ?? {};

    const authenticity = calculateAuthenticity({
      emailVerified: Boolean(user.email_verified),
      phoneVerified: Boolean(user.phone_number),
      mfaEnabled: false,
      identityVerified: identity.identityVerified === true,
      livenessVerified: identity.livenessVerified === true,
      photoVerified: identity.photoVerified === true,
    });

    const profileCompleteness = profileSnap.exists ? calculateProfileCompleteness(profile) : {completed:0,total:8,score:0};
    const atlasCompleteness = relationshipSnap.exists ? calculateRelationshipCompleteness(relationship) : {completed:0,total:13,score:0};

    const steps = [
      {
        id: "profile",
        title: "Build your profile",
        shortTitle: "Profile",
        description: "Tell people who you are, including lifestyle, profession, education and interests.",
        complete: profileSnap.exists && Boolean(profile.firstName) && Boolean(profile.surname) && Boolean(profile.aboutMe),
        href: "/profile",
        optional: false,
      },
      {
        id: "photo",
        title: "Add your profile photo",
        shortTitle: "Photo",
        description: "Add a clear photo so introductions feel personal and recognisable.",
        complete: photoSnap.exists,
        href: "/profile",
        optional: false,
      },
      {
        id: "atlas",
        title: "Complete your Atlas profile",
        shortTitle: "Atlas",
        description: "Describe values, expectations and relationship patterns used by explainable compatibility.",
        complete: relationshipSnap.exists && relationship.consentForCompatibility === true && atlasCompleteness.score >= 80,
        href: "/relationship-profile",
        optional: false,
      },
      {
        id: "preferences",
        title: "Set introduction preferences",
        shortTitle: "Preferences",
        description: "Tell AutoFace what matters to you before Atlas considers potential introductions.",
        complete: preferencesSnap.exists,
        href: "/discovery-preferences",
        optional: false,
      },
      {
        id: "authenticity",
        title: "Build authenticity",
        shortTitle: "Trust",
        description: "Reach the minimum trust threshold required to enter Discovery.",
        complete: authenticity.score >= 50,
        href: "/dashboard",
        optional: false,
      },
      {
        id: "discovery",
        title: "Choose to enter Discovery",
        shortTitle: "Discover",
        description: "When you are comfortable, make your profile available for considered private recommendations.",
        complete: profile.visibility === "future_matches",
        href: "/profile",
        optional: false,
      },
    ];

    const completed = steps.filter((step) => step.complete).length;
    const activeMatches = matchSnap.docs.filter((doc) => doc.data().status === "mutual").length;
    const nextStep = steps.find((step) => !step.complete) ?? null;

    return NextResponse.json({
      firstName: typeof profile.preferredName === "string" && profile.preferredName.trim()
        ? profile.preferredName.trim()
        : typeof profile.firstName === "string" && profile.firstName.trim()
          ? profile.firstName.trim()
          : user.name || user.email?.split("@")[0] || "there",
      authenticityScore: authenticity.score,
      authenticityLevel: authenticity.level,
      profileCompleteness: profileCompleteness.score,
      atlasCompleteness: atlasCompleteness.score,
      photoAdded: photoSnap.exists,
      steps,
      completed,
      total: steps.length,
      setupPercent: Math.round((completed / steps.length) * 100),
      nextStep,
      readyForDiscovery: steps.every((step) => step.complete),
      activeIntroductions: activeMatches,
      discoveryEnabled: profile.visibility === "future_matches",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
