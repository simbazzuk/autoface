import { NextResponse } from "next/server";
import { requireUser, requireVerifiedUser } from "@/lib/server/firebase-admin";
import { reviewedRecommendationsFor } from "@/lib/server/discovery";
import { membershipFor } from "@/lib/server/membership";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const [result,membership]=await Promise.all([
      reviewedRecommendationsFor(user.uid),
      membershipFor(user.uid),
    ]);
    const allItems=result.items ?? [];
    const full=membership.entitlements.fullRecommendationHistory;
    return NextResponse.json({
      ...result,
      items: full ? allItems : allItems.slice(0,3),
      membership:{plan:membership.plan,fullRecommendationHistory:full},
      historyLimit:full ? null : 3,
      hiddenCount:full ? 0 : Math.max(0,allItems.length-3),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : message === "EMAIL_VERIFICATION_REQUIRED" ? 403 : 500 },
    );
  }
}
