import { NextResponse } from "next/server";

export function atlasApiError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

  if (code === "UNAUTHENTICATED") return NextResponse.json({ error: code }, { status: 401 });
  if (code === "ATLAS_AI_NOT_CONFIGURED") return NextResponse.json({ error: code }, { status: 503 });
  if (code.includes("OPT_IN_REQUIRED") || code === "AI_CONSENT_REQUIRED") {
    return NextResponse.json({ error: code }, { status: 409 });
  }
  if (code === "ATLAS_AI_TEMPORARILY_UNAVAILABLE" || code === "ATLAS_AI_TIMEOUT") {
    return NextResponse.json({
      error: "ATLAS_AI_TEMPORARILY_UNAVAILABLE",
      message: "Atlas is temporarily busy. Your normal AutoFace compatibility results are still available.",
      retryable: true,
    }, { status: 503 });
  }

  const safeCodes = new Set([
    "ATLAS_AI_INVALID_JSON","ATLAS_AI_INVALID_RESPONSE","ATLAS_AI_INVALID_COACH_OBJECT",
    "ATLAS_AI_INVALID_INTRO","ATLAS_AI_INVALID_STARTERS","ATLAS_AI_INVALID_STARTER",
    "ATLAS_AI_INVALID_THEME","ATLAS_AI_INVALID_QUESTION","ATLAS_AI_INVALID_BASIS",
    "ATLAS_AI_EMPTY_RESPONSE","RELATIONSHIP_PROFILE_REQUIRED","RECOMMENDATION_NOT_AVAILABLE",
    "BOTH_AI_OPT_INS_REQUIRED","VIEWER_AI_DISCOVERY_OPT_IN_REQUIRED",
    "CANDIDATE_AI_DISCOVERY_OPT_IN_REQUIRED",
  ]);

  return NextResponse.json({
    error: safeCodes.has(code) ? code : "ATLAS_AI_UNAVAILABLE",
    message: "Atlas could not generate this optional insight. Your normal AutoFace experience is unaffected.",
    retryable: false,
  }, { status: 502 });
}
