import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import { reviewedRecommendationsFor } from "@/lib/server/discovery";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json(await reviewedRecommendationsFor(user.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
