import { NextResponse } from "next/server";
import { atlasApiError } from "@/lib/server/atlas-api-errors";
import { adminDb, requireUser, requireVerifiedUser } from "@/lib/server/firebase-admin";
import { atlasAiEnabled, atlasAiStatus, generateCompatibilityReflection, generateProfileReflection } from "@/lib/server/atlas-ai";
import { calculateCompatibility } from "@/lib/compatibility";
import { demoCompatibilityProfiles } from "@/lib/demo-compatibility-profiles";
import type { RelationshipProfile } from "@/lib/relationship-profile";
import { requireEntitlement } from "@/lib/server/membership";

export const runtime = "nodejs";

type RequestBody = {
  mode?: "profile" | "compatibility";
  consent?: boolean;
  candidateId?: string;
};

export async function GET() {
  const status = atlasAiStatus();
  return NextResponse.json({
    enabled: status.enabled,
    reason: status.reason,
    model: status.model,
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
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
      await requireEntitlement(user.uid, "atlasReflection");
      const insight = await generateProfileReflection(profile);
      return NextResponse.json({
        insight,
        source: "gemini",
        persisted: false,
        notice: "Optional AI reflection. The deterministic Atlas profile remains the source of truth.",
      });
    }

    if (body.mode === "compatibility") {
      await requireEntitlement(user.uid, "fullAtlasExplanations");
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
    console.error("[Atlas AI API] generation_failed", {
      model: atlasAiStatus().model,
      error: error instanceof Error ? error.message : String(error),
    });
    return atlasApiError(error);
  }
}
