import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { calculateAuthenticity } from "@/lib/authenticity";
import { findSupportTopic } from "@/lib/support-knowledge";

export const runtime = "nodejs";

type RequestBody = { question?: string };

async function discoveryDiagnostic(uid: string, token: Awaited<ReturnType<typeof requireUser>>) {
  if (!adminDb) return null;

  const [profileSnap, relationshipSnap, identitySnap, preferencesSnap] = await Promise.all([
    adminDb.collection("profiles").doc(uid).get(),
    adminDb.collection("relationshipProfiles").doc(uid).get(),
    adminDb.collection("identity").doc(uid).get(),
    adminDb.collection("discoveryPreferences").doc(uid).get(),
  ]);

  const profile = profileSnap.data() ?? {};
  const relationship = relationshipSnap.data() ?? {};
  const identity = identitySnap.data() ?? {};
  const authenticity = calculateAuthenticity({
    emailVerified: Boolean(token.email_verified),
    phoneVerified: Boolean(token.phone_number),
    mfaEnabled: false,
    identityVerified: identity.identityVerified === true,
    livenessVerified: identity.livenessVerified === true,
    photoVerified: identity.photoVerified === true,
  });

  const checks = [
    { label: "Profile", ok: profileSnap.exists && Boolean(profile.firstName) && Boolean(profile.aboutMe) },
    { label: "Atlas consent", ok: relationshipSnap.exists && relationship.consentForCompatibility === true },
    { label: "Authenticity 50%+", ok: authenticity.score >= 50 },
    { label: "Discovery preferences", ok: preferencesSnap.exists },
    { label: "Discovery enabled", ok: profile.visibility === "future_matches" },
  ];

  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  return {
    authenticityScore: authenticity.score,
    missing,
    ready: missing.length === 0,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as RequestBody;
    const question = body.question?.trim() ?? "";

    if (question.length < 2 || question.length > 500) {
      return NextResponse.json({ error: "INVALID_QUESTION" }, { status: 400 });
    }

    const topic = findSupportTopic(question);

    if (!topic) {
      return NextResponse.json({
        answer: "I can help with using AutoFace — including setup, authenticity, Atlas compatibility, Discovery, introductions, messaging, privacy and safety. Try asking how a feature works or where to find it.",
        actionLabel: "Open Getting Started",
        actionUrl: "/get-started",
        source: "curated_support",
      });
    }

    let answer = topic.answer;
    let diagnostic: { authenticityScore: number; missing: string[]; ready: boolean } | null = null;

    if (topic.id === "discovery_locked" || topic.id === "getting_started") {
      diagnostic = await discoveryDiagnostic(user.uid, user);
      if (diagnostic) {
        if (diagnostic.ready) {
          answer += ` Your account currently passes all five Discovery setup checks. Your authenticity score is ${diagnostic.authenticityScore}%.`;
        } else {
          answer += ` On your account, the remaining setup item${diagnostic.missing.length === 1 ? " is" : "s are"}: ${diagnostic.missing.join(", ")}. Your current authenticity score is ${diagnostic.authenticityScore}%.`;
        }
      }
    }

    return NextResponse.json({
      answer,
      actionLabel: topic.actionLabel ?? null,
      actionUrl: topic.actionUrl ?? null,
      topic: topic.id,
      source: "curated_support",
      diagnostic,
      notice: "Atlas Support answers product-navigation questions from approved AutoFace guidance. It does not inspect private messages or make relationship or moderation decisions.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
