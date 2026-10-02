import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  requireVerifiedUser,
} from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatternReason =
  | "shared_values"
  | "relationship_goals"
  | "lifestyle_alignment"
  | "shared_interests"
  | "profile_stood_out";

type Pattern = {
  reason: PatternReason;
  label: string;
  count: number;
  actionable: boolean;
  preferenceKey: "shared_interests" | null;
};

const LABELS: Record<PatternReason,string> = {
  shared_values: "Shared values",
  relationship_goals: "Relationship goals",
  lifestyle_alignment: "Lifestyle compatibility",
  shared_interests: "Shared interests",
  profile_stood_out: "Profiles that stand out",
};

const POSITIVE = new Set<PatternReason>([
  "shared_values",
  "relationship_goals",
  "lifestyle_alignment",
  "shared_interests",
  "profile_stood_out",
]);

function isPatternReason(value:string):value is PatternReason {
  return POSITIVE.has(value as PatternReason);
}

async function patternsFor(uid:string){
  if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");

  const snap=await adminDb
    .collection("discoveryFeedback")
    .where("uid","==",uid)
    .limit(100)
    .get();

  const counts=new Map<PatternReason,number>();

  for(const doc of snap.docs){
    const data=doc.data();

    // Only positive decisions contribute to positive preference patterns.
    if(!["interested","saved"].includes(String(data.decision??""))){
      continue;
    }

    const reasons=Array.isArray(data.reasons)
      ?data.reasons.map(String)
      :[];

    for(const reason of new Set(reasons)){
      if(!isPatternReason(reason))continue;

      counts.set(
        reason,
        (counts.get(reason)??0)+1
      );
    }
  }

  const patterns:Pattern[]=[...counts.entries()]
    .filter(([,count])=>count>=2)
    .map(([reason,count]):Pattern=>({
      reason,
      label:LABELS[reason],
      count,
      actionable:reason==="shared_interests",
      preferenceKey:
        reason==="shared_interests"
          ?"shared_interests"
          :null,
    }))
    .sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));

  return {
    available:patterns.length>0,
    evidenceRequired:2,
    patterns,
  };
}

export async function GET(request:Request){
  try{
    const user=await requireVerifiedUser(request);
    return NextResponse.json(await patternsFor(user.uid));
  }catch(error){
    const message=
      error instanceof Error
        ?error.message
        :"UNKNOWN_ERROR";

    return NextResponse.json(
      {error:message},
      {
        status:
          message==="UNAUTHENTICATED"
            ?401
            :message==="EMAIL_VERIFICATION_REQUIRED"
              ?403
              :500
      }
    );
  }
}

export async function POST(request:Request){
  try{
    const user=await requireVerifiedUser(request);

    if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");

    const body=await request.json().catch(()=>({})) as {
      reason?:string;
      action?:"dismiss";
    };

    if(
      body.action!=="dismiss" ||
      !body.reason ||
      !isPatternReason(body.reason)
    ){
      return NextResponse.json(
        {error:"INVALID_REQUEST"},
        {status:400}
      );
    }

    await adminDb
      .collection("discoveryPatternDismissals")
      .doc(`${user.uid}_${body.reason}`)
      .set({
        uid:user.uid,
        reason:body.reason,
        dismissedAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp(),
      },{merge:true});

    return NextResponse.json({ok:true});
  }catch(error){
    const message=
      error instanceof Error
        ?error.message
        :"UNKNOWN_ERROR";

    return NextResponse.json(
      {error:message},
      {
        status:
          message==="UNAUTHENTICATED"
            ?401
            :message==="EMAIL_VERIFICATION_REQUIRED"
              ?403
              :500
      }
    );
  }
}
