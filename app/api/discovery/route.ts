import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import { buildDiscoveryFor } from "@/lib/server/discovery";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return NextResponse.json(await buildDiscoveryFor(user.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if(message==="REQUESTER_AUTH_USER_MISSING"){
      return NextResponse.json({
        error:"Your signed-in session points to an AutoFace account that no longer exists in Firebase Authentication. Please sign out and sign in again.",
        code:"ACCOUNT_RECORD_MISSING"
      },{status:409});
    }
    return NextResponse.json(
      { error: message, code:"DISCOVERY_ERROR" },
      { status: message === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
