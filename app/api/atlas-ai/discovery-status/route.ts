import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { atlasAiEnabled } from "@/lib/server/atlas-ai";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");

    const body = await request.json() as { candidateUids?: string[] };
    const candidateUids = Array.isArray(body.candidateUids)
      ? [...new Set(body.candidateUids.map(String).filter(Boolean))].slice(0, 30)
      : [];

    const viewerSnap = await adminDb.collection("relationshipProfiles").doc(user.uid).get();
    const viewer = viewerSnap.data() as Partial<RelationshipProfile> | undefined;
    const viewerOptIn = viewer?.consentForAiDiscovery === true;
    const enabled = atlasAiEnabled();

    const statuses: Record<string, {
      enabled: boolean;
      viewerOptIn: boolean;
      candidateOptIn: boolean;
      available: boolean;
    }> = {};

    await Promise.all(candidateUids.map(async (uid) => {
      const snap = await adminDb!.collection("relationshipProfiles").doc(uid).get();
      const candidate = snap.data() as Partial<RelationshipProfile> | undefined;
      const candidateOptIn = candidate?.consentForAiDiscovery === true;
      statuses[uid] = {
        enabled,
        viewerOptIn,
        candidateOptIn,
        available: enabled && viewerOptIn && candidateOptIn,
      };
    }));

    return NextResponse.json({ enabled, viewerOptIn, statuses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
