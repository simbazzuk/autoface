import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireUser } from "@/lib/server/firebase-admin";
import { defaultDiscoveryPreferences, type DiscoveryPreferences } from "@/lib/discovery-preferences";

const intents=["marriage","long_term_relationship","serious_relationship"] as const;
const locations=["anywhere_uk","same_general_area"] as const;

export async function GET(request:Request){
 try{
  const user=await requireUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const snap=await adminDb.collection("discoveryPreferences").doc(user.uid).get();
  const data=snap.exists?snap.data():{};
  return NextResponse.json({preferences:{uid:user.uid,...defaultDiscoveryPreferences,...data}});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500})}
}

export async function POST(request:Request){
 try{
  const user=await requireUser(request); if(!adminDb)throw new Error("SERVER_NOT_CONFIGURED");
  const body=await request.json() as Partial<DiscoveryPreferences>;
  const minAge=Number(body.minAge),maxAge=Number(body.maxAge);
  if(!Number.isInteger(minAge)||!Number.isInteger(maxAge)||minAge<18||maxAge>100||minAge>maxAge)return NextResponse.json({error:"INVALID_AGE_RANGE"},{status:400});
  if(!locations.includes(body.locationPreference as typeof locations[number]))return NextResponse.json({error:"INVALID_LOCATION_PREFERENCE"},{status:400});
  const relationshipIntents=Array.isArray(body.relationshipIntents)?body.relationshipIntents.filter((x):x is typeof intents[number]=>intents.includes(x as typeof intents[number])):[];
  if(relationshipIntents.length===0)return NextResponse.json({error:"SELECT_RELATIONSHIP_INTENT"},{status:400});
  const ref=adminDb.collection("discoveryPreferences").doc(user.uid); const existing=await ref.get();
  await ref.set({uid:user.uid,minAge,maxAge,locationPreference:body.locationPreference,relationshipIntents,requireRelocationOpen:body.requireRelocationOpen===true,createdAt:existing.exists?(existing.data()?.createdAt??FieldValue.serverTimestamp()):FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return NextResponse.json({ok:true});
 }catch(error){const message=error instanceof Error?error.message:"UNKNOWN_ERROR";return NextResponse.json({error:message},{status:message==="UNAUTHENTICATED"?401:500})}
}
