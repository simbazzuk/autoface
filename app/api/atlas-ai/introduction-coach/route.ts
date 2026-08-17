import { NextResponse } from "next/server";
import { atlasApiError } from "@/lib/server/atlas-api-errors";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { requireActiveMatch } from "@/lib/server/messaging";
import { atlasAiEnabled, generateIntroductionCoach } from "@/lib/server/atlas-ai";
import { calculateCompatibility } from "@/lib/compatibility";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    const matchId = new URL(request.url).searchParams.get("matchId") ?? "";
    if (!matchId) throw new Error("INVALID_REQUEST");
    const match = await requireActiveMatch(matchId, user.uid);
    const [viewerSnap, otherSnap] = await Promise.all([
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(match.otherUid).get(),
    ]);
    const viewer = viewerSnap.data() as Partial<RelationshipProfile> | undefined;
    const other = otherSnap.data() as Partial<RelationshipProfile> | undefined;
    const viewerOptIn = viewer?.consentForAiDiscovery === true;
    const otherOptIn = other?.consentForAiDiscovery === true;
    return NextResponse.json({ enabled: atlasAiEnabled(), viewerOptIn, otherOptIn, available: atlasAiEnabled() && viewerOptIn && otherOptIn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    if (!atlasAiEnabled()) return NextResponse.json({ error: "ATLAS_AI_NOT_CONFIGURED" }, { status: 503 });
    const body = await request.json() as { matchId?: string; consent?: boolean };
    const matchId = body.matchId?.trim() ?? "";
    if (!matchId || body.consent !== true) return NextResponse.json({ error: "AI_CONSENT_REQUIRED" }, { status: 400 });
    const match = await requireActiveMatch(matchId, user.uid);
    const [viewerSnap, otherSnap, otherProfileSnap] = await Promise.all([
      adminDb.collection("relationshipProfiles").doc(user.uid).get(),
      adminDb.collection("relationshipProfiles").doc(match.otherUid).get(),
      adminDb.collection("profiles").doc(match.otherUid).get(),
    ]);
    if (!viewerSnap.exists || !otherSnap.exists) return NextResponse.json({ error: "RELATIONSHIP_PROFILE_REQUIRED" }, { status: 409 });
    const viewer = viewerSnap.data() as RelationshipProfile;
    const other = otherSnap.data() as RelationshipProfile;
    if (viewer.consentForAiDiscovery !== true || other.consentForAiDiscovery !== true) return NextResponse.json({ error: "BOTH_AI_OPT_INS_REQUIRED" }, { status: 409 });
    const result = calculateCompatibility(viewer, other);
    const otherName = String(otherProfileSnap.data()?.firstName ?? "your introduction").slice(0, 50);
    const coach = await generateIntroductionCoach(otherName, viewer, other, result);
    return NextResponse.json({ coach, persisted: false, notice: "Atlas generated editable conversation starters. Nothing was sent or saved." });
  } catch (error) {
    return atlasApiError(error);

  }
}
