import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import { introductionJourneyFor } from "@/lib/server/introduction-journey";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    const user=await requireUser(request);
    const journey=await introductionJourneyFor(user.uid);
    return NextResponse.json({...journey,introductions:journey.mutual});
  }catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500});
  }
}
