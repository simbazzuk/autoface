import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { atlasAiEnabled, generateAiDiscoveryInsight } from "@/lib/server/atlas-ai";
import { recommendationFor } from "@/lib/server/discovery";
import { calculateCompatibility } from "@/lib/compatibility";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const { uid } = await params;

    const [viewerSnap, candidateSnap] = await Promise.all([
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(uid).get(),
    ]);

    const viewer = viewerSnap.data() as Partial<RelationshipProfile> | undefined;
    const candidate = candidateSnap.data() as Partial<RelationshipProfile> | undefined;

    return NextResponse.json({
      enabled: atlasAiEnabled(),
      viewerOptIn: viewer?.consentForAiDiscovery === true,
      candidateOptIn: candidate?.consentForAiDiscovery === true,
      available: atlasAiEnabled()
        && viewer?.consentForAiDiscovery === true
        && candidate?.consentForAiDiscovery === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    if (!atlasAiEnabled()) return NextResponse.json({ error: "ATLAS_AI_NOT_CONFIGURED" }, { status: 503 });

    const body = await request.json() as { consent?: boolean };
    if (body.consent !== true) {
      return NextResponse.json({ error: "AI_CONSENT_REQUIRED" }, { status: 400 });
    }

    const { uid } = await params;
    const recommendation = await recommendationFor(user.uid, uid);
    if (!recommendation) {
      return NextResponse.json({ error: "RECOMMENDATION_NOT_AVAILABLE" }, { status: 404 });
    }

    const [viewerSnap, candidateSnap] = await Promise.all([
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(uid).get(),
    ]);

    if (!viewerSnap.exists || !candidateSnap.exists) {
      return NextResponse.json({ error: "RELATIONSHIP_PROFILE_REQUIRED" }, { status: 409 });
    }

    const viewer = viewerSnap.data() as RelationshipProfile;
    const candidate = candidateSnap.data() as RelationshipProfile;

    if (viewer.consentForAiDiscovery !== true) {
      return NextResponse.json({ error: "VIEWER_AI_DISCOVERY_OPT_IN_REQUIRED" }, { status: 409 });
    }
    if (candidate.consentForAiDiscovery !== true) {
      return NextResponse.json({ error: "CANDIDATE_AI_DISCOVERY_OPT_IN_REQUIRED" }, { status: 409 });
    }

    const deterministic = calculateCompatibility(viewer, candidate);
    const insight = await generateAiDiscoveryInsight(
      recommendation.candidate.firstName,
      viewer,
      candidate,
      deterministic,
    );

    return NextResponse.json({
      insight,
      source: "gemini",
      officialCompatibilityScore: deterministic.score,
      persisted: false,
      notice: "Gemini found semantic themes in two explicitly opted-in relationship profiles. It did not calculate eligibility, authenticity or the official compatibility score.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401
      : message.includes("OPT_IN_REQUIRED") || message === "AI_CONSENT_REQUIRED" ? 409
      : message === "SERVER_NOT_CONFIGURED" ? 500
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
