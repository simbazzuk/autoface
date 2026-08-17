import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/firebase-admin";
import { recommendationFor } from "@/lib/server/discovery";
export async function GET(request:Request,{params}:{params:Promise<{uid:string}>}){try{const user=await requireUser(request);const {uid}=await params;const recommendation=await recommendationFor(user.uid,uid);if(!recommendation)return NextResponse.json({error:"RECOMMENDATION_NOT_AVAILABLE"},{status:404});return NextResponse.json({recommendation})}catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500})}}
