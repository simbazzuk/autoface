import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import {
  ensureFoundingMembership,
  founderEligibility,
  foundingProgrammeStatus,
} from "@/lib/server/founding-program";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const programme = await foundingProgrammeStatus();
    return NextResponse.json({ programme });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const result = await ensureFoundingMembership(user.uid);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: message },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
