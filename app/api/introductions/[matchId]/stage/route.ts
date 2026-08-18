import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";

const allowed=["introduced","talking","getting_to_know","met","progressing"] as const;

export async function POST(request:Request,{params}:{params:Promise<{matchId:string}>}){
  try{
    const user=await requireUser(request);
    if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
    const {matchId}=await params;
    const body=await request.json() as {stage?:string};
    if(!allowed.includes(body.stage as typeof allowed[number]))return NextResponse.json({error:"INVALID_STAGE"},{status:400});
    const ref=adminDb.collection("matches").doc(matchId);
    const snap=await ref.get();
    if(!snap.exists)return NextResponse.json({error:"INTRODUCTION_NOT_FOUND"},{status:404});
    const data=snap.data()??{};
    const participants=(data.participants??[]) as string[];
    if(data.status!=="mutual"||!participants.includes(user.uid))return NextResponse.json({error:"FORBIDDEN"},{status:403});
    await ref.set({journeyState:body.stage,journeyUpdatedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return NextResponse.json({ok:true,stage:body.stage});
  }catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN_ERROR";
    return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500});
  }
}
