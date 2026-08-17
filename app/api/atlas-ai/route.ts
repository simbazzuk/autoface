import { NextResponse } from "next/server";
import { atlasApiError } from "@/lib/server/atlas-api-errors";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { atlasAiEnabled, generateCompatibilityReflection, generateProfileReflection } from "@/lib/server/atlas-ai";
import { calculateCompatibility } from "@/lib/compatibility";
import { demoCompatibilityProfiles } from "@/lib/demo-compatibility-profiles";
import type { RelationshipProfile } from "@/lib/relationship-profile";

export const runtime = "nodejs";

type RequestBody = {
  mode?: "profile" | "compatibility";
  consent?: boolean;
  candidateId?: string;
};

export async function GET() {
  return NextResponse.json({ enabled: atlasAiEnabled() });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!adminDb) throw new Error("SERVER_NOT_CONFIGURED");
    if (!atlasAiEnabled()) {
      return NextResponse.json({ error: "ATLAS_AI_NOT_CONFIGURED" }, { status: 503 });
    }

    const body = (await request.json()) as RequestBody;
    if (body.consent !== true) {
      return NextResponse.json({ error: "AI_CONSENT_REQUIRED" }, { status: 400 });
    }

    const snapshot = await adminDb.collection("relationshipProfiles").doc(user.uid).get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "RELATIONSHIP_PROFILE_REQUIRED" }, { status: 409 });
    }
    const profile = snapshot.data() as RelationshipProfile;
    if (profile.consentForCompatibility !== true) {
      return NextResponse.json({ error: "COMPATIBILITY_CONSENT_REQUIRED" }, { status: 409 });
    }

    if (body.mode === "profile") {
      const insight = await generateProfileReflection(profile);
      return NextResponse.json({
        insight,
        source: "gemini",
        persisted: false,
        notice: "Optional AI reflection. The deterministic Atlas profile remains the source of truth.",
      });
    }

    if (body.mode === "compatibility") {
      const candidate = demoCompatibilityProfiles.find((item) => item.id === body.candidateId);
      if (!candidate) {
        return NextResponse.json({ error: "CANDIDATE_NOT_FOUND" }, { status: 404 });
      }
      const deterministic = calculateCompatibility(profile, candidate);
      const insight = await generateCompatibilityReflection(candidate.name, deterministic);
      return NextResponse.json({
        insight,
        source: "gemini",
        deterministicScore: deterministic.score,
        persisted: false,
        notice: "Gemini explained the deterministic result; it did not calculate or change the score.",
      });
    }

    return NextResponse.json({ error: "INVALID_MODE" }, { status: 400 });
  } catch (error) {
    return atlasApiError(error);

  }
}
